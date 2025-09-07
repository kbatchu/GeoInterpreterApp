/**
 * @module taginfo_tool
 * This tool interacts with the OpenStreetMap Taginfo API to discover common
 * tags used in combination with a given primary tag. This helps the agent
 * learn how to correctly filter for specific types of amenities.
 *
 * It plays a key role in the "suspicion-driven diagnosis" workflow. When a
 * `find_places_nearby` search fails, the AI is prompted to use this tool
 * to find alternative, potentially more correct, tags to retry the search with.
 */

/**
 * Fetches tag combination data from the Taginfo API.
 * @param {string} key The primary OSM key (e.g., 'amenity').
 * @param {string} value The primary OSM value (e.g., 'hospital').
 * @returns {Promise<object>} The raw JSON response from the API.
 * @private
 */
async function _fetchTagCombinations(key, value) {
  const url = `https://taginfo.openstreetmap.org/api/4/tag/combinations?key=${key}&value=${value}&sortname=together_count&sortorder=desc`;
  console.log(`Taginfo Tool: Querying URL: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GeoInterpreter/1.0 (Agent-based research)",
      },
    });
    if (!response.ok) {
      throw new Error(`Taginfo API request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Taginfo API error:", error);
    return { error: `Failed to fetch data from Taginfo API: ${error.message}` };
  }
}

/**
 * Formats the Taginfo API response into a human-readable string for the LLM.
 * @param {object} data The API response data.
 * @param {string} primaryKey The primary key used in the query.
 * @param {string} primaryValue The primary value used in the query.
 * @returns {string} A formatted string providing guidance.
 * @private
 */
function _formatTagInfoResponse(data, primaryKey, primaryValue) {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    return `No common tag combinations found for ${primaryKey}=${primaryValue}. You may need to search without additional tags.`;
  }

  // Filter for relevant keys and remove generic ones
  const excludedKeys = new Set(['name', 'source', 'website', 'phone', 'opening_hours', primaryKey]);
  const addressPrefix = 'addr:';

  const relevantTags = data.data
    .map(item => item.other_key)
    .filter(key => !excludedKeys.has(key) && !key.startsWith(addressPrefix));

  // Get unique keys
  const uniqueKeys = [...new Set(relevantTags)].slice(0, 5); // Limit to top 5 for brevity

  if (uniqueKeys.length === 0) {
    return `For features tagged with ${primaryKey}=${primaryValue}, the most common additional tags are for basic information like name, address, and phone number. No special filtering tags were found.`;
  }

  const keyList = uniqueKeys.map(k => `'${k}'`).join(', ');
  return `Guidance for ${primaryKey}=${primaryValue}: To add more specific filters, use the 'tags' parameter in the 'find_places_nearby' tool. Common filtering keys for this amenity are: ${keyList}. For example, to find a sushi restaurant, you might use 'tags: { "cuisine": "sushi" }'.`;
}

/**
 * Discovers common OpenStreetMap tags associated with a given amenity to help construct more detailed queries.
 * For example, given 'amenity=restaurant', it can discover that the 'cuisine' tag is commonly used for filtering.
 * @param {object} params The parameters for the tool.
 * @param {string} params.key The primary OSM key to query (e.g., 'amenity', 'leisure').
 * @param {string} params.value The value for the primary key (e.g., 'hospital', 'restaurant', 'pitch').
 * @returns {Promise<string>} A promise that resolves to a string containing guidance on which tags to use.
 */
export async function getOsmTagInfo(params) {
  const { key, value } = params || {};

  if (!key || !value || typeof key !== 'string' || typeof value !== 'string') {
    return "Error: The 'key' and 'value' parameters are required and must be strings.";
  }

  const data = await _fetchTagCombinations(key, value);

  if (data.error) {
    return data.error;
  }

  return _formatTagInfoResponse(data, key, value);
}