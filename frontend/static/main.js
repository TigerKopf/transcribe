// Globale Variablen
let audioContext;
let webSocket;
let audioWorkletNode;
let mediaStreamSource;

// Funktion für die Techniker-Seite
function setupWebSocketHandlers() {
    webSocket.onopen = async () => {
        console.log("WebSocket connection established.");
        document.getElementById('status').textContent = 'Status: Verbunden. Starte Audio...';

        try {
            // 1. Initialisiere AudioContext und lade das Worklet-Modul
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.audioWorklet.addModule('/static/audio-processor.js');

            // 2. Erstelle den AudioWorkletNode
            audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-data-processor');

            // 3. Richte die Kommunikation vom Worklet zum Haupt-Thread ein
            audioWorkletNode.port.onmessage = (event) => {
                if (webSocket.readyState === WebSocket.OPEN) {
                    // Die Daten sind bereits ein ArrayBuffer, also direkt senden
                    webSocket.send(event.data);
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamSource = audioContext.createMediaStreamSource(stream);

            // 4. Verbinde die Audio-Quelle mit dem Worklet
            mediaStreamSource.connect(audioWorkletNode);
            // Das Worklet muss mit dem Destination verbunden sein, um die process-Methode auszulösen
            audioWorkletNode.connect(audioContext.destination);

            document.getElementById('status').textContent = 'Status: Übertragung läuft...';

        } catch (error) {
            console.error("Error setting up audio processing:", error);
            document.getElementById('status').textContent = `Fehler: ${error.message}`;
            webSocket.close();
        }
    };

    webSocket.onclose = () => {
        console.log("WebSocket connection closed.");
        document.getElementById('status').textContent = 'Status: Verbindung getrennt.';
        document.getElementById('startButton').disabled = false;
        // Clean up audio resources
        if (mediaStreamSource) mediaStreamSource.disconnect();
        if (audioWorkletNode) audioWorkletNode.disconnect();
    };

    webSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        document.getElementById('status').textContent = 'Status: WebSocket Fehler.';
    };
}

// Funktion für die Zuhörer-Seite
function listen(language) {
    const wsUrl = `ws://${window.location.host}/ws/stream/${language}`;
    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    let audioQueue = [];
    let isPlaying = false;
    let nextPlayTime = 0;

    function schedulePlayback() {
        if (audioQueue.length === 0 || isPlaying) {
            return;
        }

        isPlaying = true;
        const data = audioQueue.shift();
        const float32Array = new Float32Array(data);

        const audioBuffer = audioContext.createBuffer(1, float32Array.length, audioContext.sampleRate);
        audioBuffer.copyToChannel(float32Array, 0);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTime);

        source.start(startTime);

        nextPlayTime = startTime + audioBuffer.duration;

        source.onended = () => {
            isPlaying = false;
            schedulePlayback();
        };
    }

    socket.onmessage = async (event) => {
        audioQueue.push(event.data);
        schedulePlayback();
    };

    socket.onopen = () => console.log(`Connected to ${language} stream.`);
    socket.onclose = () => console.log(`Disconnected from ${language} stream.`);

    return socket;
}
