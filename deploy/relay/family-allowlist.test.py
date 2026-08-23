#!/usr/bin/env python3
"""Regression test for the shared relay's family-membership authorization policy."""
import json
import os
import subprocess
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
POLICY = PROJECT_ROOT / "deploy" / "relay" / "family-allowlist.py"
FAMILY_ID = "family-a"
SENDER = "a" * 64
RECIPIENT = "b" * 64
OUTSIDER = "c" * 64


def event(event_id: str, recipient: str, family_id: str = FAMILY_ID, pubkey: str = SENDER):
    return {
        "id": event_id,
        "kind": 1059,
        "pubkey": pubkey,
        "tags": [["h", family_id], ["p", recipient]],
    }


with tempfile.TemporaryDirectory() as directory:
    registry_path = Path(directory) / "family-registry.json"
    registry_path.write_text(
        json.dumps({"version": 1, "spaces": {FAMILY_ID: {"members": [SENDER, RECIPIENT]}}}),
        encoding="utf-8",
    )
    requests = [
        {"event": event("same-family", RECIPIENT), "authed": SENDER},
        {"event": event("same-family-no-authed-field", RECIPIENT)},
        {"event": event("outsider-recipient", OUTSIDER), "authed": SENDER},
        {"event": event("outsider-sender", RECIPIENT), "authed": OUTSIDER},
        {"event": event("outsider-outer-key", RECIPIENT, pubkey=OUTSIDER)},
    ]
    environment = {**os.environ, "FAMILY_REGISTRY_PATH": str(registry_path)}
    completed = subprocess.run(
        ["python3", str(POLICY)],
        input="".join(json.dumps(request) + "\n" for request in requests),
        text=True,
        capture_output=True,
        check=True,
        env=environment,
    )
    responses = [json.loads(line) for line in completed.stdout.splitlines()]

assert responses[0] == {"id": "same-family", "action": "accept"}
assert responses[1] == {"id": "same-family-no-authed-field", "action": "accept"}
assert responses[2]["action"] == "reject"
assert responses[3]["action"] == "reject"
assert responses[4]["action"] == "reject"
print("family allowlist policy: authenticated or outer-member sender accept; cross-family reject")
