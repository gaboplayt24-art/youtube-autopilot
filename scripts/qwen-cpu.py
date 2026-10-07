"""Bounded free CPU audition. Separate environment; official Apache-2.0 weights."""
import json, sys, time, re
from pathlib import Path
import torch
import numpy as np
import soundfile as sf
from huggingface_hub import snapshot_download
from qwen_tts import Qwen3TTSModel
job = json.load(sys.stdin)
torch.set_num_threads(2)
torch.set_num_interop_threads(1)
torch.manual_seed(42)
started = time.monotonic()
revision = '85e237c12c027371202489a0ec509ded67b5e4b5'
folder = snapshot_download('Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice', revision=revision)
model = Qwen3TTSModel.from_pretrained(folder, device_map='cpu', dtype=torch.float32, attn_implementation='eager')
loaded = time.monotonic()
chunks, evidence = [], []
for sentence in re.findall(r'[^.!?]+[.!?]*', job['text']):
    with torch.inference_mode():
        wavs, sr = model.generate_custom_voice(text=sentence.strip(), language='English', speaker='Ryan', max_new_tokens=1024)
    audio = np.asarray(wavs[0], dtype='float32')
    offset = sum(len(a) for a in chunks)/sr
    evidence.append({'text':sentence.strip(), 'start':offset,'end':offset+len(audio)/sr,'source':'actual synthesized sentence PCM spans, not ASR word alignment'})
    chunks.append(audio)
sf.write(job['path'], np.concatenate(chunks), sr, subtype='PCM_16')
Path(job['path']+'.synthesis.json').write_text(json.dumps({'revision':revision,'device':'cpu','dtype':'float32','speaker':'Ryan','modelLoadSeconds':loaded-started,'inferenceSeconds':time.monotonic()-loaded,'chunks':evidence,'license':'Apache-2.0'}))
