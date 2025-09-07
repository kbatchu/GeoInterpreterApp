// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\tooling\embedding_manager.js
import { pipeline } from '@xenova/transformers';

/**
 * Manages the loading and usage of a sentence-transformer model for generating embeddings.
 */
class EmbeddingManager {
  /**
   * @param {function} [progressCallback=null] - A callback function to receive progress updates.
   * @param {string} [model='Xenova/all-MiniLM-L6-v2'] The name of the model to use from Hugging Face.
   */
  constructor(progressCallback = null, model = 'Xenova/all-MiniLM-L6-v2') {
    this.model = model;
    this.pipeline = null;
    this.progressCallback = progressCallback;
    this.ready = false;
    // A promise that resolves when the model is ready.
    this.readyPromise = this._initialize();
  }

  /**
   * Initializes the feature-extraction pipeline from transformers.js.
   * This is called internally by the constructor.
   * @private
   */
  async _initialize() {
    try {
      console.log(`EmbeddingManager: Initializing model '${this.model}'...`);

      // The progress callback for the pipeline function.
      const progress_callback = (data) => {
        if (this.progressCallback) {
          // Adapt the progress report to the format expected by the main script.
          const report = { 
            text: data.status,
            progress: undefined,
          };

          if (typeof data.progress === 'number') {
            report.progress = data.progress / 100;
          } else if (data.status === 'done' || data.status === 'ready') {
            report.progress = 1;
          }
          this.progressCallback(report);
        }
      };
      this.pipeline = await pipeline('feature-extraction', this.model, { progress_callback });
      this.ready = true;
      console.log("EmbeddingManager: Model ready.");
    } catch (error) {
      console.error("EmbeddingManager: Failed to initialize model", error);
      this.ready = false;
      throw error;
    }
  }

  /**
   * Generates a vector embedding for the given text.
   * @param {string} text - The text to embed.
   * @returns {Promise<Array<number>>} A promise that resolves to the embedding vector.
   */
  async generateEmbedding(text) {
    if (!this.ready) {
      await this.readyPromise;
    }
    if (!this.pipeline) {
      throw new Error("EmbeddingManager: Pipeline is not initialized. Check for initialization errors.");
    }

    const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

export default EmbeddingManager;
