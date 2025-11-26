// This file contains the logic to securely retrieve credentials
// for WebSocket authentication.

// Function to get credentials and start the WebSocket connection
async function connectWebSocket() {
    try {
        // Use the Credential Management API to get the password
        const cred = await navigator.credentials.get({
            password: true
        });

        if (cred) {
            // If credentials are found, start the streaming process
            // The 'startStreaming' function is defined in main.js
            startStreamingWithCredentials(cred.id, cred.password);
        } else {
            // Handle cases where no credentials are found
            document.getElementById('status').textContent = 'Fehler: Keine Anmeldeinformationen gefunden.';
        }
    } catch (e) {
        console.error('Error getting credentials:', e);
        document.getElementById('status').textContent = 'Fehler bei der Anmeldung.';
    }
}

// A new function that will be called by auth.js
// This function will replace the direct call to startStreaming in technician.html
function startStreamingWithCredentials(username, password) {
    // Construct the WebSocket URL
    const wsUrl = `ws://${window.location.host}/ws/technician`;

    // Create the subprotocol value for Basic Authentication
    const subprotocol = `Basic, ${btoa(`${username}:${password}`)}`;

    // Pass the subprotocol in the WebSocket constructor
    webSocket = new WebSocket(wsUrl, [subprotocol]);

    // The rest of the WebSocket handling is in main.js
    setupWebSocketHandlers();
}
