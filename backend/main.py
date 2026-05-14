from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.ws_handler import audio_websocket_handler

app = FastAPI(title="HaptiQ Backend")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to HaptiQ API"}

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await audio_websocket_handler(websocket)
