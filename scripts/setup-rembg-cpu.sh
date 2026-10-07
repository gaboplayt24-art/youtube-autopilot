#!/usr/bin/env bash
set -euo pipefail
# Optional, free CPU model downloads. Not required by the 12-frame audition.
python3 -m venv .venv-rembg
.venv-rembg/bin/pip install --disable-pip-version-check 'rembg==2.0.67' 'onnxruntime==1.22.1'
.venv-rembg/bin/python -c 'import rembg, onnxruntime; print("rembg CPU extraction ready")'
