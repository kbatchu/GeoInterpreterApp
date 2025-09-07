import { reverseGeocode } from "./geocoding_tool.js";

/**
 * Validates input parameters and extracts with defaults
 * @param {object} params - Input parameters
 * @returns {object} Validated parameters
 * @throws {Error} If required parameters are missing or invalid
 */
function validateAndExtractParams(params) {
    const {
        latitude,
        longitude,
        tags,
        radius_meters = 1000
    } = params || {};

    if (!latitude || !longitude || !tags) {
        throw new Error("Missing required parameters. 'latitude', 'longitude', and 'tags' are required.");
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error('Latitude and longitude must be numbers.');
    }

    if (typeof tags !== 'object' || tags === null || Object.keys(tags).length === 0) {
        throw new Error('Tags must be a non-empty object of key-value pairs.');
    }

    if (typeof radius_meters !== 'number' || radius_meters <= 0) {
        throw new Error('Radius must be a positive number.');
    }

    return {
        latitude,
        longitude,
        tags,
        radius_meters
    };
}


/**
 * Builds the Overpass QL query string
 * @param {object} params - Validated parameters
 * @returns {string} Overpass QL query
 */
function buildOverpassQuery({
    latitude,
    longitude,
    tags,
    radius_meters
}) {
    const filters = Object.entries(tags)
        .map(([key, value]) => `["${key}"="${value}"]`)
        .join('');

    return `
    [out:json][timeout:25];
    (
      node${filters}(around:${radius_meters},${latitude},${longitude});
      way${filters}(around:${radius_meters},${latitude},${longitude});
      relation${filters}(around:${radius_meters},${latitude},${longitude});
    );
    out center;
  `;
}

/**
 * Executes the Overpass API query
 * @param {string} query - The Overpass QL query
 * @returns {Promise<object>} The API response data
 * @throws {Error} If the API request fails
 */
async function executeOverpassQuery(query) {
  const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

  const response = await fetch(OVERPASS_API_URL, {
    method: "POST",
    body: query,
    headers: {
      "Content-Type": "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Overpass API request failed with status ${response.status}: ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Processes the Overpass API results into standardized place objects
 * @param {object} data - The Overpass API response
 * @returns {Promise<Array<object>>} Array of processed place objects
 */
async function processOverpassResults(data) {
  if (!data?.elements || !Array.isArray(data.elements)) {
    return [];
  }

  const nodeElements = data.elements.filter(
    (element) => element.type === "node" && element.tags?.name
  );

  // Process elements in parallel for better performance
  const processedElements = await Promise.allSettled(
    nodeElements.map((element) => processOverpassElement(element))
  );

  // Filter out failed promises and null results
  return processedElements
    .filter((result) => result.status === "fulfilled" && result.value !== null)
    .map((result) => result.value);
}

/**
 * Discovers and lists points of interest (e.g., restaurants, hospitals) near a specified geographic location using OpenStreetMap tags.
 * This tool is designed for finding places based on categories and proximity, not for retrieving the precise street address of a known set of coordinates.
 * 
 * @diagnostic
 * When a search yields no results, the system may enter a diagnostic mode. In this mode,
 * the AI is prompted to use the `getOsmTagInfo` tool to discover more appropriate or
 * alternative tags for the search. It will then re-call this function with the
 * newly discovered tags.
 * 
 * @param {object} params - The parameters for the search.
 * @param {number} params.latitude - The latitude of the center point for the search.
 * @param {number} params.longitude - The longitude of the center point for the search.
 * @param {object} params.tags - A key-value map of OpenStreetMap tags to search for, e.g., {"amenity": "restaurant", "cuisine": "italian"}.
 * @param {number} [params.radius_meters=1000] - The search radius in meters.
 * @returns {Promise<string>} A promise that resolves to a JSON string of found places with their name and coordinates.
 */
export async function findPlacesNearby(params) {
  try {
    // Validate and extract parameters
    const validatedParams = validateAndExtractParams(params);

    // Build and execute query
    const query = buildOverpassQuery(validatedParams);
    const data = await executeOverpassQuery(query);

    // Process results (now async)
    const places = await processOverpassResults(data);

    return formatResults(places, validatedParams.radius_meters);
  } catch (error) {
    console.error("Overpass API error:", error);
    return `Error executing Overpass query: ${error.message}`;
  }
}

/**
 * Processes a single Overpass element into a standardized place object
 * @param {object} element - The Overpass element to process
 * @returns {Promise<object|null>} Processed place object or null if invalid
 */
async function processOverpassElement(element) {
  const { lat, lon, tags } = element;

  // Validate coordinates
  if (!isValidCoordinate(lat) || !isValidCoordinate(lon)) {
    return null;
  }

  // Extract address components (now async)
  const address = await buildAddress(tags, lat, lon);

  // Create base place object
  const placeObject = {
    name: tags.name.trim(),
    latitude: lat,
    longitude: lon,
    address: address,
  };

  // Add non-address tags
  addNonAddressTags(placeObject, tags);

  return placeObject;
}

/**
 * Validates if a value is a valid coordinate
 * @param {any} coordinate - The coordinate to validate
 * @returns {boolean} True if valid coordinate
 */
function isValidCoordinate(coordinate) {
  return (
    typeof coordinate === "number" && !isNaN(coordinate) && isFinite(coordinate)
  );
}

/**
 * Builds an address string from OpenStreetMap address tags
 * @param {object} tags - The tags object containing address information
 * @returns {string} Formatted address string
 */
async function buildAddress(tags, latitude, longitude) {
  if (!tags) {
    return await getReverseGeocodedAddress(latitude, longitude);
  }

  const addressComponents = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
  ];

  // Check if any component is null, undefined, or empty
  const hasIncompleteAddress = addressComponents.some(
    (component) => !component || component.trim() === ""
  );

  if (hasIncompleteAddress) {
    return await getReverseGeocodedAddress(latitude, longitude);
  }

  // Filter out empty components and join
  const validComponents = addressComponents.filter(
    (component) => component && component.trim()
  );

  return validComponents.join(", ");
}

/**
 * Gets address using reverse geocoding with error handling
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @returns {Promise<string>} The reverse geocoded address or empty string on error
 */
async function getReverseGeocodedAddress(latitude, longitude) {
  try {
    const result = await reverseGeocode(latitude, longitude);

    if (result.error) {
      console.warn(`Reverse geocoding failed: ${result.error}`);
      return "";
    }

    return result.address || "";
  } catch (error) {
    console.warn(`Reverse geocoding error: ${error.message}`);
    return "";
  }
}

/**
 * Adds all non-address tags to the place object
 * @param {object} placeObject - The place object to modify
 * @param {object} tags - The tags object to process
 */
function addNonAddressTags(placeObject, tags) {
  const excludedKeys = new Set(["name"]);
  const addressKeyPrefix = "addr:";

  Object.entries(tags).forEach(([key, value]) => {
    if (!excludedKeys.has(key) && !key.startsWith(addressKeyPrefix)) {
      placeObject[key] = value;
    }
  });
}

/**
 * Formats the final results for return
 * @param {Array<object>} places - Array of processed places
 * @param {number} radius_meters - Search radius
 * @returns {string} Formatted result string
 */
function formatResults(places, radius_meters) {
  if (places.length === 0) {
    return `Found 0 places matching the criteria within a ${radius_meters} meter radius.`;
  }

  return JSON.stringify(places, null, 2);
}
