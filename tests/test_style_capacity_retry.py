import importlib.util
import unittest
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location("retry", "scripts/resume-style-capacity.py")
retry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retry)


class StyleCapacityRetryTests(unittest.TestCase):
    def test_only_due_capacity_and_unknown_are_eligible(self):
        policy = {"allowedStates": ["cloudflare_out_of_capacity", "cloudflare_429_unknown", "paused_quota"], "maximumAutomaticAttempts": 3}
        now = datetime(2026, 10, 8, 12, 30, tzinfo=timezone.utc)
        base = {"state": "cloudflare_out_of_capacity", "resumeAfter": "2026-10-08T12:20:00Z", "paidFallback": False, "automaticResumeAttempt": 0}
        self.assertEqual(retry.eligible(base, policy, now), 1)
        self.assertEqual(retry.eligible(dict(base, state="cloudflare_429_unknown"), policy, now), 1)
        for update in [{"state": "paused_quota"}, {"state": "failed"}, {"state": "complete_awaiting_human_style_approval"}, {"paidFallback": True}, {"automaticResumeAttempt": 3}, {"resumeAfter": "2026-10-08T13:00:00Z"}]:
            self.assertIsNone(retry.eligible(dict(base, **update), policy, now))


if __name__ == "__main__":
    unittest.main()
