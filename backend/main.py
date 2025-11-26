from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
import asyncio
import secrets
import os
import uuid

app = FastAPI()
security = HTTPBasic()
templates = Jinja2Templates(directory="frontend")

# 1. Use environment variable for the password with a default fallback
CORRECT_PASSWORD = os.environ.get("TECHNICIAN_PASSWORD", "your-secure-password")

# In-memory store for single-use tokens. In a real multi-process/multi-server
# setup, this should be a shared store like Redis.
valid_tokens = set()

def verify_password(credentials: HTTPBasicCredentials = Depends(security)):
    """Verifies the password provided via HTTP Basic Auth."""
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

# Manager for connected listeners (remains the same)
class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {"de": [], "en": [], "ru": []}

    async def connect(self, websocket: WebSocket, lang: str):
        await websocket.accept()
        if lang in self.connections:
            self.connections[lang].append(websocket)

    def disconnect(self, websocket: WebSocket, lang: str):
        if lang in self.connections:
            self.connections[lang].remove(websocket)

    async def broadcast(self, message: bytes, lang: str):
        if lang in self.connections:
            for connection in self.connections[lang]:
                await connection.send_bytes(message)

manager = ConnectionManager()

async def process_and_translate(audio_chunk: bytes):
    """Placeholder for the AI pipeline."""
    await manager.broadcast(audio_chunk, "de")
    await asyncio.sleep(0.5)
    await manager.broadcast(audio_chunk, "en")
    await manager.broadcast(audio_chunk, "ru")

# WebSocket for the technician (now with token authentication)
@app.websocket("/ws/technician")
async def ws_technician(websocket: WebSocket, token: str = None):
    """Accepts WebSocket connections if a valid, single-use token is provided."""
    if token is None or token not in valid_tokens:
        await websocket.close(code=4003)
        return

    # Consume the token to prevent reuse
    valid_tokens.remove(token)

    await websocket.accept()
    print("Technician connected with valid token.")
    try:
        while True:
            audio_data = await websocket.receive_bytes()
            asyncio.create_task(process_and_translate(audio_data))
    except WebSocketDisconnect:
        print("Technician disconnected")

# WebSocket for listeners (remains the same)
@app.websocket("/ws/stream/{language}")
async def ws_listener(websocket: WebSocket, language: str):
    if language not in manager.connections:
        await websocket.close(code=1003)
        return
    await manager.connect(websocket, language)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, language)

# --- Frontend Routes ---
@app.get("/")
async def get_listener(request: Request):
    return templates.TemplateResponse("listener.html", {"request": request})

# 2. Modified technician page route
@app.get("/technician", response_class=HTMLResponse)
async def get_technician_page(request: Request, authenticated: bool = Depends(verify_password)):
    """
    After successful basic auth, generate a token and render the technician page,
    passing the token to the template.
    """
    token = str(uuid.uuid4())
    valid_tokens.add(token)
    return templates.TemplateResponse("technician.html", {"request": request, "token": token})

# Mount static files (remains the same)
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
