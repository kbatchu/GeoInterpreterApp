import StateManager from '../orchestration/state_manager.js';

const stateManager = new StateManager();

/**
 * Helper function to perform a search against the Nominatim API with retry logic.
 * Implements exponential backoff with jitter for rate limiting and transient network errors.
 * @param {string} query The search query.
 * @param {number} [maxRetries=3] Maximum number of retries.
 * @param {number} [initialDelayMs=1000] Initial delay in milliseconds before the first retry.
 * @returns {Promise<object[]|{error: string}|null>} A promise that resolves to an array of results, an error object, or null.
 * @private
 */
async function _nominatimSearch(query, maxRetries = 3, initialDelayMs = 1000) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`;
  console.log(`Geocoding: Querying Nominatim with URL: ${url}`);

  let retries = 0;
  let delay = initialDelayMs;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GeoInterpreter/1.0 (https://github.com/your-repo/your-app)"
        }
      });

      if (response.status === 429) { // Too Many Requests
        console.warn(`Nominatim API rate limit hit for query "${query}". Retrying in ${delay}ms...`);
        retries++;
        delay = Math.min(delay * 2, 30000); // Exponential backoff, cap at 30 seconds
        const jitter = Math.random() * 500; // Add up to 500ms jitter
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        continue; // Try again
      }

      if (!response.ok) {
        console.error(`Nominatim API request failed for query "${query}" with status: ${response.status}`);
        return null; // Non-retryable HTTP error
      }

      return await response.json();
    } catch (error) {
      console.error(`An error occurred during Nominatim search for query "${query}":`, error);
      if (retries < maxRetries) {
        console.warn(`Network error for query "${query}". Retrying in ${delay}ms...`);
        retries++;
        delay = Math.min(delay * 2, 30000); // Exponential backoff, cap at 30 seconds
        const jitter = Math.random() * 500; // Add up to 500ms jitter
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        continue; // Try again
      } else {
        // Return a specific error object for network-related issues after all retries
        return { error: `Network error during geocoding: ${error.message}. Please check your internet connection or try again later.` };
      }
    }
  }
  // If all retries fail
  return { error: `Geocoding failed for query "${query}" after ${maxRetries} retries due to persistent issues.` };
}

/**
 * Geocodes a street address using the Nominatim API.
 * It attempts to find the address, and if it fails, it retries with a less specific query (without the house number).
 * @param {string} address The street address to geocode.
 * @returns {Promise<object>} A promise that resolves to an object containing latitude and longitude, or an error.
 */
export async function geocodeAddress(address, maxRetries = 3, initialDelayMs = 1000) {
  if (!address || typeof address !== "string") {
    return { error: "Invalid address provided. Please provide a valid street address as a string." };
  }

  // This regex looks for two numbers (integer or float, possibly negative) separated by a comma.
  // It's a simple check to prevent misuse of the tool with coordinates.
  const coordRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (coordRegex.test(address.trim())) {
      return { error: `Invalid input: "${address}" looks like coordinates. To convert coordinates to a text address, you MUST use the 'reverse_geocode' tool.` };
  }

  const sanitizedAddress = address.replace(/-/g, ' ');

  // --- Attempt 1: Use the full address ---
  let data = await _nominatimSearch(sanitizedAddress, maxRetries, initialDelayMs);

  // If a network error occurred, return it immediately
  if (data && data.error) {
    return { error: data.error };
  }

  // --- Attempt 2: If no results, try again without the leading house number ---
  if (!data || data.length === 0) {
    console.warn(`Geocoding failed for full address: "${sanitizedAddress}". Retrying without house number.`);
    // This regex removes a sequence of digits at the start of the string, plus any following whitespace.
    const addressWithoutNumber = sanitizedAddress.replace(/^\d+\s+/, '');

    // Only retry if the address actually changed (i.e., it had a house number)
    if (addressWithoutNumber !== sanitizedAddress) {
      data = await _nominatimSearch(addressWithoutNumber, maxRetries, initialDelayMs);
      // If a network error occurred during retry, return it immediately
      if (data && data.error) {
        return { error: data.error };
      }
    }
  }

  if (data && data.length > 0) {
    console.log(`Geocoding successful for "${address}". Found: ${data[0].display_name}`);
    const result = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    stateManager.updateState({ currentLocation: result }); // Store geocoded location
    return result;
  } else {
    // If all attempts fail, return the error.
    console.error(`Geocoding failed for all attempts for address: "${address}"`);
    return { error: `No results found for address: "${address}"` };
  }
}

/**
 * Converts geographic coordinates (latitude and longitude) into a precise street address.
 * This tool is ideal for obtaining the exact address of a known location when its coordinates are available.
 * @param {number} latitude The latitude to reverse geocode.
 * @param {number} longitude The longitude to reverse geocode.
 * @returns {Promise<object>} A promise that resolves to an object containing the address string.
 */
export async function reverseGeocode(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return { error: "Invalid coordinates provided. Please provide valid latitude and longitude as numbers." };
  }

  // Nominatim API Usage Policy requires a custom User-Agent.
  // See: https://operations.osmfoundation.org/policies/nominatim/
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GeoInterpreter/1.0 (https://github.com/your-repo/your-app)" // Replace with your app's info
      }
    });

    if (!response.ok) {
      return { error: `Nominatim API request failed with status: ${response.status}` };
    }

    const data = await response.json();

    if (data && data.display_name) {
      return { address: data.display_name };
    } else if (data.error) {
      return { error: `Nominatim API error: ${data.error}` };
    } else {
      return { error: `No address found for coordinates: lat=${latitude}, lon=${longitude}` };
    }
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return { error: `An error occurred during reverse geocoding: ${error.message}` };
  }
}