/**
 * @module Geolocation
 * @description Provides methods to obtain the user's geographical location using a
 * fallback strategy: first, it tries the high-accuracy Browser Geolocation API,
 * and if that fails or is denied, it falls back to a less-accurate IP-based lookup.
 *
 * Best Practice: Use the `getUserLocation()` method for general-purpose location
 * fetching, as it encapsulates the recommended fallback and error handling logic.
 */
function Geolocation() {
  const publicAPI = {};
  let mMediator; // Not used but good to have for consistency

  publicAPI.setMediator = function (m) {
    mMediator = m;
  };
  publicAPI.getMediator = function () {
    return mMediator;
  };

  /**
   * Attempts to get the user's location by first trying the highly accurate
   * Browser Geolocation API, and falling back to the less accurate IP-based
   * geolocation if the first attempt fails. This is the recommended function to use.
   *
   * @param {object} [options] - Configuration options.
   * @param {string[]} [options.priority=['browser', 'ip']] - The order of methods to try.
   * @returns {Promise<object>} A promise that resolves with a normalized location object.
   *   The object will have a `source` property ('browser' or 'ip') and location data.
   */
  publicAPI.getUserLocation = async function (options = {}) {
    const { priority = ["browser", "ip"] } = options;

    for (const method of priority) {
      try {
        if (method === "browser") {
          const position = await publicAPI.getBrowserGeolocation();
          console.log("Geolocation: Obtained location via Browser API.");
          return {
            source: "browser",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, // in meters
            raw: position, // include original object
          };
        } else if (method === "ip") {
          const ipLocation = await publicAPI.getIPGeolocation();
          console.log("Geolocation: Obtained location via IP address.");
          return {
            source: "ip",
            latitude: ipLocation.lat,
            longitude: ipLocation.lon,
            accuracy: null, // IP-based location doesn't provide an accuracy radius
            city: ipLocation.city,
            country: ipLocation.country,
            raw: ipLocation, // include original object
          };
        }
      } catch (error) {
        console.warn(`Geolocation: Method '${method}' failed:`, error.message);
        // Continue to the next method in the priority list.
      }
    }

    // If all methods in the priority list have failed.
    throw new Error(
      "All geolocation methods failed. Please consider providing location manually."
    );
  };

  /**
   * Gets the user's geolocation using the browser's Geolocation API.
   * This is the most accurate method. It is recommended to use `getUserLocation`
   * which uses this function as part of a fallback strategy.
   *
   * @returns {Promise<GeolocationPosition>} A promise that resolves with the
   *   GeolocationPosition object on success, or rejects with an Error on failure.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
   */
  publicAPI.getBrowserGeolocation = function () {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(
          new Error("Geolocation is not supported by your browser.")
        );
      }

      const options = {
        enableHighAccuracy: true, // Use GPS if available
        timeout: 10000, // 10 seconds before timing out
        maximumAge: 0, // Do not use a cached position
      };

      const onSuccess = (position) => {
        resolve(position);
      };

      const onError = (error) => {
        let errorMessage = "An unknown error occurred.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "User denied the request for Geolocation.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        }
        reject(new Error(errorMessage));
      };

      navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    });
  };

  /**
   * Gets an estimated geolocation based on the user's public IP address
   * by calling a third-party API. This is less accurate than the Geolocation API
   * and should be used as a fallback.
   *
   * @returns {Promise<object>} A promise that resolves with the location data object from the API.
   */
  publicAPI.getIPGeolocation = async function () {
    try {
      // There are many services available, e.g., ip-api.com, geo.ipify.org, freegeoip.app.
      // Be sure to check their terms of service and rate limits.
      const response = await fetch("https://ip-api.com/json");

      if (!response.ok) {
        throw new Error(
          `Failed to fetch IP geolocation: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.status === "fail") {
        throw new Error(
          `IP Geolocation API error: ${data.message || "Unknown error"}`
        );
      }

      return data;
    } catch (error) {
      console.error("Could not retrieve IP geolocation:", error);
      throw error; // Re-throw the error for the caller to handle
    }
  };

  publicAPI.init = function () {
    console.log("Geolocation module initialized.");
  };

  return publicAPI;
}

export default Geolocation;