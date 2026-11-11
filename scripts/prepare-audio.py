#!/usr/bin/env python3
"""Encode an original ambience for NOCTUA; runtime PCM processing makes the seam.

Requires ffmpeg/ffprobe. Usage: python3 scripts/prepare-audio.py INPUT.mp3 OUTPUT.mp3
No source recordings or secrets are fetched by this script.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path


FILTERS = "highpass=f=25,lowpass=f=16000"
LOUDNESS = "loudnorm=I=-23:TP=-4:LRA=7"


def prepare(source: Path, target: Path) -> dict:
    if source.resolve() == target.resolve():
        raise ValueError("Source and output must be different files")
    target.parent.mkdir(parents=True, exist_ok=True)
    # First measure actual loudness; avoids leaving quiet generated masters inaudible.
    measurement = subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-i", str(source), "-map", "0:a:0",
        "-vn", "-af", f"{FILTERS},{LOUDNESS}:print_format=json", "-f", "null", "-",
    ], check=True, capture_output=True, text=True)
    start = measurement.stderr.rfind("{")
    end = measurement.stderr.rfind("}")
    levels = json.loads(measurement.stderr[start:end + 1])
    for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset"):
        if not math.isfinite(float(levels[key])):
            raise ValueError("Silent or invalid master loudness")
    measured = (
        f":measured_I={levels['input_i']}:measured_TP={levels['input_tp']}"
        f":measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}"
        f":offset={levels['target_offset']}:linear=true"
    )
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-map", "0:a:0", "-vn", "-map_metadata", "-1",
        "-af", f"{FILTERS},{LOUDNESS}{measured}",
        "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "192k",
        str(target),
    ], check=True)
    result = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=codec_name,sample_rate,channels:format=duration,size",
        "-of", "json", str(target),
    ]))
    stream = result["streams"][0]
    duration = float(result["format"]["duration"])
    if not 25 <= duration <= 32:
        raise ValueError(f"Expected ~30 seconds, got {duration:.3f}s")
    if stream["channels"] != 2 or stream["sample_rate"] != "44100":
        raise ValueError("Invalid delivery format")
    return {
        "path": str(target.resolve()), "duration_seconds": duration,
        "bytes": target.stat().st_size, "channels": stream["channels"],
        "sample_rate": int(stream["sample_rate"]), "codec": stream["codec_name"],
        "source_integrated_lufs": float(levels["input_i"]),
        "delivery_target_lufs": -23, "delivery_target_true_peak_db": -4,
        "origin": "AI-generated environmental sound effect; no music or narration requested",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.target), ensure_ascii=False))
