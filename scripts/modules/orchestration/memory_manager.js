// Import the worker - webpack will handle this with worker-loader
import MemoryWorker from "../memory_worker.js";

/**
 * Manages the memory worker, providing a simple async interface for the main thread.
 * This class handles lazy initialization and communication with the worker.
 */
class MemoryManager {
  constructor(progressCallback = null, statusCallback = null) {
    this.worker = null;
    this.isInitialized = false;
    this.progressCallback = progressCallback;
    this.statusCallback = statusCallback;
    this.nextMessageId = 0;
    this.messagePromises = new Map();
  }

  /**
   * Initializes the memory worker. This should be called before any other method.
   * It's safe to call this multiple times; it will only initialize the worker once.
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log("MemoryManager: Initializing worker...");

    try {
      // Create worker using webpack's worker-loader
      this.worker = new MemoryWorker();
      console.log("MemoryManager: Worker created successfully via webpack");
    } catch (error) {
      console.error(
        "MemoryManager: Failed to create worker via webpack:",
        error
      );

      // Fallback to inline worker
      console.log("MemoryManager: Falling back to inline worker");
      const workerCode = `
        console.log("Memory Worker: Hello from the worker!");

        

        self.onmessage = async (event) => {
          const { messageId, command, args } = event.data;
          
          try {
            switch (command) {
              case 'initialize':
                self.postMessage({ messageId, payload: 'initialized' });
                break;
              
              case 'generateEmbedding':
                self.postMessage({ messageId, payload: [] });
                break;
                
              case 'query':
                self.postMessage({ messageId, payload: [] });
                break;
                
              case 'getRelevantTools':
                self.postMessage({ messageId, payload: [] });
                break;
                
              case 'addConversationTurn':
                self.postMessage({ messageId, payload: 'turn added' });
                break;
              
              case 'reset':
                // Implement state reset logic here
                self.postMessage({ messageId, payload: 'reset' });
                break;

              default:
                self.postMessage({
                  messageId,
                  error: 'Unknown command: ' + command,
                });
            }
          } catch (error) {
            self.postMessage({
              messageId,
              error: error.message
            });
          }
        };
`;
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
    }

    this.worker.onmessage = (event) => {
      const { messageId, error, payload, progress } = event.data;

      if (progress !== undefined) {
        if (progress.type === 'status' && this.statusCallback) {
          this.statusCallback(progress.message);
        } else if (this.progressCallback) {
          this.progressCallback(progress);
        }
      }

      if (this.messagePromises.has(messageId)) {
        const { resolve, reject } = this.messagePromises.get(messageId);
        if (error) {
          console.error("MemoryManager: Worker returned an error:", error);
          reject(new Error(error));
        } else {
          resolve(payload);
        }
        this.messagePromises.delete(messageId);
      }
    };

    this.worker.onerror = (error) => {
      console.error("MemoryManager: Worker error details:", error);
      for (const [messageId, { reject }] of this.messagePromises.entries()) {
        reject(
          new Error(
            "Worker error: " + (error.message || "Unknown worker error")
          )
        );
        this.messagePromises.delete(messageId);
      }
    };

    this.worker.onmessageerror = (error) => {
      console.error("MemoryManager: Worker message error:", error);
    };

    try {
      await this._postMessageAsync("initialize");
      this.isInitialized = true;
      console.log("MemoryManager: Worker initialized successfully.");
    } catch (error) {
      console.error("MemoryManager: Failed to initialize worker:", error);
      throw error;
    }
  }

  /**
   * Sends a message to the worker and returns a promise that resolves with the response.
   * @param {string} command The command to send to the worker.
   * @param {object} args The arguments for the command.
   * @returns {Promise<any>}
   * @private
   */
  _postMessageAsync(command, args = {}) {
    return new Promise((resolve, reject) => {
      const messageId = this.nextMessageId++;
      this.messagePromises.set(messageId, { resolve, reject });
      this.worker.postMessage({ messageId, command, args });
    });
  }

  /**
   * Generates an embedding for the given text.
   * @param {string} text The text to embed.
   * @returns {Promise<Array<number>>}
   */
  generateEmbedding(text) {
    return this._postMessageAsync("generateEmbedding", { text });
  }

  /**
   * Queries the DuckDB database.
   * @param {string} sql The SQL query to execute.
   * @returns {Promise<Array<object>>}
   */
  query(sql) {
    return this._postMessageAsync("query", { sql });
  }

  /**
   * Retrieves relevant tools for a given query.
   * @param {string} query The query to find relevant tools for.
   * @param {number} topN The number of tools to retrieve.
   * @param {Array<number>} levels The tool levels to search for.
   * @returns {Promise<Array<object>>}
   */
  getRelevantTools(query, topN, levels) {
    return this._postMessageAsync("getRelevantTools", { query, topN, levels });
  }

  

  /**
   * Adds a conversation turn to the episodic memory.
   * @param {object} turn The conversation turn to add.
   * @returns {Promise<void>}
   */
  addConversationTurn(turn) {
    return this._postMessageAsync("addConversationTurn", { turn });
  }

  /**
   * Retrieves relevant conversation turns for a given query.
   * @param {string} query The query to find relevant conversation for.
   * @param {number} topN The number of conversation turns to retrieve.
   * @returns {Promise<Array<object>>}
   */
  getRelevantConversation(query, topN) {
    return this._postMessageAsync("getRelevantConversation", { query, topN });
  }

  addEntity(entity) {
    return this._postMessageAsync("addEntity", { entity });
  }

  addAttribute(attribute) {
    return this._postMessageAsync("addAttribute", { attribute });
  }

  addGeospatialAttribute(attribute) {
    // Pass the attribute data directly, not nested under 'attribute' key
    return this._postMessageAsync("addGeospatialAttribute", attribute);
  }

  addRelationship(relationship) {
    return this._postMessageAsync("addRelationship", { relationship });
  }

  getEntity(entityId) {
    return this._postMessageAsync("getEntity", { entityId });
  }

  /**
   * Resets the memory worker's state.
   * @returns {Promise<void>}
   */
  reset() {
    return this._postMessageAsync("reset");
  }

  loadOntologies(ontologies) {
    return this._postMessageAsync("loadOntologies", { ontologies });
  }

  queryKuzu(cypher) {
    return this._postMessageAsync("queryKuzu", { cypher });
  }

  executeHybridAnalysis(args) {
    return this._postMessageAsync("executeHybridAnalysis", args);
  }
}

export default MemoryManager;