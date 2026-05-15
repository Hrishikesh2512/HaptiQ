from fastapi import WebSocket, WebSocketDisconnect
import numpy as np
from app.utils.audio_processing import process_audio_chunk
from app.models.yamnet import get_classifier
from app.db.database import SessionLocal
from app.db.models import SoundAlert
import json

# All sounds we want to surface — broader than before
CRITICAL_SOUNDS = {
    # Emergency
    "siren", "civil defense siren", "police car (siren)", "ambulance (siren)",
    "fire engine, fire truck (siren)", "emergency vehicle",
    # Alerts / alarms
    "alarm", "fire alarm", "smoke detector", "carbon monoxide detector",
    "alarm clock", "buzzer", "bell",
    # Door
    "doorbell", "door",
    # People
    "crying, sobbing", "baby cry, infant cry", "screaming", "shout",
    "yell", "crowd", "cheering",
    # Animals
    "dog", "dog bark", "bark", "howl",
    # Accidents
    "glass breaking", "breaking", "crash", "bang", "gunshot",
    # Vehicles
    "horn", "car horn, honking", "vehicle horn",
}

def is_critical(label: str) -> bool:
    label_lower = label.lower()
    return any(keyword in label_lower for keyword in CRITICAL_SOUNDS)


async def audio_websocket_handler(websocket: WebSocket):
    await websocket.accept()
    classifier = get_classifier()

    audio_buffer = np.array([], dtype=np.float32)
    MIN_SAMPLES = 16000   # 1 second at 16kHz
    STEP_SAMPLES = 8000   # 0.5s stride (50% overlap for smoother detections)

    print("[HaptiQ] Client connected.")

    try:
        while True:
            data = await websocket.receive_bytes()
            if not data:
                continue

            chunk = process_audio_chunk(data)
            audio_buffer = np.append(audio_buffer, chunk)

            # Run inference every time we have >= 1 second of audio
            if len(audio_buffer) >= MIN_SAMPLES:
                inference_data = audio_buffer[-MIN_SAMPLES:]
                audio_buffer = audio_buffer[-STEP_SAMPLES:]   # keep last 0.5s

                try:
                    results = classifier.classify(inference_data)
                except Exception as e:
                    print(f"[HaptiQ] Classifier error: {e}")
                    continue

                label = results.get("label", "Unknown")
                confidence = float(results.get("confidence", 0.0))
                critical = is_critical(label)

                # Always send result back (frontend uses this for live display)
                response = {
                    "event": "sound_detected" if critical else "heartbeat",
                    "label": label,
                    "confidence": round(confidence, 4),
                    "is_critical": critical,
                }

                await websocket.send_json(response)

                # Persist to DB only for critical detections above threshold
                if critical and confidence > 0.30:
                    try:
                        with SessionLocal() as db:
                            alert = SoundAlert(label=label, confidence=confidence)
                            db.add(alert)
                            db.commit()
                    except Exception as db_err:
                        print(f"[HaptiQ] DB error: {db_err}")

    except WebSocketDisconnect:
        print("[HaptiQ] Client disconnected.")
    except Exception as e:
        print(f"[HaptiQ] Unexpected error: {e}")
