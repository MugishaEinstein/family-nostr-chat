#!/usr/bin/env python3
"""Accept NIP-17 gift wraps only after a NIP-42-authenticated family key is allowed."""
import json
import os
import sys

FAMILY_KEYS = {
    item.strip().lower()
    for item in os.environ.get("FAMILY_PUBKEYS", "").split(",")
    if item.strip()
}

for line in sys.stdin:
    try:
        request = json.loads(line)
        event = request["event"]
        authenticated_key = request.get("authed", "").lower()
        accepted = event.get("kind") == 1059 and authenticated_key in FAMILY_KEYS
        response = {"id": event["id"], "action": "accept" if accepted else "reject"}
        if not accepted:
            response["msg"] = "restricted: relay accepts authenticated family gift-wrap messages only"
        print(json.dumps(response, separators=(",", ":")), flush=True)
    except (KeyError, TypeError, json.JSONDecodeError):
        # A malformed policy request is rejected without crashing the relay plugin.
        print(json.dumps({"id": "", "action": "reject", "msg": "restricted: invalid relay request"}), flush=True)
