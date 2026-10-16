"""Pinned public Apache-2.0 SmolVLM2 weights for an isolated CPU probe.
No token, paid inference, remote Python code, or cache upload. Verify HF blob/LFS hashes.
"""
import hashlib
import json
import os
import time
import urllib.request
from pathlib import Path

MODEL = 'HuggingFaceTB/SmolVLM2-500M-Video-Instruct'
REVISION = '7b375e1b73b11138ff12fe22c8f2822d8fe03467'
FILES = {'config.json', 'generation_config.json', 'preprocessor_config.json',
         'processor_config.json', 'tokenizer.json', 'tokenizer_config.json',
         'special_tokens_map.json', 'chat_template.json', 'chat_template.jinja',
         'onnx/embed_tokens_q4.onnx', 'onnx/decoder_model_merged_q4.onnx',
         'onnx/vision_encoder.onnx'}


def main():
    started = time.monotonic()
    root = Path(os.environ.get('SMOLVLM_MODEL_DIR', '.cache/smolvlm-probe/model'))
    root.mkdir(parents=True, exist_ok=True)
    url = f'https://huggingface.co/api/models/{MODEL}/revision/{REVISION}?blobs=true'
    with urllib.request.urlopen(url, timeout=60) as response:
        metadata = json.load(response)
    if metadata['sha'] != REVISION or metadata.get('cardData', {}).get('license') != 'apache-2.0':
        raise ValueError('Pinned model revision/license mismatch')
    records = []
    for blob in metadata['siblings']:
        name = blob['rfilename']
        if name not in FILES:
            continue
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.download')
        lfs = blob.get('lfs')
        expected = lfs['sha256'] if lfs else blob['blobId']

        def digest(file):
            h = hashlib.sha256() if lfs else hashlib.sha1()
            if not lfs:
                h.update(f'blob {file.stat().st_size}\0'.encode())
            with file.open('rb') as source:
                for chunk in iter(lambda: source.read(1024**2), b''):
                    h.update(chunk)
            return h.hexdigest()

        if not path.exists() or digest(path) != expected:
            with urllib.request.urlopen(f'https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}', timeout=120) as response, temporary.open('wb') as output:
                for chunk in iter(lambda: response.read(1024**2), b''):
                    output.write(chunk)
            if digest(temporary) != expected:
                raise ValueError('Downloaded model checksum mismatch: ' + name)
            temporary.replace(path)
        records.append({'path': name, 'bytes': path.stat().st_size, 'verifiedDigest': expected, 'digestKind': 'sha256-lfs' if lfs else 'git-blob-sha1'})
        print(json.dumps({'event': 'model_file_verified', 'path': name, 'bytes': path.stat().st_size}), flush=True)
    missing = FILES.intersection({'config.json', 'processor_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/embed_tokens_q4.onnx', 'onnx/decoder_model_merged_q4.onnx', 'onnx/vision_encoder.onnx'}) - {r['path'] for r in records}
    if missing:
        raise ValueError('Required pinned model files absent: ' + str(sorted(missing)))
    (root / 'download-manifest.json').write_text(json.dumps({'model': MODEL, 'revision': REVISION, 'license': 'Apache-2.0', 'downloadAndVerificationSeconds': time.monotonic() - started, 'totalBytes': sum(r['bytes'] for r in records), 'files': records}, indent=2))


if __name__ == '__main__':
    main()
