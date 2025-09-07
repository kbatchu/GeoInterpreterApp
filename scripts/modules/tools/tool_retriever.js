// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\modules\tools\tool_retriever.js

/**
 * Retrieves relevant tools from a DuckDB tool registry based on vector similarity search.
 */
class ToolRetriever {
  /**
   * @param {import('./embedding_manager.js').default} embeddingManager - An initialized EmbeddingManager instance.
   * @param {import('@duckdb/duckdb-wasm').AsyncDuckDBConnection} duckdbConnection - An active DuckDB connection.
   */
  constructor(embeddingManager, duckdbConnection) {
    if (!embeddingManager || !embeddingManager.readyPromise) {
      throw new Error(
        "ToolRetriever: An EmbeddingManager instance with a readyPromise is required."
      );
    }
    if (!duckdbConnection) {
      throw new Error("ToolRetriever: A DuckDB connection is required.");
    }
    this.embeddingManager = embeddingManager;
    this.duckdbConnection = duckdbConnection;
  }

  /**
   * Retrieves relevant tools from the tool registry using vector similarity search.
   * This function retrieves tools in a hierarchical manner, starting from level 1, then level 2, and finally level 3,
   * based on the number of tools found at each level.
   * @param {string} query - The user query or current plan step.
   * @param {number} [topN=5] - The number of top relevant tools to retrieve.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of tool definitions,
   * including a `similarity` score (where 1 is a perfect match).
   */
  async getRelevantTools(query, topN = 5) {
    await this.embeddingManager.readyPromise;

    const queryEmbedding = await this.embeddingManager.generateEmbedding(query);
    const queryEmbeddingString = JSON.stringify(Array.from(queryEmbedding));
    console.log(`ToolRetriever: Embedding generated for query: "${query}"`);

    const levels = [1, 2, 3];
    let tools = [];

    for (const level of levels) {
      tools = await this.getRelevantToolsByLevel(queryEmbeddingString, topN, level);
      if (tools.length > 0) {
        console.log(`ToolRetriever: Found ${tools.length} tools at level ${level}.`);
        break;
      }
    }

    return tools;
  }

  async getRelevantToolsByLevel(queryEmbeddingString, topN, level) {
    const querySql = `
            SELECT
                tool_id,
                category,
                semantic_description,
                parameters_json,
                system_prompt,
                array_cosine_distance(
                    semantic_description_embedding,
                    CAST('${queryEmbeddingString}' AS DOUBLE[384])
                ) AS distance
            FROM
                tool_registry_db.duckdb_tools
            WHERE level = ${level}
            ORDER BY
                distance ASC
            LIMIT ${topN};
        `;

    const result = await this.duckdbConnection.query(querySql).catch((e) => {
      console.error(`ToolRetriever: Error querying tool registry for level ${level}:`, e);
      throw new Error(`Failed to retrieve tools from DuckDB for level ${level}: ` + e.message);
    });

    const tools = [];
    if (result && result.toArray) {
      const toolRows = result.toArray();
      for (const row of toolRows) {
        tools.push({
          name: row.tool_id,
          category: row.category,
          description: row.semantic_description,
          parameters: JSON.parse(row.parameters_json),
          system_prompt: row.system_prompt,
          similarity: 1 - row.distance,
        });
      }
    }
    return tools;
  }

  /**
   * Retrieves relevant tools and their dependencies from the tool registry.
   * This function retrieves tools in a hierarchical manner, starting from level 1, then level 2, and finally level 3,
   * based on the number of tools found at each level.
   * @param {string} query - The user query or current plan step.
   * @param {number} [topN=5] - The number of top relevant tools to retrieve.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of tool definitions, including dependencies.
   */
  async getRelevantToolsWithDependencies(query, topN = 5) {
    // 1. Get the initial set of relevant tools
    const initialTools = await this.getRelevantTools(query, topN);
    const initialToolIds = initialTools.map(t => t.name);

    if (initialToolIds.length === 0) {
      return [];
    }

    // 2. Find all dependent tools recursively
    const allToolIds = new Set(initialToolIds);
    const toolsToQuery = [...initialToolIds];

    while (toolsToQuery.length > 0) {
      const currentToolId = toolsToQuery.shift();
      
      const dependencyQuery = `
        SELECT dependency_id
        FROM tool_registry_db.tool_dependencies
        WHERE tool_id = '${currentToolId}';
      `;
      
      const result = await this.duckdbConnection.query(dependencyQuery).catch((e) => {
        console.error(`ToolRetriever: Error querying dependencies for tool ${currentToolId}:`, e);
        return null;
      });

      if (result) {
        const dependencyRows = result.toArray();
        for (const row of dependencyRows) {
          const dependencyId = row.dependency_id;
          if (dependencyId && !allToolIds.has(dependencyId)) {
            allToolIds.add(dependencyId);
            toolsToQuery.push(dependencyId);
          }
        }
      }
    }

    // 3. Fetch the full tool definitions for all identified tool IDs
    const finalTools = await this.getToolDefinitions(Array.from(allToolIds));
    
    // 4. Combine and de-duplicate tools, preserving the original similarity scores
    const finalToolMap = new Map();
    initialTools.forEach(t => finalToolMap.set(t.name, t));
    finalTools.forEach(t => {
        if (!finalToolMap.has(t.name)) {
            finalToolMap.set(t.name, { ...t, similarity: 0 }); // Set a default similarity for dependencies
        }
    });

    return Array.from(finalToolMap.values());
  }

  /**
   * Retrieves full tool definitions for a given list of tool IDs.
   * @param {Array<string>} toolIds - An array of tool IDs.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of tool definitions.
   */
  async getToolDefinitions(toolIds) {
    if (toolIds.length === 0) {
      return [];
    }

    const toolIdList = toolIds.map(id => `'${id}'`).join(',');
    const querySql = `
      SELECT
        tool_id,
        category,
        semantic_description,
        parameters_json,
        system_prompt
      FROM
        tool_registry_db.duckdb_tools
      WHERE
        tool_id IN (${toolIdList});
    `;

    const result = await this.duckdbConnection.query(querySql).catch((e) => {
      console.error("ToolRetriever: Error fetching tool definitions:", e);
      throw new Error("Failed to fetch tool definitions from DuckDB: " + e.message);
    });

    const tools = [];
    if (result && result.toArray) {
      const toolRows = result.toArray();
      for (const row of toolRows) {
        tools.push({
          name: row.tool_id,
          category: row.category,
          description: row.semantic_description,
          parameters: JSON.parse(row.parameters_json),
          system_prompt: row.system_prompt,
        });
      }
    }
    return tools;
  }
}

export default ToolRetriever;
