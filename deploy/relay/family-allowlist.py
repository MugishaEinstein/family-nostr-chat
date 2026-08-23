#!/usr/bin/env python3
"""Enroll invited devices and accept family gift-wraps from NIP-42-authenticated members."""
import hashlib
import hmac
import json
import os
import sys

LEGACY_KEYS = {
    item.strip().lower()
    for item in os.environ.get("FAMILY_PUBKEYS", "").split(",")
    if item.strip()
}
INVITE_HASH = hashlib.sha256(os.environ.get("FAMILY_INVITE_CODE", "").strip().encode()).hexdigest()
MEMBERS_PATH = os.environ.get("FAMILY_MEMBERS_PATH", "/app/strfry-db/family-members.json")


def load_members():
    try:
        with open(MEMBERS_PATH, "r", encoding="utf-8") as member_file:
            stored = json.load(member_file)
        return {str(key).lower() for key in stored if isinstance(key, str)} | LEGACY_KEYS
    except (OSError, json.JSONDecodeError, TypeError):
        return set(LEGACY_KEYS)


def save_member(pubkey):
    members = load_members()
    if pubkey in members:
        return
    members.add(pubkey)
    temporary_path = f"{MEMBERS_PATH}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as member_file:
        json.dump(sorted(members), member_file, separators=(",", ":"))
    os.replace(temporary_path, MEMBERS_PATH)

for line in sys.stdin:
    try:
        request = json.loads(line)
        event = request["event"]
        authenticated_key = request.get("authed", "").lower()
        event_pubkey = event.get("pubkey", "").lower()
        kind = event.get("kind")

        if kind == 28934:
            claim = next((tag[1] for tag in event.get("tags", []) if tag[:1] == ["claim"] and len(tag) > 1), "")
            accepted = bool(authenticated_key and authenticated_key == event_pubkey and hmac.compare_digest(claim, INVITE_HASH))
            if accepted:
                save_member(authenticated_key)
        else:
            accepted = kind == 1059 and authenticated_key in load_members()

        response = {"id": event["id"], "action": "accept" if accepted else "reject"}
        if not accepted:
            response["msg"] = "restricted: relay accepts authenticated enrolled family messages only"
        print(json.dumps(response, separators=(",", ":")), flush=True)
    except (KeyError, TypeError, OSError, json.JSONDecodeError):
        # A malformed policy request is rejected without crashing the relay plugin.
        print(json.dumps({"id": "", "action": "reject", "msg": "restricted: invalid relay request"}), flush=True)
