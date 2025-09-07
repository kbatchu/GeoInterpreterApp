// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\testing\relevant_tools_tester.js

import EmbeddingManager from '../modules/orchestration/embedding_manager.js';
import InitializeDuckDB from '../modules/duckdb_init.js';
import ToolRetriever from '../modules/tools/tool_retriever.js';

/**
 * A class to test the relevance of tools retrieved from the tool registry
 * based on a query's vector similarity.
 * This is intended for development and debugging to assess the quality of tool retrieval.
 */
class RelevantToolsTester {
    /**
     * @param {function} [progressCallback] - Optional callback for progress updates during initialization.
     */
    constructor(progressCallback = null) {
        this.embeddingManager = null;
        this.db = null;
        this.dbConn = null;
        this.toolRetriever = null;
        this.progressCallback = progressCallback;
        this.ready = false;
        this.readyPromise = this._initialize();
    }

    /**
     * Initializes all necessary components like EmbeddingManager and DuckDB.
     * @private
     */
    async _initialize() {
        try {
            this._updateProgress("Tester: Initializing...");

            const embeddingProgress = (p) => this._updateProgress(`Embedding Model: ${p.text}`);
            
            this._updateProgress("Tester: Initializing EmbeddingManager...");
            this.embeddingManager = new EmbeddingManager(embeddingProgress);

            this._updateProgress("Tester: Initializing DuckDB...");
            const { db, dbConn } = await InitializeDuckDB();
            this.db = db;
            this.dbConn = dbConn;
            this._updateProgress("Tester: DuckDB Initialized.");

            await this.embeddingManager.readyPromise;
            this._updateProgress("Tester: EmbeddingManager Ready.");

            this.toolRetriever = new ToolRetriever(this.embeddingManager, this.dbConn);
            this._updateProgress("Tester: ToolRetriever Initialized.");

            this.ready = true;
            this._updateProgress("Tester: Initialization complete. Ready for testing.");
        } catch (error) {
            console.error("RelevantToolsTester: Initialization failed.", error);
            this._updateProgress(`Tester: Initialization FAILED. ${error.message}`);
            this.ready = false;
            throw error;
        }
    }

    /**
     * Helper to report progress if a callback is provided.
     * @param {string} text - The progress message.
     * @private
     */
    _updateProgress(text) {
        console.log(text);
        if (this.progressCallback) {
            this.progressCallback({ text });
        }
    }

    /**
     * Finds and returns the most relevant tools for a given query.
     * @param {string} queryText The natural language query to test.
     * @param {number} [topN=10] The number of tools to retrieve.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of relevant tools with their similarity scores.
     */
    async findRelevantTools(queryText, topN = 10) {
        if (!this.ready) {
            await this.readyPromise;
        }

        console.log(`\n--- Testing query: "${queryText}" ---`);
        const tools = await this.toolRetriever.getRelevantTools(queryText, topN);
        console.log(`Found ${tools.length} relevant tools:`);
        tools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name} (Similarity: ${tool.similarity.toFixed(4)})`);
            console.log(`   Description: ${tool.description}`);
        });
        return tools;
    }
}

export default RelevantToolsTester;