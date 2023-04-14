import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();
// Set the desired polling interval (in milliseconds)
const POLLING_INTERVAL = 120000; // Two minutes
const API_ENDPOINT = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
// Create a Bsky Agent 
const agent = new BskyAgent({
    service: 'https://bsky.social',
});
await agent.login({
    identifier: process.env.BSKY_USERNAME,
    password: process.env.BSKY_PASSWORD,
});
// Define the polling function
async function pollApi() {
    try {
        // Request data from the API endpoint
        const response = await fetch(API_ENDPOINT);
        // Check if the response is successful
        if (response.ok) {
            const data = await response.json();
            // Get the current time minus two minutes
            const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
            // Parse earthquake data
            for (const feature of data.features) {
                const earthquakeTime = feature.properties.time;
                const location = feature.properties.place;
                // Check if the earthquake happened within the last two minutes
                if (earthquakeTime >= twoMinutesAgo) {
                    console.log("Recent earthquake occured:");
                    const magnitude = feature.properties.mag;
                    const coordinates = feature.geometry.coordinates;
                    const latitude = coordinates[1];
                    const longitude = coordinates[0];
                    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                    // Check if the first word in the location contains "km"
                    const firstWord = location.split(' ')[0];
                    const prefix = firstWord.includes('km') ? '' : 'in';
                    const earthquakeDescription = `A ${magnitude} magnitude earthquake occurred ${prefix}${location}. Map: ${googleMapsUrl}`;
                    console.log(earthquakeDescription);
                    await agent.post({
                        text: earthquakeDescription,
                        entities: [
                            {
                                index: { start: earthquakeDescription.indexOf('Map: ') + 5, end: earthquakeDescription.indexOf(googleMapsUrl) + googleMapsUrl.length + 1 },
                                type: 'link',
                                value: googleMapsUrl,
                            },
                        ],
                        embed: {
                            $type: 'app.bsky.embed.external',
                            external: {
                                uri: googleMapsUrl,
                                title: "Earthquake coordinates",
                                description: "Earthquake coordinates",
                            },
                        },
                    });
                }
                else {
                    console.log(`This earthquake ${location} happened a while ago, so we won't post anything.`);
                }
            }
        }
        else {
            console.error(`API error: ${response.status}`);
        }
    }
    catch (error) {
        console.error('Error fetching data:', error);
    }
    // Continue polling
    setTimeout(pollApi, POLLING_INTERVAL);
}
// Start polling the API
pollApi();
