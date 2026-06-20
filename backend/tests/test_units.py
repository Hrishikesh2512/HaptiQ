"""Unit tests for the pure, ML-free helpers. Run from the backend dir:

    venv\\Scripts\\python -m pytest
"""
import numpy as np

from app.core.sounds import is_critical
from app.core.config import settings
from app.utils.audio_processing import process_audio_chunk


def test_is_critical_matches_known_sounds():
    assert is_critical("Civil defense siren")
    assert is_critical("Crying, sobbing")
    assert is_critical("Police car (siren)")
    assert is_critical("Dog")
    # case-insensitive
    assert is_critical("FIRE ALARM")


def test_is_critical_ignores_irrelevant_sounds():
    assert not is_critical("Speech")
    assert not is_critical("Piano")
    assert not is_critical("Silence")


def test_process_audio_chunk_decodes_int16_pcm():
    # Two 16-bit samples: full-scale negative and ~half positive.
    pcm = np.array([-32768, 16384], dtype=np.int16).tobytes()
    out = process_audio_chunk(pcm)
    assert out.dtype == np.float32
    assert len(out) == 2
    assert out[0] == -1.0
    assert abs(out[1] - 0.5) < 1e-3


def test_process_audio_chunk_resamples_to_16k():
    # 8000 samples at 8 kHz -> ~16000 samples at 16 kHz.
    pcm = np.zeros(8000, dtype=np.int16).tobytes()
    out = process_audio_chunk(pcm, sample_rate=8000)
    assert abs(len(out) - 16000) <= 4


def test_settings_threshold_is_a_fraction():
    assert 0.0 <= settings.model_threshold <= 1.0
