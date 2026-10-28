"""Piper worker for AI Qadam Video Kit (MIT).

Reads one JSON request per line on stdin and answers one JSON line:
  {"text", "out", "model", "speed"} -> {"ok": true} | {"error": "..."}
"model" is a Piper voice name (ru_RU-denis-medium); it is downloaded on first use into
the folder next to this script.
"""
import json
import os
import subprocess
import sys
import wave

from piper import PiperVoice, SynthesisConfig

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices")
voices = {}


def voice(name):
    if name not in voices:
        path = os.path.join(HERE, name + ".onnx")
        if not os.path.exists(path):
            os.makedirs(HERE, exist_ok=True)
            subprocess.run([sys.executable, "-m", "piper.download_voices", "--download-dir", HERE, name],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        voices[name] = PiperVoice.load(path)
    return voices[name]


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        req = json.loads(line)
        v = voice(req.get("model") or "ru_RU-denis-medium")
        cfg = SynthesisConfig(length_scale=1.0 / float(req.get("speed") or 1.0))
        with wave.open(req["out"], "wb") as wav:
            v.synthesize_wav(req["text"], wav, syn_config=cfg)
        print(json.dumps({"ok": True}), flush=True)
    except Exception as e:
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), flush=True)
