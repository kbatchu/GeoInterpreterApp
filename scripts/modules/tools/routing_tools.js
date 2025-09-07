/**
 * @file Contains custom JavaScript tools related to routing and navigation.
 */

/**
 * Calculates real-world travel distance and time from an origin to one or more destinations
 * using the public OSRM (Open Source Routing Machine) API.
 *
 * IMPORTANT: The public OSRM demo server has usage policies and is not intended for
 * heavy, production-level traffic.
 *
 * @param {object} params - The parameters for the tool, matching the JSON schema in tool_descriptions.csv.
 * @param {{latitude: number, longitude: number}} params.origin - The starting point.
 * @param {Array<{name?: string, latitude: number, longitude: number}>} params.destinations - An array of destination points.
 * @param {'driving' | 'walking' | 'cycling'} [params.travel_mode='driving'] - The mode of travel.
 * @returns {Promise<string>} A JSON string of the results with distance and duration for each destination, sorted by the quickest travel time.
 */
export async function calculate_route_details({ origin, destinations, travel_mode = 'driving' }) {
    // OSRM API uses {lon},{lat} format for coordinates
    const originCoords = `${origin.longitude},${origin.latitude}`;
    
    // OSRM supports different profiles (car, foot, bike) which map well to our travel modes
    const profile = travel_mode === 'driving' ? 'driving' : travel_mode;

    const results = [];

    // We will send a request for each destination. For a large number of destinations,
    // OSRM's 'table' service would be more efficient, but individual 'route' requests are
    // simpler to handle and provide more detail for the AI to use.
    for (const dest of destinations) {
        const destCoords = `${dest.longitude},${dest.latitude}`;
        // The OSRM route service URL format
        const url = `https://router.project-osrm.org/route/v1/${profile}/${originCoords};${destCoords}?overview=false`;

        try {
            console.log(`Fetching route from: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`OSRM API request failed for destination ${dest.name || destCoords}: ${response.statusText}`);
                continue; // Log a warning but don't stop the whole process if one route fails
            }
            const data = await response.json();

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                results.push({
                    name: dest.name || 'Unnamed Destination',
                    distance_meters: route.distance, // OSRM provides distance in meters
                    duration_seconds: route.duration, // OSRM provides duration in seconds
                    travel_time: `${Math.round(route.duration / 60)} minutes`, // User-friendly string for the AI
                });
            }
        } catch (error) {
            console.error(`Error fetching route for ${dest.name || destCoords}:`, error);
        }
    }

    if (results.length === 0) {
        return "Could not calculate routes for any of the provided destinations. The routing service might be unavailable or the locations may be unreachable.";
    }

    // Sort results by duration to make it easy for the AI to find the 'nearest' (quickest) option
    results.sort((a, b) => a.duration_seconds - b.duration_seconds);

    // Return a JSON string. The AI can parse this in its next thought/action cycle to provide a final answer.
    return JSON.stringify(results, null, 2);
}