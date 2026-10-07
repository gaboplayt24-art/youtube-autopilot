#!/usr/bin/env bash
set -euo pipefail
# Isolated packages: Qwen must not downgrade Nano's transformers installation.
python3 -m venv .venv-qwen
.venv-qwen/bin/python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.6.0+cpu' 'torchaudio==2.6.0+cpu'
.venv-qwen/bin/python -m pip install -r scripts/requirements-qwen.txt
.venv-qwen/bin/python -m pip check
.venv-qwen/bin/python -m pip freeze > .cache/qwen-environment.txt
.venv-qwen/bin/python -c 'from qwen_tts import Qwen3TTSModel; import torch; assert not torch.cuda.is_available()'
