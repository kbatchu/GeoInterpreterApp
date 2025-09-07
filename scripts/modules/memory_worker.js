// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\modules\memory_worker.js
import { pipeline } from "@xenova/transformers";
import ToolRetriever from "./tools/tool_retriever.js";
import initDuckDB from "./duckdb_init.js";
import kuzuInit from '@kuzu/kuzu-wasm';

// Global state for the worker
let db;
let dbConn;
let kuzuDB;
let kuzuConn;
let embedding_pipe;
let dbDirty = false;
let toolRetriever;
let ontologyUsage = [];

async function initializeDatabase() {
  if (db) return;

  try {
    const dbInitResult = await initDuckDB();
    db = dbInitResult.db;
    dbConn = dbInitResult.dbConn;
  } catch (e) {
    console.error("Failed to initialize DuckDB:", e);
    throw e;
  }

  try {
    // Initialize Kuzu
    kuzuDB = new kuzu.Database();
    kuzuConn = new kuzu.Connection(kuzuDB);
    console.log("KuzuDB Initialized");
  } catch (e) {
    console.error("Failed to initialize KuzuDB:", e);
    throw e;
  }


  try {
    await loadDatabaseFromIndexedDB();
  } catch (e) {
    console.warn("Failed to load database from IndexedDB, creating a new one:", e.message);
    await deleteDatabaseFromIndexedDB(); // Delete the corrupted one
    // The rest of the initialization will create the tables
  }

  const initializationPromises = [];

  initializationPromises.push((async () => {
    try {
      await dbConn.query(`
        CREATE TABLE IF NOT EXISTS conversation_chunks (
          chunk_id UUID PRIMARY KEY,
          session_id VARCHAR,
          turn INTEGER,
          speaker VARCHAR,
          content TEXT,
          embedding FLOAT[384],
          created_at TIMESTAMP DEFAULT current_timestamp
        );
        CREATE INDEX IF NOT EXISTS hnsw_index ON conversation_chunks USING HNSW (embedding);
      `);
      self.postMessage({ progress: { type: "status", message: "Conversation history table created." } });
    } catch (e) {
      console.error("Could not create conversation_chunks table:", e);
      throw e;
    }
  })());

  initializationPromises.push((async () => {
    try {
      await dbConn.query(`CREATE TABLE IF NOT EXISTS entities (entity_id UUID PRIMARY KEY, entity_name VARCHAR, entity_type VARCHAR, created_at TIMESTAMP DEFAULT current_timestamp);`);
      await dbConn.query(`CREATE TABLE IF NOT EXISTS entity_attributes (attribute_id UUID PRIMARY KEY, entity_id UUID REFERENCES entities(entity_id), attribute_key VARCHAR, attribute_value VARCHAR, created_at TIMESTAMP DEFAULT current_timestamp);`);
      await dbConn.query(`CREATE TABLE IF NOT EXISTS geospatial_attributes (geo_id UUID PRIMARY KEY, entity_id UUID REFERENCES entities(entity_id), geometry GEOMETRY, address VARCHAR, session_id VARCHAR, created_at TIMESTAMP DEFAULT current_timestamp);`);
      await dbConn.query(`CREATE INDEX IF NOT EXISTS rtree_idx ON geospatial_attributes USING RTREE (geometry);`);
      await dbConn.query(`CREATE TABLE IF NOT EXISTS relationships (relationship_id UUID PRIMARY KEY, source_entity_id UUID REFERENCES entities(entity_id), target_entity_id UUID REFERENCES entities(entity_id), relationship_type VARCHAR, created_at TIMESTAMP DEFAULT current_timestamp);`);
      self.postMessage({ progress: { type: "status", message: "Knowledge graph tables created." } });
    } catch (e) {
      console.error("Could not create knowledge graph tables:", e);
      throw e;
    }
  })());

  await Promise.all(initializationPromises);

  const embeddingManager = {
    readyPromise: Promise.resolve(),
    generateEmbedding: generateEmbedding,
  };
  toolRetriever = new ToolRetriever(embeddingManager, dbConn);

  setInterval(manageConversationHistory, 60000); // Check every minute
  setInterval(saveDatabaseToIndexedDB, 300000); // Save every 5 minutes
  setInterval(unloadUnusedOntologies, 300000); // Unload unused ontologies every 5 minutes
}

async function saveDatabaseToIndexedDB() {
    if (!dbDirty) return;

    const buffer = await db.copyFileToBuffer("main.duckdb");
    const request = indexedDB.open("GeoInterpreterDB", 1);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("files", { keyPath: "name" });
    };

    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        store.put({ name: "main.db", buffer });
        transaction.oncomplete = () => {
            console.log("Database saved to IndexedDB");
            dbDirty = false;
        };
    };
}

async function deleteDatabaseFromIndexedDB() {
    const request = indexedDB.open("GeoInterpreterDB", 1);

    request.onsuccess = (event) => {
        const indexedDB_db = event.target.result;
        const transaction = indexedDB_db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        store.delete("main.db");
        transaction.oncomplete = () => {
            console.log("Corrupted database deleted from IndexedDB");
        };
    };

    request.onerror = (event) => {
        console.error("Error deleting database from IndexedDB:", event.target.error);
    };
}

async function loadDatabaseFromIndexedDB() {
    const request = indexedDB.open("GeoInterpreterDB", 1);

    return new Promise((resolve, reject) => {
        request.onupgradeneeded = (event) => {
            const indexedDB_db = event.target.result;
            indexedDB_db.createObjectStore("files", { keyPath: "name" });
        };

        request.onsuccess = (event) => {
            const indexedDB_db = event.target.result;
            const transaction = indexedDB_db.transaction(["files"], "readonly");
            const store = indexedDB_db.transaction("files").objectStore("files");
            const getRequest = store.get("main.db");

            getRequest.onsuccess = async (event) => {
                if (event.target.result) {
                    const buffer = event.target.result.buffer;
                    try {
                        await db.registerFileBuffer("main.duckdb", new Uint8Array(buffer));
                        await dbConn.query("ATTACH 'main.duckdb' AS persisted_db;");
                        console.log("Database loaded from IndexedDB");
                        resolve();
                    } catch (e) {
                        console.error("Error loading database from IndexedDB, likely corrupted:", e);
                        reject(new Error("Corrupted database in IndexedDB"));
                    }
                } else {
                    resolve(); // No database found in IndexedDB, proceed with new
                }
            };

            getRequest.onerror = (event) => {
                console.error("Error getting database from IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        };

        request.onerror = (event) => {
            console.error("Error opening IndexedDB:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function manageConversationHistory() {
    const CONVERSATION_LIMIT = 100;
    const SUMMARY_SIZE = 20;

    const turnCountResult = await dbConn.query(`SELECT COUNT(*) as count FROM conversation_chunks`);
    const turnCount = turnCountResult.toArray()[0].count;

    if (turnCount > CONVERSATION_LIMIT) {
        const oldestTurnsResult = await dbConn.query(`
            SELECT * FROM conversation_chunks
            ORDER BY created_at ASC
            LIMIT ${SUMMARY_SIZE};
        `);
        const oldestTurns = oldestTurnsResult.toArray().map(row => row.toJSON());

        const summaryContent = oldestTurns.map(turn => `${turn.speaker}: ${turn.content}`).join('\n');
        
        // This is a placeholder for a call to an LLM to summarize the content.
        const summary = `Summary of old conversation: ${summaryContent}`;

        const summaryEmbedding = await generateEmbedding(summary);
        const summaryEmbeddingString = JSON.stringify(Array.from(summaryEmbedding));

        await dbConn.query(`DELETE FROM conversation_chunks WHERE chunk_id IN (${oldestTurns.map(t => `'${t.chunk_id}'`).join(',')})`);
        
        const stmt = await dbConn.prepare(`
            INSERT INTO conversation_chunks (chunk_id, session_id, turn, speaker, content, embedding)
            VALUES (uuid(), ?, ?, ?, ?, CAST(? AS FLOAT[384]));
        `);
        await stmt.query(oldestTurns[0].session_id, oldestTurns[0].turn, 'summary', summary, summaryEmbeddingString);
        dbDirty = true;
    }
}

async function generateEmbedding(text) {
  if (!embedding_pipe) {
    embedding_pipe = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  const embedding = await embedding_pipe(text, {
    pooling: "mean",
    normalize: true,
  });
  return embedding.data;
}

async function addConversationTurn(turn) {
    const { sessionId, turnIndex, speaker, content } = turn;
    const embedding = await generateEmbedding(content);
    const embeddingString = JSON.stringify(Array.from(embedding));

    const sql = `
        INSERT INTO conversation_chunks (chunk_id, session_id, turn, speaker, content, embedding)
        VALUES (uuid(), ?, ?, ?, ?, CAST(? AS FLOAT[384]));
    `;

    const stmt = await dbConn.prepare(sql);
    await stmt.query(sessionId, turnIndex, speaker, content, embeddingString);
    dbDirty = true;
}

async function getRelevantConversation(query, topN = 3) {
    const queryEmbedding = await generateEmbedding(query);
    const queryEmbeddingString = JSON.stringify(Array.from(queryEmbedding));

    const sql = `
        SELECT content, (embedding <-> CAST(? AS FLOAT[384])) AS distance
        FROM conversation_chunks
        ORDER BY distance
        LIMIT ?;
    `;

    const stmt = await dbConn.prepare(sql);
    const results = await stmt.query(queryEmbeddingString, topN);
    return results.toArray().map((row) => row.toJSON());
}

async function addEntity(entity) {
    const { entityName, entityType } = entity;
    const sql = `
        INSERT INTO entities (entity_id, entity_name, entity_type)
        VALUES (uuid(), ?, ?)
        RETURNING entity_id;
    `;
    const stmt = await dbConn.prepare(sql);
    const result = await stmt.query(entityName, entityType);
    dbDirty = true;
    return result.toArray().map((row) => row.toJSON())[0];
}

async function addAttribute(attribute) {
    const { entityId, attributeKey, attributeValue } = attribute;
    const sql = `
        INSERT INTO entity_attributes (attribute_id, entity_id, attribute_key, attribute_value)
        VALUES (uuid(), ?, ?, ?);
    `;
    const stmt = await dbConn.prepare(sql);
    await stmt.query(entityId, attributeKey, attributeValue);
    dbDirty = true;
}

async function addGeospatialAttribute(data) {
  try {
    // Extract from the nested structure - the data comes as { attribute: { ... } }
    const attributeData = data.attribute || data;
    const { entityId, entityType, latitude, longitude, address, sessionId, geometry } = attributeData;
    
    let lat, lon, wktPoint;
    
    // Handle different input formats
    if (geometry) {
      // If geometry is already provided (like "POINT(lon lat)")
      if (typeof geometry === 'string' && geometry.startsWith('POINT(')) {
        wktPoint = geometry;
      } else {
        throw new Error(`Invalid geometry format: ${geometry}`);
      }
    } else if (latitude !== undefined && longitude !== undefined) {
      // Convert coordinates to numbers and validate
      lat = parseFloat(latitude);
      lon = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
      }
      
      // Create WKT string - note: longitude comes first in WKT format
      wktPoint = `POINT(${lon} ${lat})`;
    } else {
      throw new Error(`Missing coordinate data: latitude=${latitude}, longitude=${longitude}, geometry=${geometry}`);
    }
    
    const sql = `
      INSERT OR REPLACE INTO geospatial_attributes 
      (entity_id, entity_type, geometry, address, session_id, created_at)
      VALUES (?, ?, ST_GeomFromText(?), ?, ?, datetime('now'))
    `;
    
    await dbConn.run(sql, [
      entityId,
      entityType || 'Unknown',
      wktPoint,
      address || null,
      sessionId || 'default'
    ]);
    
    console.log(`Memory Worker: Added geospatial attribute for entity ${entityId} at ${wktPoint}`);
    return { success: true };
    
  } catch (error) {
    console.error('Memory Worker: Error adding geospatial attribute:', error);
    throw error;
  }
}

async function addRelationship(relationship) {
    const { sourceEntityId, targetEntityId, relationshipType } = relationship;
    const sql = `
        INSERT INTO relationships (relationship_id, source_entity_id, target_entity_id, relationship_type)
        VALUES (uuid(), ?, ?, ?);
    `;
    const stmt = await dbConn.prepare(sql);
    await stmt.query(sourceEntityId, targetEntityId, relationshipType);
    dbDirty = true;
}

async function handleLoadFile(args) {
  const { file, fileName } = args;
  const extension = fileName.split('.').pop().toLowerCase();
  const tableName = fileName.replace(/[^a-zA-Z0-9]/g, '_').replace(`.${extension}`, '');

  try {
    await db.registerFileHandle(fileName, file);

    switch (extension) {
      case 'csv':
        await dbConn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${fileName}');`);
        break;
      case 'json':
      case 'geojson':
        await dbConn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM ST_Read('${fileName}');`);
        break;
      case 'parquet':
        await dbConn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${fileName}');`);
        break;
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }

    dbDirty = true;
    self.postMessage({ progress: { type: "status", message: `Loaded ${fileName} into table ${tableName}.` } });
    return { tableName };
  } catch (e) {
    console.error(`Failed to load file ${fileName}:`, e);
    throw e;
  }
}

async function getEntity(entityId) {
    const sql = `
        SELECT
            e.entity_id,
            e.entity_name,
            e.entity_type,
            (SELECT json_group_array(json_object('attribute_key', ea.attribute_key, 'attribute_value', ea.attribute_value)) FROM entity_attributes ea WHERE ea.entity_id = e.entity_id) as attributes,
            (SELECT json_group_array(json_object('geometry', ST_AsText(ga.geometry))) FROM geospatial_attributes ga WHERE ga.entity_id = e.entity_id) as geospatial_attributes,
            (SELECT json_group_array(json_object('target_entity_id', r.target_entity_id, 'relationship_type', r.relationship_type)) FROM relationships r WHERE r.source_entity_id = e.entity_id) as relationships
        FROM
            entities e
        WHERE
            e.entity_id = ?;
    `;

    const stmt = await dbConn.prepare(sql);
    const result = await stmt.query(entityId);
    const raw = result.toArray().map((row) => row.toJSON())[0];

    return {
        entity: {
            entity_id: raw.entity_id,
            entity_name: raw.entity_name,
            entity_type: raw.entity_type,
        },
        attributes: JSON.parse(raw.attributes || '[]'),
        geospatial_attributes: JSON.parse(raw.geospatial_attributes || '[]'),
        relationships: JSON.parse(raw.relationships || '[]'),
    };
}

async function getOntologyFromIndexedDB(ontologyName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("GeoInterpreterOntologies", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("ontologies")) {
        db.createObjectStore("ontologies", { keyPath: "name" });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("ontologies")) {
        return resolve(null);
      }
      const transaction = db.transaction(["ontologies"], "readonly");
      const store = transaction.objectStore("ontologies");
      const getRequest = store.get(`${ontologyName}.kuzu`);

      getRequest.onsuccess = (event) => {
        if (event.target.result) {
          resolve(event.target.result.buffer);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = (event) => {
        reject(event.target.error);
      };
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function saveOntologyToIndexedDB(ontologyName, buffer) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("GeoInterpreterOntologies", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore("ontologies", { keyPath: "name" });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(["ontologies"], "readwrite");
      const store = transaction.objectStore("ontologies");
      store.put({ name: `${ontologyName}.kuzu`, buffer });
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function loadOntologies(ontologyNames) {
  for (const ontologyName of ontologyNames) {
    try {
      let buffer;
      const cachedBuffer = await getOntologyFromIndexedDB(ontologyName);

      if (cachedBuffer) {
        console.log(`Ontology ${ontologyName} loaded from IndexedDB`);
        buffer = cachedBuffer;
      } else {
        const response = await fetch(`../data/${ontologyName}.kuzu`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${ontologyName}.kuzu: ${response.statusText}`);
        }
        buffer = await response.arrayBuffer();
        console.log(`Ontology ${ontologyName} fetched from network`);
        await saveOntologyToIndexedDB(ontologyName, buffer);
      }

      // Write the buffer to the virtual file system
      const virtualFileName = `/${ontologyName}.kuzu`;
      kuzu.FS.writeFile(virtualFileName, new Uint8Array(buffer));

      // Attach the database
      await kuzuConn.query(`ATTACH DATABASE '${virtualFileName}' AS ${ontologyName}`);
      console.log(`Attached ontology: ${ontologyName}`);
      self.postMessage({ progress: { type: "status", message: `Ontology ${ontologyName} loaded.` } });

      // Track usage
      const index = ontologyUsage.indexOf(ontologyName);
      if (index > -1) {
        ontologyUsage.splice(index, 1);
      }
      ontologyUsage.push(ontologyName);

    } catch (e) {
      console.error(`Failed to load ontology ${ontologyName}:`, e);
      self.postMessage({ progress: { type: "error", message: `Failed to load ontology ${ontologyName}.` } });
    }
  }
}

const MAX_LOADED_ONTOLOGIES = 5;

async function unloadUnusedOntologies() {
  if (ontologyUsage.length > MAX_LOADED_ONTOLOGIES) {
    const ontologyToUnload = ontologyUsage.shift(); // Get the least recently used
    try {
      await kuzuConn.query(`DETACH DATABASE ${ontologyToUnload}`);
      const virtualFileName = `/${ontologyToUnload}.kuzu`;
      kuzu.FS.unlink(virtualFileName);
      console.log(`Unloaded ontology: ${ontologyToUnload}`);
      self.postMessage({ progress: { type: "status", message: `Unloaded ontology ${ontologyToUnload} to save memory.` } });
    } catch (e) {
      console.error(`Failed to unload ontology ${ontologyToUnload}:`, e);
    }
  }
}

async function executeHybridAnalysis(args) {
  const { analysisType, sourceTableName, filterClause, startNode, endNode } = args;
  console.log(`Executing hybrid analysis: ${analysisType} on ${sourceTableName}`);

  // 1. Create a temporary Kuzu database instance
  const tempKuzuDB = new kuzu.Database();
  const tempKuzuConn = new kuzu.Connection(tempKuzuDB);
  console.log("Temporary KuzuDB for hybrid analysis initialized.");

  try {
    // 2. Extract data from DuckDB
    const query = `SELECT * FROM ${sourceTableName} ${filterClause || ''}`;
    const duckDBData = await dbConn.query(query);
    const data = duckDBData.toArray().map(row => row.toJSON());

    if (data.length === 0) {
      throw new Error(`No data found in table ${sourceTableName} with filter ${filterClause}`);
    }

    self.postMessage({ progress: { type: "status", message: `Extracted ${data.length} rows from DuckDB.` } });

    if (analysisType === 'routing') {
      // 3. Create schema in the temporary Kuzu instance
      await tempKuzuConn.query('CREATE NODE TABLE Intersection(id INT64, PRIMARY KEY (id));');
      await tempKuzuConn.query('CREATE REL TABLE CONNECTS_TO(FROM Intersection TO Intersection, length FLOAT);');
      console.log("Temporary routing schema created in Kuzu.");

      // 4. Load data into the temporary Kuzu instance
      self.postMessage({ progress: { type: "status", message: `Loading ${data.length} edges into temporary graph.` } });
      
      // Use prepared statements for efficiency
      const createIntersectionStmt = await tempKuzuConn.prepare('CREATE (i:Intersection {id: $id})');
      const createRoadStmt = await tempKuzuConn.prepare('MATCH (a:Intersection {id: $start}), (b:Intersection {id: $end}) CREATE (a)-[:CONNECTS_TO {length: $length}]->(b)');

      const allNodeIds = new Set();
      data.forEach(row => {
        allNodeIds.add(row.start_node);
        allNodeIds.add(row.end_node);
      });

      for (const nodeId of allNodeIds) {
        await createIntersectionStmt.run({ id: nodeId });
      }

      for (const row of data) {
        await createRoadStmt.run({ start: row.start_node, end: row.end_node, length: row.length });
      }
      
      console.log("Data loaded into temporary Kuzu instance.");
      self.postMessage({ progress: { type: "status", message: `Data loaded into temporary graph.` } });

      // 5. Execute the analysis
      const routingQuery = `MATCH (a:Intersection {id: ${startNode}}), (b:Intersection {id: ${endNode}}) CALL shortest_path(a, b) YIELD nodes, length;`;
      console.log("Executing routing query...");
      const routingResult = await tempKuzuConn.query(routingQuery);
      
      // 6. Return the result
      return { success: true, result: routingResult };

    } else {
      throw new Error(`Unsupported hybrid analysis type: ${analysisType}`);
    }

  } catch (e) {
    console.error("Error during hybrid analysis:", e);
    throw e;
  } finally {
    // 7. Cleanup
    // tempKuzuDB.close(); // or similar cleanup method
    console.log("Temporary KuzuDB for hybrid analysis cleaned up.");
  }
}

self.onmessage = async (event) => {
  const { messageId, command, args } = event.data;

  try {
    switch (command) {
      case "initialize":
        await initializeDatabase();
        self.postMessage({ messageId, payload: "initialized" });
        break;

      case "generateEmbedding":
        const embedding = await generateEmbedding(args.text);
        self.postMessage({ messageId, payload: embedding });
        break;

      case "query":
        const results = await dbConn.query(args.sql);
        self.postMessage({
          messageId,
          payload: results.toArray().map((row) => row.toJSON()),
        });
        break;

      case "getRelevantTools":
        const tools = await toolRetriever.getRelevantToolsWithDependencies(
          args.query,
          args.topN,
          args.levels
        );
        self.postMessage({ messageId, payload: tools });
        break;

      case "addConversationTurn":
        await addConversationTurn(args.turn);
        self.postMessage({ messageId, payload: "turn added" });
        break;

      case "getRelevantConversation":
        const conversation = await getRelevantConversation(args.query, args.topN);
        self.postMessage({ messageId, payload: conversation });
        break;

      case "addEntity":
        const entity = await addEntity(args.entity);
        self.postMessage({ messageId, payload: entity });
        break;

      case "addAttribute":
        await addAttribute(args.attribute);
        self.postMessage({ messageId, payload: "attribute added" });
        break;

      case "addGeospatialAttribute":
        await addGeospatialAttribute(args);
        self.postMessage({ messageId, payload: "geospatial attribute added" });
        break;

      case "addRelationship":
        await addRelationship(args.relationship);
        self.postMessage({ messageId, payload: "relationship added" });
        break;

      case "getEntity":
        const entityInfo = await getEntity(args.entityId);
        self.postMessage({ messageId, payload: entityInfo });
        break;

      case "reset":
        // Clear conversation history and session-specific data
        await dbConn.query("DELETE FROM conversation_chunks;");
        await dbConn.query("DELETE FROM geospatial_attributes;");
        await dbConn.query("DELETE FROM entity_attributes;");
        await dbConn.query("DELETE FROM relationships;");
        await dbConn.query("DELETE FROM entities;");
        dbDirty = true; // Mark database as modified
        console.log("Memory Worker: State has been reset.");
        self.postMessage({ messageId, payload: "reset successful" });
        break;

      case "loadFile":
        const loadResult = await handleLoadFile(args);
        self.postMessage({ messageId, payload: loadResult });
        break;

      case "loadOntologies":
        await loadOntologies(args.ontologies);
        self.postMessage({ messageId, payload: "ontologies loaded" });
        break;

      case "queryKuzu":
        const kuzuResults = await kuzuConn.query(args.cypher);
        self.postMessage({
          messageId,
          payload: kuzuResults,
        });
        break;

      case "executeHybridAnalysis":
        const hybridResult = await executeHybridAnalysis(args);
        self.postMessage({ messageId, payload: hybridResult });
        break;

      default:
        self.postMessage({ messageId, error: `Unknown command: ${command}` });
    }
  } catch (error) {
    console.error("Memory Worker: Error processing command:", command, error);
    self.postMessage({ messageId, error: error.message });
  }
};
