"""Kokoro TTS worker for AI Qadam Video Kit.

SPDX-License-Identifier: MIT

Reads one JSON request per line on stdin, writes a WAV file and answers one JSON line:
  {"text", "out", "model", "voiceId", "speed", "language"} -> {"ok": true} | {"error": "..."}
"voiceId" is a Kokoro voice (af_heart, am_michael, bf_alice, …); "language" is "en" (US)
or "en-gb" (UK). The model loads once and stays in memory for every line of a video.
"""
import json
import sys

import numpy as np
import soundfile as sf
from mlx_audio.tts.models.kokoro import KokoroPipeline
from mlx_audio.tts.utils import load_model

LANGS = {"en": "a", "en-us": "a", "en-gb": "b"}
DEFAULT_MODEL = "mlx-community/Kokoro-82M-bf16"
pipes = {}


def pipeline(model_name, lang):
    code = LANGS.get(lang or "en", "a")
    key = (model_name, code)
    if key not in pipes:
        model = load_model(model_name)
        pipes[key] = KokoroPipeline(lang_code=code, model=model, repo_id=model_name)
    return pipes[key]


def handle(req):
    name = req.get("model") or DEFAULT_MODEL
    p = pipeline(name, req.get("language"))
    chunks = [r.audio for r in p(req["text"], voice=req.get("voiceId") or "af_heart",
                                 speed=float(req.get("speed") or 1.0), split_pattern=None)]
    audio = np.concatenate([np.array(c).reshape(-1) for c in chunks if c is not None])
    sf.write(req["out"], audio, 24000)


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        handle(json.loads(line))
        print(json.dumps({"ok": True}), flush=True)
    except Exception as e:  # report and keep serving the next line
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), flush=True)
