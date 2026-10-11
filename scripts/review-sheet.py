"""Owner review sheet: every beat whose illustration was rejected, with each drawn attempt, its QA reasons and SHA-256.

Usage: python3 scripts/review-sheet.py data/runs/<run_id> <out_dir>
Writes <out_dir>/README.md and one small JPEG per attempt. Nothing is approved here; the owner lists approved
SHA-256 values in data/scripts/<run_id>-owner-approved-illustrations.json.
"""
import glob, json, os, re, subprocess, sys

run, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
plan = json.load(open(os.path.join(run, 'visual-thinking-v5.json')))
shots = plan.get('shots', plan) if isinstance(plan, dict) else plan

def attempts(shot_id):
    found = []
    for source in sorted(glob.glob(os.path.join(run, f'native-{shot_id}*-source.json'))):
        stage = os.path.basename(source)[len('native-'):-len('-source.json')]
        if not re.fullmatch(re.escape(shot_id) + r'(-regen1)?(-p\d)?', stage):
            continue
        review_path = os.path.join(run, f'native-{stage}-density-QA-v4.3.json')
        review = json.load(open(review_path)) if os.path.exists(review_path) else None
        found.append((stage, json.load(open(source)), review))
    return found

rows, accepted = [], 0
for index, shot in enumerate(shots, 1):
    tries = attempts(shot['id'])
    if any(r and r.get('passed') for _, _, r in tries):
        accepted += 1
        continue
    idea = shot.get('illustrationIdea') or {}
    rows.append(f"\n## {index:03d} · `{shot['id']}`\n\n**Narración:** {shot.get('narration')}\n\n**Escena pedida:** {idea.get('concept')}\n")
    if not tries:
        rows.append('\n_Sin imagen: el pedido fue rechazado antes de dibujar o Cloudflare la bloqueó._\n')
    for stage, source, review in tries:
        name = f"{index:03d}-{stage}.jpg"
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', source['path'], '-vf', 'scale=960:-2', '-q:v', '4', os.path.join(out, name)], check=True)
        reasons = (review or {}).get('objectiveFailures') or []
        issues = (review or {}).get('issues') or []
        rows.append(f"\n![{stage}]({name})\n\n- Intento: `{stage}` · SHA-256 `{source['sha256']}`\n- Fallas: {', '.join(reasons) or 'sin revisión'}\n- Detalle: {' / '.join(issues)[:600]}\n")

header = f"# Revisión de tomas rechazadas — {os.path.basename(run.rstrip('/'))}\n\nAprobadas por el control: {accepted} de {len(shots)} escenas. Rechazadas: {len(shots) - accepted}.\n\nPara aprobar una toma, indicá su número de escena y su intento (o el SHA-256). Las que no apruebes se unen a la escena vecina.\n"
open(os.path.join(out, 'README.md'), 'w').write(header + ''.join(rows))
print(f'{len(shots) - accepted} rejected beats written to {out}')
