import $ from "jquery";
// 15Apr2024import popper from "popper.js";
// 15Apr2024 import bootstrap from "bootstrap";
import bootstrap from "bootstrap/dist/js/bootstrap";
// 15Apr2024 import Handlebars from "Handlebars";
import Handlebars, { W } from "handlebars/dist/handlebars"; // 15Apr2024
import * as duckdb from "@duckdb/duckdb-wasm";
import * as d3 from "d3";
import HelperUtil from "./modules/helperutils";
// Import WebLLM MLCEngine
import { CreateMLCEngine } from "@mlc-ai/web-llm";

function Geointerpreter() {
  const publicAPI = {};
  let mHelperUtil;
  let mMediator;

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
  };

  async function getDiagnosedDiabetesDataAsGeoJSON() {
    const geojsonData = await mHelperUtil.getJsonFile(
      "data/diagnoseddiabetes_georgia_2020.geojson"
    );
    return geojsonData;
  }

  function getSampleMapDataAsGeoJSON() {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-74.006, 40.7128] },
          properties: {
            storeId: "NYC01",
            locationType: "Urban Center",
            quarterlySales: 120000,
            customerTraffic: 15000,
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
          properties: {
            storeId: "NYC02",
            locationType: "Tourist Area",
            quarterlySales: 250000,
            customerTraffic: 32000,
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-73.9352, 40.7306] },
          properties: {
            storeId: "NYC03",
            locationType: "Suburban Residential",
            quarterlySales: 85000,
            customerTraffic: 9000,
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-74.013, 40.705] },
          properties: {
            storeId: "NYC04",
            locationType: "Financial District",
            quarterlySales: 310000,
            customerTraffic: 21000,
          },
        },
      ],
    };
  }

  // 19Jun2025
  function getSampleMapPromptContent() {
    // Get your map data
    const geojsonData = getSampleMapDataAsGeoJSON();

    // User prompt content
    const userPromptContent = `
          You are an expert epide. Your task is to interpret the provided GeoJSON data which represents store locations and their performance metrics.

          Analyze the data and provide a concise summary covering the following points:
          1. Identify the top-performing store based on quarterly sales.
          2. Identify the store with the highest customer traffic.
          3. Provide a brief analysis of the relationship between 'locationType' and performance (sales and traffic).
          4. Conclude with a strategic recommendation.

          Here is the GeoJSON data:
          ${JSON.stringify(geojsonData, null, 2)}
      `;

    return userPromptContent;
  }

  // 19Jun2025
  async function getDiagnosedDiabetesPromptContent() {
    const geojsonData = await getDiagnosedDiabetesDataAsGeoJSON();
    const MAX_FEATURES_TO_INCLUDE = 5000; // Adjust as needed, start small
    const userPromptContent = `
          You are an expert epidemiologist. Your task is to interpret the provided GeoJSON data which represents Diagnosed Diabetes percentage values for a state of the US.
          The percentage values are provided with the attribute 'Value'.

          Analyze the data and provide a concise summary covering the following points:
          1. Which counties have the highest and lowest diagnosed diabetes percentages?.
          2. Are there noticeable geographic clusters or patterns.         

          Here is the GeoJSON data:
          
          ${JSON.stringify(
            geojsonData.features.length > MAX_FEATURES_TO_INCLUDE
              ? {
                  ...geojsonData,
                  features: geojsonData.features.slice(
                    0,
                    MAX_FEATURES_TO_INCLUDE
                  ),
                  // Optionally, add a note about sampling:
                  // properties: { ...geojsonData.properties, note: `Data is sampled. Showing first ${MAX_FEATURES_TO_INCLUDE} features.` }
                }
              : geojsonData,
            null,
            2
          )}
      `;

    return userPromptContent;
  }

  async function getReActPromptContent() {
    const userPromptContent = `
    Given the user's query, break it down into a logical, step-by-step plan of discrete analytical tasks by using the 'ReAct-Plan-Execute Cycle' approach. Each step should be a self-contained action that can likely be solved by a single tool.
    Question: Show me the top 3 most densely populated neighborhoods that are also within 500 meters of a park`;

    return userPromptContent;
  }

  // Main function to run our analysis
  async function runGeospatialAnalysis() {
    const outputElement = document.getElementById("analysis-output");
    const analyzeButton = document.getElementById("analyze-button");
    let engine; // WebLLM MLCEngine instance

    //  const modelId = "Phi-3-mini-4k-instruct-q4f16_1-MLC";
    // const modelId = "Phi-3-mini-4k-instruct-q4f32_1-MLC";
    //  const modelId = "Llama-3.2-3B-Instruct-q4f32_1-MLC";
    // const modelId = "Mistral-7B-Instruct-q4f32_1-MLC";
    // const modelId = "Qwen2-1.5B-Instruct-q4f32_1-MLC";
    // const modelId = "Qwen2-7B-Instruct-q4f32_1-MLC";

    // const modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; // small-fast
    const modelId = "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC"; // supports OpenAI's API for function calling

    try {
      analyzeButton.disabled = true;
      outputElement.textContent = "Initializing WebLLM engine...";

      // Initialize WebLLM MLCEngine
      engine = await CreateMLCEngine(modelId, {
        // EngineConfig
        initProgressCallback: (report) => {
          // report.progress is a number between 0 and 1
          const percentage = Math.round(report.progress * 100);
          const message = `Loading model <strong>${modelId}</strong>: ${report.text} (${percentage}%)`;
          outputElement.innerHTML = message;
          // console.log(message);
        },
      });

      outputElement.textContent =
        "Model loaded. Analyzing data and generating interpretation...";

      /*  // 19Jun2025
      // Get your map data
      const geojsonData = getSampleMapDataAsGeoJSON();

      // User prompt content
      const userPromptContent = `
          You are an expert geospatial business analyst. Your task is to interpret the provided GeoJSON data which represents store locations and their performance metrics.

          Analyze the data and provide a concise summary covering the following points:
          1. Identify the top-performing store based on quarterly sales.
          2. Identify the store with the highest customer traffic.
          3. Provide a brief analysis of the relationship between 'locationType' and performance (sales and traffic).
          4. Conclude with a strategic recommendation.

          Here is the GeoJSON data:
          ${JSON.stringify(geojsonData, null, 2)}
      `; */

      // 19Jun2025 const userPromptContent = getSampleMapPromptContent(); // 19Jun2025
      // 22Jun2025 const userPromptContent = await getDiagnosedDiabetesPromptContent(); // 19Jun2025
      const userPromptContent = await getReActPromptContent(); // 22Jun2025

      // Prepare messages for the chat completion API
      const messages = [{ role: "user", content: userPromptContent }];

      let startTime; // To record the start time
      let firstChunkTime; // To record the time when the first chunk is processed
      // Run the inference
      outputElement.textContent = "Generating interpretation: "; // Initial message
      let accumulatedResponse = "";

      // Use engine.chat.completions.create for generating chat responses
      const chunks = await engine.chat.completions.create({
        stream: true,
        messages: messages,
        temperature: 0.2,
        max_tokens: 500, // Standard parameter for max generated tokens
        // Other ChatCompletionRequest params can be added here if needed
      });

      // Record the time right before starting to iterate through chunks
      // This is a good proxy for when the generation process effectively starts from the user's perspective.
      startTime = performance.now();

      for await (const chunk of chunks) {
        // Log the entire chunk to see its structure
        // console.log("Received chunk:", JSON.stringify(chunk, null, 2));

        const delta = chunk.choices[0]?.delta?.content;
        // Log the extracted delta
        // console.log("Extracted delta:", delta);
        if (delta) {
          if (!firstChunkTime) {
            // Record the time when the first piece of content is received
            firstChunkTime = performance.now();
          }
          accumulatedResponse += delta;
          // Update UI incrementally
          outputElement.textContent =
            "Generating interpretation: " + accumulatedResponse;
          // Log the accumulated response
          // console.log("Accumulated response:", accumulatedResponse);
        }
      }

      // Display the final result (already handled by the streaming updates)
      // Setting it one last time to ensure the full response is displayed.
      outputElement.textContent = accumulatedResponse;

      if (startTime && firstChunkTime) {
        const timeToFirstChunk = firstChunkTime - startTime;
        console.log(
          `Time to first interpretation chunk: ${timeToFirstChunk.toFixed(2)} ms`
        );
        // Optionally, display this to the user or append to the output
      }
    } catch (error) {
      console.error("Geospatial analysis error:", error);
      outputElement.textContent = `Error: ${error.message || "An unknown error occurred during analysis."}`;
      if (error.message && error.message.includes("Model variant not found")) {
        outputElement.textContent += `\n\nPlease ensure the model ID '${modelId}' is correct and available in WebLLM's model list.`;
      }
    } finally {
      analyzeButton.disabled = false;
      if (engine) {
        console.log("Unloading WebLLM engine...");
        await engine.unload(); // Free up resources
        console.log("WebLLM engine unloaded.");
      }
    }
  }

  publicAPI.init = function () {
    mHelperUtil = new HelperUtil();

    // Add event listener to the button
    const analyzeButton = document.getElementById("analyze-button");
    if (analyzeButton) {
      analyzeButton.addEventListener("click", runGeospatialAnalysis);
    } else {
      console.error("Analyze button not found.");
    }
  };

  return publicAPI;
}
export default Geointerpreter;
