#!/usr/bin/env python3
"""Check delivery format and PCM integrity. This is not a perceptual listening audit."""
import array
import argparse
import json
import math
import subprocess
from pathlib import Path

IDS = [
    "rain", "window-rain", "roof-rain", "thunder", "far-storm", "wind",
    "ocean", "forest", "birds", "crickets", "stream", "leaves", "tree-wind",
    "fireplace", "campfire", "cafe", "train",
]


def inspect(path: Path) -> dict:
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
        "stream=codec_name,sample_rate,channels,bit_rate:format=duration", "-of", "json", str(path),
    ]))
    stream = probe["streams"][0]
    duration = float(probe["format"]["duration"])
    supplied = path.stem in {"rain", "thunder"}
    if not (0.5 <= duration <= 180 if supplied else 25 <= duration <= 32):
        raise ValueError(f"{path.name}: unexpected duration {duration}")
    compatible = 8000 <= int(stream["sample_rate"]) <= 96000 and stream["channels"] in {1, 2}
    if stream["codec_name"] != "mp3" or not compatible:
        raise ValueError(f"{path.name}: wrong delivery format")
    pcm = subprocess.check_output([
        "ffmpeg", "-nostdin", "-v", "error", "-i", str(path),
        "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1",
    ])
    samples = array.array("f")
    samples.frombytes(pcm)
    energy = 0.0
    mean = 0.0
    peak = 0.0
    for value in samples:
        if not math.isfinite(value):
            raise ValueError(f"{path.name}: invalid PCM samples")
        mean += value
        energy += value * value
        peak = max(peak, abs(value))
    rms = math.sqrt(energy / len(samples))
    if rms < 1e-5:
        raise ValueError(f"{path.name}: silence or unusably quiet data")
    return {
        "id": path.stem, "bytes": path.stat().st_size,
        "origin": "user-supplied" if supplied else "AI-generated",
        "duration_seconds": round(duration, 3), "sample_rate": int(stream["sample_rate"]),
        "channels": stream["channels"], "bit_rate": int(stream.get("bit_rate", 0)),
        "decoded_rms_dbfs": round(20 * math.log10(rms), 2),
        "decoded_sample_peak_dbfs": round(20 * math.log10(peak), 2),
        "sample_peak_exceeds_full_scale": peak >= 1,
        "decoded_dc_mean": round(mean / len(samples), 8), "valid": True,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    results = []
    for sound_id in IDS:
        result = inspect(args.directory / f"{sound_id}.mp3")
        results.append(result)
        print(f"{sound_id}: {result['duration_seconds']}s, {result['decoded_rms_dbfs']}dBFS RMS, valid", flush=True)
    report = {
        "method": "FFprobe format check and FFmpeg decoded PCM numerical integrity; not a human listening test",
        "expected_files": len(IDS), "validated_files": len(results),
        "total_bytes": sum(result["bytes"] for result in results), "files": results,
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
