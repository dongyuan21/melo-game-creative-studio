#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-dongyuan21}"
REPOSITORY="${2:-melo-game-creative-studio}"
VISIBILITY="${3:-public}"
FULL_NAME="${OWNER}/${REPOSITORY}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

if gh repo view "$FULL_NAME" >/dev/null 2>&1; then
  echo "Using existing repository: $FULL_NAME"
else
  gh repo create "$FULL_NAME" "--$VISIBILITY" --description \
    "Browser-first block-placement gameplay director and deterministic IAA video renderer."
fi

REMOTE_URL="git@github.com:${FULL_NAME}.git"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git push -u origin main --follow-tags
echo "Published: https://github.com/$FULL_NAME"
