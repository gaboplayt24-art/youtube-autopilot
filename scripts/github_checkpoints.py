"""Versioned checkpoint storage in Releases of this PRIVATE repository only.
No API provider credentials are used. Archives never become public YouTube uploads.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

QUOTA_TAG = 'pipeline-quota-ledger'
CHUNK_BYTES = 1024 ** 3  # Below GitHub's 2 GiB per-asset maximum.


def gh(*args):
    return subprocess.check_output(['gh', *args], stderr=subprocess.PIPE)


def api_json(repo, route, optional=False):
    try:
        return json.loads(gh('api', f'repos/{repo}' + ('/' + route if route else '')))
    except subprocess.CalledProcessError as error:
        if optional and b'HTTP 404' in error.stderr:
            return None
        raise RuntimeError('GitHub repository storage request failed; access or service availability must be resolved') from None


def public_storage_approved():
    # Owner decision 2026-10-16: the repository may be made public to use free Actions minutes; checkpoints then become public too.
    try:
        return json.loads(Path('config/repository-visibility.json').read_text()).get('publicCheckpointsApproved') is True
    except FileNotFoundError:
        return False


def require_private(repo):
    if api_json(repo, '')['private'] is not True and not public_storage_approved():
        raise RuntimeError('Checkpoint Releases require a PRIVATE repository; no files uploaded')


def identity(value):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
        raise ValueError('Invalid checkpoint identity')
    return value


def execution():
    run = identity(os.environ['GITHUB_RUN_ID'])
    attempt = identity(os.environ.get('GITHUB_RUN_ATTEMPT', '1'))
    return f'{run}-attempt-{attempt}'


def release(repo, tag):
    require_private(repo)
    result = api_json(repo, 'releases/tags/' + tag, optional=True)
    if result:
        if result['draft'] or not result['prerelease']:
            raise RuntimeError('Checkpoint tag belongs to a non-checkpoint release')
        return result
    payload = {'tag_name': tag, 'name': 'Internal pipeline storage: ' + tag,
               'body': 'Private repository checkpoint storage. Not a YouTube publication. Preserve evidence and quota history.',
               'draft': False, 'prerelease': True, 'make_latest': 'false',
               'target_commitish': os.environ.get('GITHUB_SHA', 'main')}
    with tempfile.TemporaryDirectory() as directory:
        file = Path(directory) / 'release.json'
        file.write_text(json.dumps(payload))
        return json.loads(gh('api', '--method', 'POST', f'repos/{repo}/releases', '--input', str(file)))


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as file:
        for chunk in iter(lambda: file.read(1024 ** 2), b''):
            h.update(chunk)
    return h.hexdigest()


def upload(repo, tag, path):
    # Unique execution names preserve prior versions; never clobber previous evidence.
    gh('release', 'upload', tag, str(path), '--repo', repo)


def pack(root, directory, run_id, source_run_id, attempt, chunk_bytes=CHUNK_BYTES, record_only=False):
    root, directory = Path(root), Path(directory)
    archive = directory / 'archive.zip'
    allowed = {'upload.json', 'qa-upload.json', 'schedule.json', 'youtube-thumbnail.json',
               'localizations.json', 'youtube-localizations.json', 'events.jsonl', 'metadata.json',
               'owner-cover-handoff.json', 'owner-cover-confirmation.json'}
    # A resumed stage needs its integrity record next to its JSON.
    allowed |= {name[:-5] + '.integrity.json' for name in allowed if name.endswith('.json')}
    count = 0
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=4) as zipped:
        for path in sorted(root.rglob('*')):
            if path.is_symlink():
                raise ValueError('Symlinks cannot enter a checkpoint archive')
            if not path.is_file() or path.name in {'.lock', '.lock-recovery'}:
                continue
            relative = path.relative_to(root)
            if record_only and str(relative) not in allowed:
                continue
            zipped.write(path, str(relative))
            count += 1
    parts = []
    stem = f'{"upload" if record_only else "run"}-{source_run_id}-attempt-{attempt}'
    with archive.open('rb') as source:
        index = 0
        while True:
            data = source.read(chunk_bytes)
            if not data:
                break
            index += 1
            path = directory / f'{stem}.zip.part{index:03d}'
            path.write_bytes(data)
            parts.append({'name': path.name, 'bytes': len(data), 'sha256': digest(path)})
    archive.unlink()
    manifest = {'version': 1, 'runId': run_id, 'sourceRunId': source_run_id, 'attempt': attempt,
                'commit': os.environ.get('GITHUB_SHA'), 'files': count, 'parts': parts,
                'continuation': continuation_hint(root), 'recordOnly': record_only, 'baseSourceRunId': os.environ.get('SOURCE_RUN_ID') if record_only else None, 'createdAt': datetime.now(timezone.utc).isoformat()}
    path = directory / (stem + '.manifest.json')
    path.write_text(json.dumps(manifest, indent=2))
    return path, manifest


def continuation_hint(root):
    """Publish only actual provider reset timestamps, never credentials or error text."""
    root = Path(root)
    try:
        status = json.loads((root / 'status.json').read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    hint = {'state': status.get('state'), 'stage': status.get('stage')}
    if not re.search(r'quota|429|rate.?limit|resource.?exhausted', str(status.get('error', '')), re.I):
        return hint
    reset = None
    try:
        with (root / 'logs.jsonl').open() as logs:
            for line in logs:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if item.get('event') == 'stage_started' and item.get('stage') == status.get('stage'):
                    reset = None
                if item.get('event') == 'gemini_model_quota_unavailable' and item.get('resumeAfter'):
                    reset = item['resumeAfter']
    except FileNotFoundError:
        pass
    quota = root / 'quota-checkpoint.json'
    try:
        if quota.exists():
            value = json.loads(quota.read_text())
            updated = status.get('updatedAt')
            if updated and quota.stat().st_mtime >= datetime.fromisoformat(updated.replace('Z', '+00:00')).timestamp() - 120:
                reset = value.get('resumeAfter', reset)
        if reset:
            datetime.fromisoformat(reset.replace('Z', '+00:00'))
            hint['resumeAfter'] = reset
    except (ValueError, TypeError, OSError):
        pass  # Optional hints must never prevent preservation of the raw checkpoint.
    return hint


def unpack(manifest, directory, destination, run_id, source_run_id):
    if manifest.get('version') != 1 or manifest.get('runId') != run_id or manifest.get('sourceRunId') != source_run_id:
        raise ValueError('Checkpoint archive identity mismatch')
    directory, destination = Path(directory), Path(destination)
    archive = directory / 'restored.zip'
    with archive.open('wb') as target:
        if not manifest.get('parts'):
            raise ValueError('Checkpoint has no archive parts')
        for part in manifest['parts']:
            if Path(part['name']).name != part['name']:
                raise ValueError('Unsafe archive part path')
            path = directory / part['name']
            if path.stat().st_size != part['bytes'] or digest(path) != part['sha256']:
                raise ValueError('Checkpoint archive checksum mismatch')
            with path.open('rb') as source:
                shutil.copyfileobj(source, target)
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        for entry in zipped.infolist():
            path = Path(entry.filename)
            if path.is_absolute() or '..' in path.parts or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Unsafe path in checkpoint archive')
            if not (destination / path).resolve().is_relative_to(destination.resolve()):
                raise ValueError('Checkpoint extraction escapes destination')
        zipped.extractall(destination)


def restore(repo, run_id, source_run_id, prefix, visited=None):
    require_private(repo)
    visited = set() if visited is None else set(visited)
    if source_run_id in visited or len(visited) >= 8:
        raise ValueError('Checkpoint base chain repeats or is too deep')
    visited.add(source_run_id)
    tag = 'pipeline-checkpoint-' + identity(run_id)
    data = api_json(repo, 'releases/tags/' + tag, optional=True)
    assets = [] if not data else data['assets']

    def candidate(kind):
        stem = f'{kind}-{identity(source_run_id)}-attempt-'
        matches = [a for a in assets if a['name'].startswith(stem) and a['name'].endswith('.manifest.json')]
        return max(matches, key=lambda a: (a['created_at'], a['id'])) if matches else None

    def extract(asset, restore_base=False):
        with tempfile.TemporaryDirectory() as directory:
            gh('release', 'download', tag, '--repo', repo, '--pattern', asset['name'], '--dir', directory)
            manifest = json.loads((Path(directory) / asset['name']).read_text())
            if manifest.get('runId') != run_id or manifest.get('sourceRunId') != source_run_id:
                raise ValueError('Checkpoint archive identity mismatch')
            if restore_base:
                base = manifest.get('baseSourceRunId')
                if not base or base == source_run_id:
                    raise ValueError('Upload checkpoint has no distinct complete base archive')
                restore(repo, run_id, identity(base), 'production', visited)
            for part in manifest['parts']:
                if Path(part['name']).name != part['name']:
                    raise ValueError('Unsafe archive part path')
                gh('release', 'download', tag, '--repo', repo, '--pattern', part['name'], '--dir', directory)
            unpack(manifest, directory, Path('data/runs') / run_id, run_id, source_run_id)

    complete, record = candidate('run'), candidate('upload')
    if complete:
        extract(complete)
        if record:
            extract(record)  # Preserve uploaded video ID and scheduling evidence on retry.
    elif record:
        extract(record, restore_base=True)
    else:
        # Original Actions artifacts remain readable during the migration.
        destination = 'data/runs' if prefix == 'pipeline' else 'data/runs/' + run_id
        gh('run', 'download', identity(source_run_id), '--repo', repo, '--name', prefix + '-' + run_id, '--dir', destination)
        print(json.dumps({'event': 'legacy_artifact_restored', 'sourceRunId': source_run_id}))
        return
    print(json.dumps({'event': 'checkpoint_restored', 'tag': tag, 'sourceRunId': source_run_id}))


def latest_quota(repo):
    # A read-only Actions token can read a published prerelease in this private repo.
    if api_json(repo, '')['private'] is not True and not public_storage_approved():
        return None
    data = api_json(repo, 'releases/tags/' + QUOTA_TAG, optional=True)
    if not data:
        return None
    if data['draft'] or not data['prerelease']:
        raise RuntimeError('Shared quota release is not an internal checkpoint')
    assets = [a for a in data['assets'] if re.fullmatch(r'free-quota-ledger-[0-9]+-attempt-[0-9]+-[a-f0-9]{12}\.json', a['name'])]
    return max(assets, key=lambda a: (a['created_at'], a['id'])) if assets else None


def read_quota(repo, asset):
    data = gh('api', f'repos/{repo}/releases/assets/{asset["id"]}', '-H', 'Accept: application/octet-stream')
    if hashlib.sha256(data).hexdigest()[:12] != asset['name'].rsplit('-', 1)[1].removesuffix('.json'):
        raise ValueError('Shared quota checksum mismatch')
    return json.loads(data)


def save_quota(repo):
    path = Path(os.environ.get('FREE_QUOTA_LEDGER_PATH', '.cache/quota/free-quota-ledger.json'))
    if not path.exists():
        print(json.dumps({'event': 'quota_not_created_yet'}))
        return
    data = json.loads(path.read_text())
    if data.get('version') != 2 or not isinstance(data.get('events'), list):
        raise ValueError('Invalid shared quota ledger; cannot persist')
    data = release(repo, QUOTA_TAG)
    name = 'free-quota-ledger-' + execution() + '-' + digest(path)[:12] + '.json'
    if any(a['name'] == name for a in data['assets']):
        print(json.dumps({'event': 'quota_already_persisted'}))
        return
    with tempfile.TemporaryDirectory() as directory:
        copy = Path(directory) / name
        shutil.copyfile(path, copy)
        upload(repo, QUOTA_TAG, copy)
    print(json.dumps({'event': 'quota_saved_to_private_release', 'sha256': digest(path)}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['probe', 'save', 'restore', 'save-quota'])
    parser.add_argument('--run-id', default=os.environ.get('RUN_ID'))
    parser.add_argument('--source-run-id', default=os.environ.get('SOURCE_RUN_ID'))
    parser.add_argument('--artifact-prefix', default=os.environ.get('ARTIFACT_PREFIX', 'production'))
    parser.add_argument('--publish-record-only', action='store_true')
    args = parser.parse_args()
    repo = os.environ['GITHUB_REPOSITORY']
    if args.command == 'save-quota':
        save_quota(repo)
        return
    run_id = identity(args.run_id or '')
    if args.command == 'restore':
        restore(repo, run_id, identity(args.source_run_id or ''), args.artifact_prefix)
        return
    tag = 'pipeline-checkpoint-' + run_id
    data = release(repo, tag)
    if args.command == 'probe':
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ('storage-check-' + execution() + '.json')
            path.write_text(json.dumps({'kind': 'storage-check-only', 'execution': execution()}))
            upload(repo, tag, path)
        print(json.dumps({'event': 'private_release_storage_verified', 'url': data['html_url']}))
        return
    root = Path('data/runs') / run_id
    if not root.exists():
        print(json.dumps({'event': 'checkpoint_not_created_yet'}))
        return
    with tempfile.TemporaryDirectory() as directory:
        source_run_id = identity(os.environ['GITHUB_RUN_ID'])
        attempt = identity(os.environ.get('GITHUB_RUN_ATTEMPT', '1'))
        path, manifest = pack(root, directory, run_id, source_run_id, attempt, record_only=args.publish_record_only)
        for part in manifest['parts']:
            upload(repo, tag, Path(directory) / part['name'])
        upload(repo, tag, path)  # Commit marker LAST; partial uploads are never restored.
    status_path, qa_path = root / 'status.json', root / 'qa.json'
    if not args.publish_record_only and status_path.exists() and qa_path.exists():
        status, qa = json.loads(status_path.read_text()), json.loads(qa_path.read_text())
        if status.get('state') in {'ready_for_private_upload', 'awaiting_owner_thumbnail'} and qa.get('passed') is True:
            names = ['final.mp4', 'thumbnail-A.png', 'thumbnail-B.png', 'thumbnail-C.png',
                     'titles.json', 'final-script.json', 'visual-plan.json', 'audio-QA.json',
                     'visual-QA.json', 'sfx-QA.json', 'production-summary.json', 'metadata.json', 'qa.json']
            if status.get('state') == 'awaiting_owner_thumbnail':
                names = [name for name in names if not name.startswith('thumbnail-')]
                names.append('thumbnail-handoff.json')
            with tempfile.TemporaryDirectory() as directory:
                review = []
                for name in names:
                    original = root / name
                    if not original.exists():
                        raise ValueError('Ready episode is missing a review deliverable: ' + name)
                    path = Path(directory) / ('review-' + execution() + '-' + name)
                    shutil.copyfile(original, path)
                    upload(repo, tag, path)
                    review.append({'name': path.name, 'sha256': digest(path), 'bytes': path.stat().st_size})
                    path.unlink()
                summary = Path(directory) / ('review-' + execution() + '.json')
                summary.write_text(json.dumps({'runId': run_id, 'files': review}, indent=2))
                upload(repo, tag, summary)
    print(json.dumps({'event': 'checkpoint_saved', 'url': data['html_url'], 'files': manifest['files']}))


if __name__ == '__main__':
    main()
