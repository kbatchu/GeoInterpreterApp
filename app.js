// This function simulates having your geospatial data ready.
// In a real app, this would come from your map library or an API.
function getMapDataAsGeoJSON() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [-74.0060, 40.7128] },
                "properties": {
                    "storeId": "NYC01",
                    "locationType": "Urban Center",
                    "quarterlySales": 120000,
                    "customerTraffic": 15000
                }
            },
            {
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [-73.9857, 40.7484] },
                "properties": {
                    "storeId": "NYC02",
                    "locationType": "Tourist Area",
                    "quarterlySales": 250000,
                    "customerTraffic": 32000
                }
            },
            {
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [-73.9352, 40.7306] },
                "properties": {
                    "storeId": "NYC03",
                    "locationType": "Suburban Residential",
                    "quarterlySales": 85000,
                    "customerTraffic": 9000
                }
            },
            {
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [-74.013, 40.705] },
                "properties": {
                    "storeId": "NYC04",
                    "locationType": "Financial District",
                    "quarterlySales": 310000,
                    "customerTraffic": 21000
                }
            }
        ]
    };
}

// Initialize WebLLM ChatModule instance
const chat = new window.webLLM.ChatModule();
let modelLoaded = false;

// Main function to run our analysis
async function runGeospatialAnalysis() {
    const outputElement = document.getElementById('analysis-output');
    const analyzeButton = document.getElementById('analyze-button');
    const loaderElement = document.getElementById('loader');

    analyzeButton.disabled = true;
    loaderElement.style.display = 'block';
    outputElement.textContent = 'Initializing and loading model... This may take a moment, especially on first run.';

    try {
        // 1. Select a model.
        // Phi-3-mini-4k-instruct-q4f16_1 is a small, capable model.
        // You can find more models at https://mlc.ai/package/
        const selectedModel = "Phi-3-mini-4k-instruct-q4f16_1-MLC";

        chat.setInitProgressCallback(report => {
            outputElement.textContent = report.text;
        });

        if (!modelLoaded) {
            console.log("Loading model for the first time or after unload...");
            await chat.reload(selectedModel);
            modelLoaded = true;
        } else {
            console.log("Model already loaded, resetting chat for new query.");
            await chat.resetChat(); // Reset chat if model was previously loaded
        }
        
        outputElement.textContent = 'Model loaded. Preparing data and prompt...';

        // 2. Get your map data
        const geojsonData = getMapDataAsGeoJSON();

        // 3. Construct a clear, detailed prompt for the LLM
        // Note: For Phi-3, the prompt format is slightly different.
        // It uses <|user|> and <|assistant|> and <|end|> tokens.
        const prompt = `<|user|>\nYou are an expert geospatial business analyst. Your task is to interpret the provided GeoJSON data which represents store locations and their performance metrics.

Analyze the data and provide a concise summary covering the following points:
1. Identify the top-performing store based on quarterly sales.
2. Identify the store with the highest customer traffic.
3. Provide a brief analysis of the relationship between 'locationType' and performance (sales and traffic).
4. Conclude with a strategic recommendation.

Here is the GeoJSON data:
${JSON.stringify(geojsonData, null, 2)}<|end|>\n<|assistant|>\n`;

        // 4. Run the inference
        outputElement.textContent = 'Generating interpretation...';
        
        const generationConfig = {
            temperature: 0.2, // Lower temperature for more factual responses
            max_gen_len: 500, // Maximum number of tokens to generate
            // top_p: (optional)
        };
        
        const reply = await chat.generate(prompt, undefined, 1, generationConfig);

        // 5. Display the result
        outputElement.textContent = reply;

    } catch (err) {
        outputElement.textContent = `Error: ${err.message}. Check the console for more details. Make sure you are serving this page over HTTPS if required by your browser for WebGPU.`;
        console.error("Geospatial Analysis Error:", err);
        modelLoaded = false; // Attempt to reload model on next try if error occurred
    } finally {
        analyzeButton.disabled = false;
        loaderElement.style.display = 'none';
        // To free up significant memory, you can unload the model.
        // However, this means it will need to be re-downloaded/re-initialized on the next click.
        // For frequent use, `chat.resetChat()` (done above if model was loaded) is often enough.
        // If memory is a major concern:
        // await chat.unload();
        // modelLoaded = false;
        // console.log("Model unloaded to free memory.");
    }
}

// Add event listener to the button
document.getElementById('analyze-button').addEventListener('click', runGeospatialAnalysis);
