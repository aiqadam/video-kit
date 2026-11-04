"""Phonon worker for AI Qadam Video Kit.

SPDX-License-Identifier: MIT

Reads one JSON request per line on stdin, writes a WAV file and answers one JSON line:
  {"text", "out", "model", "voiceId", "speed", "language"} -> {"ok": true} | {"error": "..."}
"model" is a Phonon checkpoint: hf://gradium/phonon-31m-en (default, Apache-2.0), a gated
hf://gradium/phonon-40m-<lang> (CC BY-NC 4.0) or a local folder. "voiceId" is a voice of the
checkpoint or of the gradium/phonon-voices catalog (Zoey, …); without it the checkpoint's
default voice speaks. "language" (en, fr, de, es, pt) sets how numbers and symbols are read;
without it the language comes from the model name. "speed" > 1 speaks faster. The model loads
once and stays in memory for every line of a video.
"""
import json
import re
import sys

import ptts

DEFAULT_MODEL = "hf://gradium/phonon-31m-en"
LANGS = {"en", "fr", "de", "es", "pt"}
models = {}


def language(req, model_name):
    lang = (req.get("language") or "").lower().split("-")[0]
    if lang in LANGS:
        return lang
    m = re.search(r"phonon-[0-9]+m-([a-z]{2})\b", model_name)
    return m.group(1) if m and m.group(1) in LANGS else "en"


def tts(model_name, lang):
    key = (model_name, lang)
    if key not in models:
        models[key] = ptts.TTS(model_name, lang=lang)
    return models[key]


def duration_delta(speed):
    """The kit's speed (1.0 = as recorded, 1.25 = a quarter faster) as Phonon's duration_delta
    (0 = natural, negative = faster, positive = slower), kept to a range that still sounds right."""
    s = float(speed or 1.0)
    return max(-0.5, min(0.5, round(1.0 / s - 1.0, 3)))


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        req = json.loads(line)
        model_name = req.get("model") or DEFAULT_MODEL
        engine = tts(model_name, language(req, model_name))
        opts = {}
        if req.get("voiceId"):
            opts["voice"] = req["voiceId"]
        delta = duration_delta(req.get("speed"))
        if delta:
            opts["conditions"] = {"duration_delta": delta}
        engine.save(req["out"], req["text"], **opts)
        print(json.dumps({"ok": True}), flush=True)
    except Exception as e:
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), flush=True)
