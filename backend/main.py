from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import asyncio
import secrets

app = FastAPI()
security = HTTPBasic()

# In a real application, use a more secure way to manage credentials
# This is a simple example with a hardcoded password
# You can generate a secure password with: openssl rand -hex 32
CORRECT_PASSWORD = "your-secure-password"  # Please change this!

def verify_password(credentials: HTTPBasicCredentials = Depends(security)):
    current_password_bytes = credentials.password.encode("utf8")
    is_correct_password = secrets.compare_digest(
        current_password_bytes, CORRECT_PASSWORD.encode("utf8")
    )
    if not is_correct_password:
        raise HTTPException(
            status_code=401,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True

# Manager for connected listeners
class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {"de": [], "en": [], "ru": []}

    async def connect(self, websocket: WebSocket, lang: str):
        await websocket.accept()
        if lang in self.connections:
            self.connections[lang].append(websocket)
        else:
            # Handle case where an unsupported language is requested
            await websocket.close(code=4001)

    def disconnect(self, websocket: WebSocket, lang: str):
        if lang in self.connections:
            self.connections[lang].remove(websocket)

    async def broadcast(self, message: bytes, lang: str):
        if lang in self.connections:
            for connection in self.connections[lang]:
                await connection.send_bytes(message)

manager = ConnectionManager()

# AI Pipeline (Placeholder)
# In a real scenario, this would involve complex processing with Whisper, NLLB, Coqui-TTS etc.
# This placeholder simulates the delay and functionality.
async def process_and_translate(audio_chunk: bytes):
    # 1. Broadcast original audio to German listeners
    await manager.broadcast(audio_chunk, "de")

    # 2. Simulate AI processing delay
    await asyncio.sleep(0.5)  # Simulate latency of STT -> Translate -> TTS

    # 3. Create dummy translated audio (e.g., pitched-down version for demo)
    # In reality, this would be the output of your TTS models
    dummy_translated_chunk_en = audio_chunk  # Placeholder
    dummy_translated_chunk_ru = audio_chunk  # Placeholder

    # 4. Broadcast translated audio
    await manager.broadcast(dummy_translated_chunk_en, "en")
    await manager.broadcast(dummy_translated_chunk_ru, "ru")


# WebSocket for the technician (password protected)
@app.websocket("/ws/technician")
async def ws_technician(websocket: WebSocket):
    # Note: FastAPI doesn't directly support Depends in WebSockets in this way.
    # The password check must be handled via query params or initial message.
    # For simplicity, we'll assume the frontend gets the password via the HTML route.
    await websocket.accept()
    print("Technician connected")
    try:
        while True:
            audio_data = await websocket.receive_bytes()
            # Non-blocking call to the AI pipeline
            asyncio.create_task(process_and_translate(audio_data))
    except WebSocketDisconnect:
        print("Technician disconnected")

# WebSocket for the listeners
@app.websocket("/ws/stream/{language}")
async def ws_listener(websocket: WebSocket, language: str):
    if language not in manager.connections:
        await websocket.close(code=1003) # Unsupported data
        return

    await manager.connect(websocket, language)
    print(f"Listener connected for language: {language}")
    try:
        # Keep the connection alive
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, language)
        print(f"Listener disconnected for language: {language}")


# Serve the frontend files
@app.get("/")
async def get_listener():
    return FileResponse("frontend/listener.html")

@app.get("/technician")
async def get_technician_page(authenticated: bool = Depends(verify_password)):
    # This route is now protected by basic auth
    return FileResponse("frontend/technician.html")

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
