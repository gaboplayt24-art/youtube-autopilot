"""Optional rembg CPU extraction; never used for ordinary full keyframes."""
import argparse
import io
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    os.environ.setdefault("U2NET_HOME", ".cache/rembg")
    os.environ.setdefault("OMP_NUM_THREADS", "2")
    from rembg import new_session, remove
    from PIL import Image
    session = new_session("u2net", providers=["CPUExecutionProvider"])
    result = remove(Path(args.input).read_bytes(), session=session)
    image = Image.open(io.BytesIO(result)).convert("RGBA")
    alpha = image.getchannel("A").histogram()
    transparent = sum(alpha[:32]) / (image.width * image.height)
    if not 0.01 < transparent < 0.98:
        raise ValueError("Extraction is empty or has no useful transparent background")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, format="PNG")


if __name__ == "__main__":
    main()
