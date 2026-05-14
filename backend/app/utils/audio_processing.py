import numpy as np
import librosa

def process_audio_chunk(audio_bytes: bytes, sample_rate: int = 16000) -> np.ndarray:
    """
    Converts raw audio bytes into a normalized numpy array for model input.
    Assuming input is 16-bit PCM.
    """
    # Convert bytes to numpy array (16-bit PCM)
    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    
    # Resample if necessary (YAMNet expects 16kHz)
    if sample_rate != 16000:
        audio_np = librosa.resample(audio_np, orig_sr=sample_rate, target_sr=16000)
    
    return audio_np

def get_spectrogram(audio_np: np.ndarray):
    """
    Generates a mel spectrogram for visualization if needed.
    """
    S = librosa.feature.melspectrogram(y=audio_np, sr=16000, n_mels=64)
    return librosa.power_to_db(S, ref=np.max)
