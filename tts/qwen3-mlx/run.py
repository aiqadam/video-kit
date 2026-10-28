"""Qwen3-TTS worker for AI Qadam Video Kit.

SPDX-License-Identifier: MIT

Reads one JSON request per line on stdin, writes a WAV file and answers one JSON line:
  {"text", "out", "model", "language", "instructions", "voiceId"} -> {"ok": true} | {"error": "..."}
The model loads once and stays in memory for every line of a video.
"""
import json
import sys

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

LANGS = {"ru": "Russian", "en": "English", "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "de": "German",
         "fr": "French", "pt": "Portuguese", "es": "Spanish", "it": "Italian"}
models = {}


def handle(req):
    name = req.get("model") or "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"
    if name not in models:
        models[name] = load_model(name)
    model = models[name]
    lang = LANGS.get(req.get("language", ""), req.get("language") or "Russian")
    text, instruct, voice = req["text"], req.get("instructions"), req.get("voiceId")
    if "VoiceDesign" in name:
        res = model.generate_voice_design(text=text, language=lang, instruct=instruct or "A clear, natural voice.")
    elif "CustomVoice" in name:
        res = model.generate_custom_voice(text=text, speaker=voice or "Vivian", language=lang, instruct=instruct or "")
    else:
        res = model.generate(text=text, voice=voice)
    audio = np.concatenate([np.array(r.audio) for r in res])
    sf.write(req["out"], audio, model.sample_rate)


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        handle(json.loads(line))
        print(json.dumps({"ok": True}), flush=True)
    except Exception as e:  # report and keep serving the next line
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), flush=True)
