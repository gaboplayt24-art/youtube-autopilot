"""Split an approved illustration into a background plate and cut-out actors for 2.5D animation.

Local CPU only (rembg u2net + isnet-general-use, OpenCV inpainting); no generation, no paid calls.
The actors keep their original pixels; the plate is the same artwork with the actors removed and is
only ever shown blurred behind them. Writes <out>/bg.png, <out>/actor-N.png and <out>/layers.json.
"""
import argparse
import json
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def fill(binary):
    filled = binary.copy()
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    return filled


def mask_for(image, sessions):
    from rembg import remove
    alphas = [np.asarray(remove(image, session=s, only_mask=True), dtype=np.float32) / 255 for s in sessions]
    raw = (np.maximum.reduce(alphas) > 0.35).astype(np.uint8)
    h, w = raw.shape
    # Bodies: an opening removes thin background linework (street edges, walls) and leaves solid figures.
    bodies = cv2.morphologyEx(fill(raw), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(bodies, connectivity=8)
    result = np.zeros_like(raw)
    for i in range(1, count):
        x, y, bw, bh = (int(stats[i, k]) for k in (cv2.CC_STAT_LEFT, cv2.CC_STAT_TOP, cv2.CC_STAT_WIDTH, cv2.CC_STAT_HEIGHT))
        # Legs and staffs are often outline-only in the masks: fill outlines locally around each body,
        # then drop strokes thinner than a limb before keeping only what touches the body.
        x0, y0 = max(0, x - bw // 10), max(0, y - bh // 20)
        x1, y1 = min(w, x + bw + bw // 10), min(h, y + bh + bh // 2)
        local = cv2.morphologyEx(fill(raw[y0:y1, x0:x1]), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        n, parts = cv2.connectedComponents(local, connectivity=8)
        touching = set(np.unique(parts[labels[y0:y1, x0:x1] == i])) - {0}
        result[y0:y1, x0:x1] |= np.isin(parts, list(touching)).astype(np.uint8)
    return result


def actors(mask, minimum):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    keep = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] >= minimum]
    return labels, stats, sorted(keep, key=lambda i: stats[i, cv2.CC_STAT_LEFT])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--max-actors", type=int, default=5)
    args = parser.parse_args()
    os.environ.setdefault("U2NET_HOME", ".cache/rembg")
    from rembg import new_session
    sessions = [new_session(m, providers=["CPUExecutionProvider"]) for m in ("u2net", "isnet-general-use")]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    image = Image.open(args.input).convert("RGB")
    rgb = np.asarray(image)
    h, w = rgb.shape[:2]
    mask = mask_for(image, sessions)
    labels, stats, keep = actors(mask, minimum=int(0.012 * w * h))
    coverage = float(sum(stats[i, cv2.CC_STAT_AREA] for i in keep)) / (w * h)
    usable = 0 < len(keep) <= args.max_actors and 0.03 <= coverage <= 0.6
    report = {"source": str(args.input), "width": w, "height": h, "coverage": round(coverage, 4), "usable": usable, "actors": []}
    if usable:
        union = np.isin(labels, keep).astype(np.uint8)
        # Inpaint at reduced size: the plate is shown blurred, so smooth fills read as soft background.
        scale = 640 / w
        small = cv2.resize(rgb, (640, int(h * scale)), interpolation=cv2.INTER_AREA)
        hole = cv2.dilate(cv2.resize(union, (640, int(h * scale)), interpolation=cv2.INTER_NEAREST), np.ones((9, 9), np.uint8))
        filled = cv2.inpaint(small, hole, 9, cv2.INPAINT_TELEA)
        filled = cv2.resize(filled, (w, h), interpolation=cv2.INTER_CUBIC)
        grown = cv2.dilate(union, np.ones((25, 25), np.uint8)).astype(bool)
        plate = rgb.copy()
        plate[grown] = filled[grown]
        # Depth of field: the softened artwork sits behind the crisp actors. Where an actor's own blurred copy
        # remains, an entering actor reads as a focus pull; the inpainted plate only fills the rest of its outline.
        soft = cv2.GaussianBlur(rgb, (0, 0), 7)
        plate = cv2.GaussianBlur(plate, (0, 0), 7)
        core = cv2.erode(union, np.ones((31, 31), np.uint8)).astype(bool)
        plate[core] = soft[core]
        Image.fromarray(plate).save(out / "bg.png")
        for n, i in enumerate(keep):
            x, y, bw, bh = (int(stats[i, k]) for k in (cv2.CC_STAT_LEFT, cv2.CC_STAT_TOP, cv2.CC_STAT_WIDTH, cv2.CC_STAT_HEIGHT))
            alpha = (labels == i).astype(np.uint8) * 255
            alpha = cv2.GaussianBlur(cv2.dilate(alpha, np.ones((3, 3), np.uint8)), (3, 3), 0)
            rgba = np.dstack([rgb, alpha])[y:y + bh, x:x + bw]
            name = f"actor-{n}.png"
            Image.fromarray(rgba, "RGBA").save(out / name)
            report["actors"].append({"file": name, "x": x / w, "y": y / h, "width": bw / w, "height": bh / h})
    (out / "layers.json").write_text(json.dumps(report, indent=1))
    print(json.dumps({"usable": usable, "coverage": report["coverage"], "actors": len(report["actors"])}))


if __name__ == "__main__":
    main()
