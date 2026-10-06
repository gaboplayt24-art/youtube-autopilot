"""CPU-only official Nano and Apache-2.0 Depth Anything V2 SMALL. No GPU fallback."""
import json, sys, os, re
from pathlib import Path
import numpy as np
import torch
from PIL import Image, ImageFilter
job = json.load(sys.stdin)
torch.set_num_threads(2)
torch.set_num_interop_threads(1)
if job['action'] == 'nano':
    import soundfile as sf
    from huggingface_hub import snapshot_download
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    directory = snapshot_download('ResembleAI/chatterbox-nano', revision='71ccd1d0081b430592cea481f4307e764e07bc64', allow_patterns=['t3_nano_v1.safetensors', 's3gen_meanflow.safetensors', 've.safetensors', 'conds.pt', '*.json', '*.txt'])
    model = ChatterboxTurboTTS.from_local(directory, device='cpu', nano=True)
    torch.manual_seed(42)
    chunks = []
    # Bound autoregressive work, never switch speaker or stretch the resulting audio.
    for sentence in re.findall(r'[^.!?]+[.!?]*', job['text']):
        words = sentence.strip().split()
        for start in range(0, len(words), 45):
            with torch.inference_mode():
                wav = model.generate(' '.join(words[start:start+45]), audio_prompt_path=job.get('reference') or None)
            if chunks:
                chunks.append(np.zeros(round(model.sr*.18), dtype='float32'))
            chunks.append(wav.squeeze().cpu().numpy())
    sf.write(job['path'], np.concatenate(chunks), model.sr, subtype='PCM_16')
elif job['action'] == 'depth':
    from transformers import pipeline
    # Exact Small model/revision. No config/env override can load NC Base/Large/Giant.
    estimator = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', revision='5426e4f0f36572d16453bbda7a8389317b1bef99', device=-1)
    image = Image.open(job['path']).convert('RGB')
    # FLUX currently returns square frames. Editorial 16:9 crop, not an unsupported API size parameter.
    w, h = image.size
    crop_h = min(h, int(w*9/16)); crop_w = min(w, int(h*16/9))
    image = image.crop(((w-crop_w)//2, (h-crop_h)//2, (w+crop_w)//2, (h+crop_h)//2)).resize((1920,1080), Image.Resampling.LANCZOS)
    image.save(job['output']+'/frame.png')
    with torch.inference_mode():
        depth = estimator(image.resize((768,432)))['depth'].resize(image.size, Image.Resampling.BILINEAR)
    depth.save(job['output']+'/depth.png')
    d = np.array(depth).astype('float32')
    lo, hi = np.percentile(d, [2,98]); d = np.clip((d-lo)/max(hi-lo,1),0,1)
    # Soft overlapping masks avoid cut-out edges. Background remains a complete image
    # with mild blur to conceal disocclusion; parallax amplitude is intentionally small.
    for name, center in [('foreground',.83),('midground',.50)]:
        alpha = np.clip(1-np.abs(d-center)/.34,0,1)
        mask = Image.fromarray((alpha*255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))
        layer = image.convert('RGBA');layer.putalpha(mask);layer.save(job['output']+'/'+name+'.png')
    image.filter(ImageFilter.GaussianBlur(2)).save(job['output']+'/background.png')
    Path(job['output']+'/depth-info.json').write_text(json.dumps({'model':'depth-anything/Depth-Anything-V2-Small-hf','revision':'5426e4f0f36572d16453bbda7a8389317b1bef99','license':'Apache-2.0','device':'cpu','sourceWidth':w,'sourceHeight':h,'outputWidth':1920,'outputHeight':1080,'method':'relative inverse-depth soft masks; complete blurred background, bounded parallax; not geometric reconstruction'}))
else:
    raise ValueError('Unknown CPU task')
