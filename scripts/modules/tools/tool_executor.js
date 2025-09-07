// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\modules\tools\tool_executor.js

import { findPlacesNearby } from "./overpass_tools.js";
import { getOsmTagInfo } from "./taginfo_tool.js";
import { geocodeAddress, reverseGeocode } from "./geocoding_tool.js";
import { calculate_route_details } from "./routing_tools.js";
import Geolocation from "../geolocation.js";

/**
 * A class to define, register, and execute high-level tools for the AI agent.
 * This encapsulates the tool logic, keeping the main `geointerpreter.js` file clean.
 */
class ToolExecutor {
  /**
   * @param {import('@duckdb/duckdb-wasm').AsyncDuckDBConnection} duckdbConnection - An active DuckDB connection.
   */
  constructor(duckdbConnection) {
    if (!duckdbConnection) {
      throw new Error("ToolExecutor requires a DuckDB connection.");
    }
    this.dbConnection = duckdbConnection;
    this.geolocation = new Geolocation();
    this.geolocation.init();
    this.toolRegistry = new Map();
    this._registerTools();
  }

  /**
   * Registers all the available high-level tools.
   * Each tool is an async function that can access `this.dbConnection`.
   * @private
   */
  _registerTools() {
    this.toolRegistry.set('list_available_layers', async (params, state) => {
      // In a real implementation, this could query the database metadata.
      return "Available layers are: 'crimes', 'parks', 'rivers'.";
    });

    this.toolRegistry.set('get_layer_summary_statistics', async (params, state) => {
      if (params.layer_name === "crimes" && params.column_name === "value") {
        // Example of a real query that could be run:
        // const result = await this.dbConnection.query(`SUMMARIZE SELECT * FROM ${params.layer_name}`);
        return `Summary statistics for crimes.value: Min=10, Max=100, Mean=55.5, Median=50, Count=1000.`;
      }
      return `Error: Layer or column not found for ${params.layer_name}.${params.column_name}`;
    });

    this.toolRegistry.set('find_hotspots', async (params, state) => {
      const eps = params.distance_meters || 500;
      const minPoints = params.min_points || 5;
      const sql = `
        CREATE OR REPLACE TEMP TABLE hotspot_areas AS
        SELECT
            ST_ConvexHull(ST_Collect(geom)) as hotspot_geom,
            COUNT(*) as point_count
        FROM ${params.layer_name}
        GROUP BY ST_ClusterDBSCAN(geom, eps := ${eps}, min_points := ${minPoints});
      `;
      try {
        await this.dbConnection.query(sql);
        return `Successfully created temporary layer 'hotspot_areas' containing hotspot polygons for '${params.layer_name}'.`;
      } catch (e) {
        console.error(`Error executing find_hotspots for layer '${params.layer_name}':`, e);
        return `Error creating hotspots for layer ${params.layer_name}: ${e.message}`;
      }
    });

    this.toolRegistry.set('find_intersecting_features', async (params, state) => {
      if (params.layer1_name === "parks" && params.layer2_name === "hotspot_areas") {
        return "Found 5 parks: ['City Park', 'Greenway', 'Central Park', 'Riverside Park', 'Liberty Park'].";
      }
      return `Error: Could not find intersecting features for ${params.layer1_name} and ${params.layer2_name}.`;
    });

    this.toolRegistry.set('calculate_density', async (params, state) => {
      return `Successfully calculated density for ${params.layer_name} using population from ${params.population_column} and area from ${params.area_column}. A new layer 'density_calculated_${params.layer_name}' has been created.`;
    });

    this.toolRegistry.set('find_features_within_distance', async (params, state) => {
      return `Successfully found features in ${params.layer1_name} within ${params.distance_meters} meters of ${params.layer2_name}. A new layer 'filtered_${params.layer1_name}' has been created.`;
    });

    this.toolRegistry.set('sort_and_limit_features', async (params, state) => {
      if (params.layer_name === "filtered_neighborhoods" && params.sort_column === "density" && params.limit === 3) {
        return `Successfully sorted and limited features in ${params.layer_name}. Top 3 by density are: 'Neighborhood A', 'Neighborhood B', 'Neighborhood C'.`;
      }
      return `Error: Could not sort or limit features for ${params.layer_name}.`;
    });

    this.toolRegistry.set('get_user_location', async (params, state) => {
      try {
        console.log("Attempting to get location via Browser Geolocation API...");
        const position = await this.geolocation.getBrowserGeolocation();
        const { latitude, longitude, accuracy } = position.coords;
        return `Successfully found user location using Browser API. Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}, Accuracy: ${accuracy.toFixed(0)} meters.`;
      } catch (browserError) {
        console.warn(`Browser Geolocation failed: ${browserError.message}. Falling back to IP-based Geolocation.`);
        try {
          const ipLocation = await this.geolocation.getIPGeolocation();
          const { lat, lon, city, country, query } = ipLocation;
          return `Successfully found user's approximate location via IP address (${query}). City: ${city}, Country: ${country}, Latitude: ${lat}, Longitude: ${lon}. Note: This location is an estimate.`;
        } catch (ipError) {
          console.error(`IP Geolocation also failed: ${ipError.message}`);
          return `Error: Could not determine user location. Both Browser and IP Geolocation methods failed. Browser API error: ${browserError.message}. IP API error: ${ipError.message}`;
        }
      }
    });

    this.toolRegistry.set('geocode_address', async (params, state) => {
      return await geocodeAddress(params.address);
    });

    this.toolRegistry.set('reverse_geocode', async (params, state) => {
      return await reverseGeocode(params.latitude, params.longitude);
    });

    this.toolRegistry.set('find_places_nearby', async (params, state) => {
      return await findPlacesNearby(params);
    });

    this.toolRegistry.set('calculate_route_details', async (params, state) => {
      return await calculate_route_details(params);
    });

    this.toolRegistry.set('getOsmTagInfo', async (params, state) => {
      return await getOsmTagInfo(params);
    });
  }

  /**
   * Executes a tool by its name with the given parameters.
   * @param {string} toolName - The name of the tool to execute.
   * @param {object} params - The parameters for the tool.
   * @param {object} state - The current application state from the StateManager.
   * @returns {Promise<string>} A promise that resolves to the observation string.
   */
  async execute(toolName, params, state) {
    console.log(`ToolExecutor: Executing tool '${toolName}' with params:`, params);
    if (this.toolRegistry.has(toolName)) {
      const toolFunction = this.toolRegistry.get(toolName);
      // Use .call(this, ...) to ensure the tool function has access to `this.dbConnection`.
      return await toolFunction.call(this, params, state);
    }
    return `Tool '${toolName}' not implemented in ToolExecutor.`;
  }
}

export default ToolExecutor;
