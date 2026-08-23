#!/usr/bin/env python3
"""Authorize multi-family tenant-tagged gift-wraps from NIP-42-authenticated devices."""
import json
import os
import sys

REGISTRY_PATH = os.environ.get("FAMILY_REGISTRY_PATH", "/app/family-state/family-registry.json")


def load_spaces():
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as registry_file:
            registry = json.load(registry_file)
        spaces = registry.get("spaces", {})
        if not isinstance(spaces, dict):
            return {}
        return {
            str(family_id): {str(key).lower() for key in value.get("members", []) if isinstance(key, str)}
            for family_id, value in spaces.items()
            if isinstance(value, dict)
        }
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def tag_value(event, key):
    return next((tag[1] for tag in event.get("tags", []) if len(tag) > 1 and tag[0] == key), "")


for line in sys.stdin:
    try:
        request = json.loads(line)
        event = request["event"]
        authed = str(request.get("authed") or "").lower()
        family_id = tag_value(event, "h")
        recipient = tag_value(event, "p").lower()
        members = load_spaces().get(family_id, set())
        authenticated = bool(authed)
        accepted = event.get("kind") == 1059 and bool(family_id) and authenticated and authed in members and recipient in members
        response = {"id": event["id"], "action": "accept" if accepted else "reject"}
        if not authenticated:
            response["msg"] = "auth-required: authenticate this device before publishing family messages"
        elif not accepted:
            response["msg"] = "restricted: this device or recipient is not authorized for that family space"
        print(json.dumps(response, separators=(",", ":")), flush=True)
    except (KeyError, TypeError, json.JSONDecodeError):
        print(json.dumps({"id": "", "action": "reject", "msg": "restricted: invalid relay request"}), flush=True)
