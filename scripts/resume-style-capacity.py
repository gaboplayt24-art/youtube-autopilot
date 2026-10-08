"""Resume only the authorized style audition after a temporary CF rejection.

Never resume daily exhaustion, failed style QA, a video or a paid provider.
"""
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def api(endpoint, payload=None):
    args = ["gh", "api", endpoint]
    if payload is not None:
        args += ["--method", "POST", "--input", "-"]
    result = subprocess.run(args, input=json.dumps(payload) if payload else None,
                            capture_output=True, text=True, check=True, timeout=45)
    return json.loads(result.stdout) if result.stdout.strip() else None


def eligible(checkpoint, policy, now):
    attempt = int(checkpoint.get("automaticResumeAttempt", 0))
    if checkpoint.get("state") not in {"cloudflare_out_of_capacity", "cloudflare_429_unknown"} or checkpoint.get("state") not in policy["allowedStates"]:
        return None
    if checkpoint.get("paidFallback") is not False or attempt >= policy["maximumAutomaticAttempts"]:
        return None
    due = datetime.fromisoformat(checkpoint["resumeAfter"].replace("Z", "+00:00"))
    return attempt + 1 if now >= due else None


def main():
    policy = json.loads(Path("config/style-capacity-retry.json").read_text())
    if not policy["enabled"]:
        return
    repo = os.environ["GITHUB_REPOSITORY"]
    endpoint = f"repos/{repo}/actions/workflows/style-audition-v4.yml/runs?branch=main&per_page=30"
    runs = api(endpoint)["workflow_runs"]
    if any(run["status"] != "completed" for run in runs):
        print("An audition is active; no duplicate dispatch")
        return
    name = "style-test-" + policy["runId"]
    for run in runs[:10]:
        artifacts = api(f"repos/{repo}/actions/runs/{run['id']}/artifacts")["artifacts"]
        if not any(a["name"] == name and not a["expired"] for a in artifacts):
            continue
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["gh", "run", "download", str(run["id"]), "--repo", repo,
                            "--name", name, "--dir", directory], check=True, timeout=90)
            checkpoint_path = Path(directory) / "quota-checkpoint.json"
            if not checkpoint_path.exists():
                return
            checkpoint = json.loads(checkpoint_path.read_text())
            summary = json.loads((Path(directory) / "audition-summary-v4.json").read_text())
            if summary["state"] not in policy["allowedStates"]:
                return
            attempt = eligible(checkpoint, policy, datetime.now(timezone.utc))
            if attempt is None:
                print("Checkpoint is not due, is daily exhaustion, or reached its automatic limit")
                return
            api(f"repos/{repo}/actions/workflows/style-audition-v4.yml/dispatches", {
                "ref": "main", "inputs": {"run_id": policy["runId"],
                "source_run_id": str(run["id"]), "reference_path": policy["referencePath"],
                "reference_url": "", "validate_only": "false",
                "capacity_resume_attempt": str(attempt)}})
            print(json.dumps({"event": "style_capacity_resume_dispatched", "sourceRun": run["id"],
                              "attempt": attempt, "runId": policy["runId"]}))
            return


if __name__ == "__main__":
    main()
