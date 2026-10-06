#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-.cache/pip}"
python3 -m venv .venv-ai
.venv-ai/bin/python -m pip install --upgrade 'pip==25.3'
# CPU wheels first: never download the multi-GB CUDA distribution on Actions.
.venv-ai/bin/python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.6.0+cpu' 'torchaudio==2.6.0+cpu'
# Install the complete resolved freeze without re-resolving upstream direct URLs:
# Chatterbox declares Perth@master, while our freeze pins that same dependency to
# an immutable commit. pip treats the two URLs as conflicting requirements.
# Every transitive dependency is pinned here; pip check still validates the graph.
.venv-ai/bin/python -m pip install --no-deps -r scripts/requirements-cpu-ai.lock
.venv-ai/bin/python -m pip check
.venv-ai/bin/python -m pip freeze > .cache/cpu-ai-environment.txt
