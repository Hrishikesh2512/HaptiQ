from fastapi import WebSocket
import asyncio
import numpy as np
from app.utils.audio_processing import process_audio_chunk
from app.models.yamnet import get_classifier
import json

# Sounds we care about for the MVP
CRITICAL_SOUNDS = {
    "Alarm", "Siren", "Horn", "Vehicle horn", "Emergency vehicle",
    "Doorbell", "Baby cry", "Crying", "Dog", "Bark", "Speech"
}

async def audio_websocket_handler(websocket: WebSocket):
    await websocket.accept()
    classifier = get_classifier()
    
    # Buffer to hold audio chunks until we have enough for YAMNet (~1 second)
    audio_buffer = np.array([], dtype=np.float32)
    MIN_SAMPLES = 16000  # 1 second at 16kHz
    
    print("WebSocket connection established.")
    
    try:
        while True:
            data = await websocket.receive_bytes()
            if not data: continue
                
            # Process current chunk
            chunk_np = process_audio_chunk(data)
            audio_buffer = np.append(audio_buffer, chunk_np)
            
            # Only classify if we have at least 1 second of audio
            if len(audio_buffer) >= MIN_SAMPLES:
                # Use the last 1 second for inference
                inference_data = audio_buffer[-MIN_SAMPLES:]
                results = classifier.classify(inference_data)
                
                # Keep a small overlap or clear buffer
                # Rolling buffer: keep the last 0.5s for continuity
                audio_buffer = audio_buffer[-8000:] 
                
                label = results["label"]
                confidence = results["confidence"]
                
                is_critical = any(sound.lower() in label.lower() for sound in CRITICAL_SOUNDS)
                
                if is_critical and confidence > 0.25:
                    await websocket.send_json({
                        "event": "sound_detected",
                        "label": label,
                        "confidence": confidence,
                        "is_critical": True
                    })
                else:
                    await websocket.send_json({
                        "event": "heartbeat",
                        "label": label,
                        "confidence": confidence,
                        "is_critical": False
                    })
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
