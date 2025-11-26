// Globale Variablen
let audioContext;
let scriptProcessor;
let mediaStreamSource;
let webSocket;

// Funktion für die Techniker-Seite
async function startStreaming() {
    const wsUrl = `ws://${window.location.host}/ws/technician`;
    webSocket = new WebSocket(wsUrl);

    webSocket.onopen = async () => {
        console.log("WebSocket connection established.");
        document.getElementById('status').textContent = 'Status: Verbunden. Starte Audio...';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            mediaStreamSource = audioContext.createMediaStreamSource(stream);

            scriptProcessor.onaudioprocess = (event) => {
                if (webSocket.readyState === WebSocket.OPEN) {
                    const inputData = event.inputBuffer.getChannelData(0);
                    // Sende die rohen Float32-Daten
                    webSocket.send(inputData.buffer);
                }
            };

            mediaStreamSource.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination); // Notwendig, damit onaudioprocess feuert

            document.getElementById('status').textContent = 'Status: Übertragung läuft...';

        } catch (error) {
            console.error("Error accessing microphone:", error);
            document.getElementById('status').textContent = 'Fehler: Mikrofonzugriff verweigert.';
            webSocket.close();
        }
    };

    webSocket.onclose = () => {
        console.log("WebSocket connection closed.");
        document.getElementById('status').textContent = 'Status: Verbindung getrennt.';
        document.getElementById('startButton').disabled = false;
        if (scriptProcessor) scriptProcessor.disconnect();
        if (mediaStreamSource) mediaStreamSource.disconnect();
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

    // Initialisiere den AudioContext erst bei einer User-Aktion (Klick)
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

        // Erstelle einen AudioBuffer und fülle ihn
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, audioContext.sampleRate);
        audioBuffer.copyToChannel(float32Array, 0);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTime);

        source.start(startTime);

        // Plane die nächste Wiedergabezeit
        nextPlayTime = startTime + audioBuffer.duration;

        source.onended = () => {
            isPlaying = false;
            // Spiele das nächste Stück in der Warteschlange ab
            schedulePlayback();
        };
    }

    socket.onmessage = async (event) => {
        // Empfange die ArrayBuffer Daten und füge sie zur Warteschlange hinzu
        audioQueue.push(event.data);
        schedulePlayback();
    };

    socket.onopen = () => {
        console.log(`Connected to ${language} stream.`);
    };

    socket.onclose = () => {
        console.log(`Disconnected from ${language} stream.`);
    };

    return socket; // Gib das Socket-Objekt zurück, um es zu verwalten
}
