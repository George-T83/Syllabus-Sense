#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- Dependencies -----------------------------------------------------
# Container state is cached after this hook completes, so `npm install`
# (not `npm ci`) is preferred - it can reuse whatever's already there on a
# warm container instead of always doing a clean install.
npm install

# --- Commit signing -----------------------------------------------------
# Configures git to sign commits as George-T83 so they show as "Verified"
# on GitHub, using a key persisted outside this ephemeral container.
#
# Set these as environment variables on this Claude Code on the web
# environment (Settings -> Environments -> this environment -> Environment
# Variables) for this to activate - the hook no-ops safely if they're
# absent, so it's safe to merge before that's configured:
#   GPG_SIGNING_KEY_B64  - base64 of `gpg --armor --export-secret-keys <key-id>`
#   GPG_SIGNING_KEY_ID   - the key's fingerprint/ID (from `gpg --list-secret-keys`)
#
# The matching public key (`gpg --armor --export <key-id>`) needs to be
# added once at github.com/settings/gpg/new - that part doesn't need to be
# repeated per session, only the private-key import below does.
if [ -n "${GPG_SIGNING_KEY_B64:-}" ] && [ -n "${GPG_SIGNING_KEY_ID:-}" ]; then
  echo "${GPG_SIGNING_KEY_B64}" | base64 -d | gpg --batch --import 2>/dev/null || true
  git config --global user.name "George-T83"
  git config --global user.email "george.tannious@gmail.com"
  git config --global user.signingkey "${GPG_SIGNING_KEY_ID}"
  git config --global gpg.format openpgp
  git config --global gpg.program gpg
  git config --global commit.gpgsign true
  echo "Commit signing configured for George-T83."
else
  echo "GPG_SIGNING_KEY_B64/GPG_SIGNING_KEY_ID not set - commit signing not configured this session."
fi
