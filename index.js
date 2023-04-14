import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import * as dotenv from 'dotenv';
import process from 'node:process';
import fs from 'fs';
dotenv.config();
// Set the desired polling interval (in milliseconds)
const POLLING_INTERVAL = 120000; // Two minutes
const API_ENDPOINT = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const EARTHQUAKE_IDS_FILE = 'earthquake_ids.txt';
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
            // Read the earthquake IDs from the file
            const existingIds = new Set(fs.readFileSync(EARTHQUAKE_IDS_FILE, 'utf-8').split('\n'));
            // Parse earthquake data
            for (const feature of data.features) {
                const id = feature.id;
                const earthquakeTime = feature.properties.time;
                const location = feature.properties.place;
                // Check if the earthquake ID has not been seen before
                if (!existingIds.has(id)) {
                    const magnitude = feature.properties.mag;
                    const coordinates = feature.geometry.coordinates;
                    const latitude = coordinates[1];
                    const longitude = coordinates[0];
                    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                    // Check if the first word in the location contains "km"
                    const firstWord = location.split(' ')[0];
                    const secondWord = location.split(' ')[1];
                    const prefix = firstWord.includes('km') ? '' : secondWord.includes('km') ? '' : 'in ';
                    const earthquakeDescription = `A ${magnitude} magnitude earthquake occurred ${prefix}${location}. Map: ${googleMapsUrl}`;
                    console.log(earthquakeDescription);
                    // Add the earthquake ID to the existingIds Set
                    existingIds.add(id);
                    // Append the earthquake ID to the file
                    fs.appendFileSync(EARTHQUAKE_IDS_FILE, `${id}\n`);
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
                    console.log(`This earthquake ${location} has already been logged, so we won't post anything to Bluesky.`);
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
