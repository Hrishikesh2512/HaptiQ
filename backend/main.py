from fastapi import FastAPI, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.api.ws_handler import audio_websocket_handler
from app.db import models, database
from app.db.database import engine, get_db
from sqlalchemy.orm import Session
from fastapi import Depends

# Create database tables
models.Base.metadata.create_all(bind=engine)

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

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    alerts = db.query(models.SoundAlert).order_by(models.SoundAlert.timestamp.desc()).limit(50).all()
    return [alert.to_dict() for alert in alerts]

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await audio_websocket_handler(websocket)
