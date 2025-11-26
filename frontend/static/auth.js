// This file contains the logic to securely retrieve credentials
// for WebSocket authentication.

// Function to get credentials and start the WebSocket connection
async function connectWebSocket() {
    // Check if the Credential Management API is available in a secure context
    if (window.isSecureContext && 'credentials' in navigator) {
        try {
            // Use the Credential Management API to get the password
            const cred = await navigator.credentials.get({
                password: true
            });

            if (cred) {
                // If credentials are found, start the streaming process
                startStreamingWithCredentials(cred.id, cred.password);
            } else {
                // Handle cases where no credentials are found
                document.getElementById('status').textContent = 'Fehler: Keine Anmeldeinformationen gefunden.';
                document.getElementById('startButton').disabled = false;
            }
        } catch (e) {
            console.error('Error getting credentials:', e);
            document.getElementById('status').textContent = 'Fehler bei der Anmeldung.';
            document.getElementById('startButton').disabled = false;
        }
    } else {
        // Fallback for insecure contexts (HTTP) or unsupported browsers
        console.warn('Credential Management API not available. Falling back to prompt.');
        const username = prompt('Benutzername eingeben:', 'technician');
        if (username) {
            const password = prompt('Passwort eingeben:');
            if (password) {
                startStreamingWithCredentials(username, password);
            } else {
                document.getElementById('status').textContent = 'Fehler: Passwort erforderlich.';
                document.getElementById('startButton').disabled = false;
            }
        } else {
            document.getElementById('status').textContent = 'Fehler: Benutzername erforderlich.';
            document.getElementById('startButton').disabled = false;
        }
    }
}

// A new function that will be called by auth.js
// This function will replace the direct call to startStreaming in technician.html
function startStreamingWithCredentials(username, password) {
    // Construct the WebSocket URL
    const wsUrl = `ws://${window.location.host}/ws/technician`;

    // New subprotocol format: "basic-auth-BASE64"
    const subprotocol = `basic-auth-${btoa(`${username}:${password}`)}`;

    // Pass the subprotocol in the WebSocket constructor
    webSocket = new WebSocket(wsUrl, [subprotocol]);

    // The rest of the WebSocket handling is in main.js
    setupWebSocketHandlers();
}
