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

def verify_password(credentials: HTTPBasicCredentials = Depends(security)):
    """
    Verifies the password provided via HTTP Basic Auth.
    This function now handles both direct credential objects and extracting
    credentials from the request headers.
    """
    if credentials:
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
    return False

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
async def ws_technician(websocket: WebSocket):
    """
    Accepts a WebSocket connection and authenticates it using Basic Auth credentials
    sent in the subprotocol. Rejects if credentials are bad.
    """
    # 1. Extract credentials from the subprotocol
    # Starlette/FastAPI puts the `Sec-WebSocket-Protocol` header here
    subprotocol = websocket.scope.get("subprotocols")
    credentials = None
    if subprotocol:
        # Example format: "Basic, bWVpbnM6bWVpbnM=" -> "bWVpbnM6bWVpbnM="
        auth_part = subprotocol[0].split(',')[-1].strip()
        try:
            # The credentials should be the second part of the subprotocol header
            credentials = HTTPBasicCredentials(authorization=f"Basic {auth_part}")
        except Exception:
            pass  # Invalid format

    # 2. Verify credentials
    try:
        if not credentials or not verify_password(credentials):
            # This is a bit of a hack. `verify_password` raises HTTPException,
            # but we can't propagate that in a WebSocket. We catch it and close.
            await websocket.close(code=1008) # Policy Violation
            return
    except HTTPException:
        await websocket.close(code=1008) # Policy Violation
        return

    # 3. If authentication is successful, proceed
    await websocket.accept(subprotocol=subprotocol[0] if subprotocol else None)
    print("Technician connected with valid credentials.")
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
async def get_technician_page(request: Request):
    """
    Serves the technician page after successful basic auth.
    No token is needed anymore as auth will be handled via subprotocol in WebSocket.
    """
    auth = HTTPBasic()
    credentials = await auth(request)
    if not verify_password(credentials):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return templates.TemplateResponse("technician.html", {"request": request})

# Mount static files (remains the same)
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
