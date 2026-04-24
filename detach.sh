#!/bin/bash
# Detach this project folder from the erium/app-template repository.
#
# Run this ONCE right after cloning the template. It removes the template's
# git history so accidental `git push` cannot reach the upstream template,
# then initializes a fresh repository with your first commit.
#
# Safe to run if already detached — it detects the current remote and exits
# cleanly if the project is not linked to erium/app-template.
#
# Usage: bash detach.sh

set -e
cd "$(dirname "$0")"

TEMPLATE_MATCH="erium/app-template"

remote_url() {
  git config --get remote.origin.url 2>/dev/null || true
}

if [ ! -d .git ]; then
  echo "No .git directory — initializing a fresh repo."
  git init
  git add -A
  git commit -m "Initial commit from template"
  echo "Done. New repo initialized."
  exit 0
fi

URL="$(remote_url)"

if [ -z "$URL" ]; then
  echo "No 'origin' remote configured — already detached. Nothing to do."
  exit 0
fi

case "$URL" in
  *"$TEMPLATE_MATCH"*)
    echo "Detected template remote: $URL"
    echo "Wiping template history and initializing a fresh repo..."
    rm -rf .git
    git init
    git add -A
    git commit -m "Initial commit from template"
    echo ""
    echo "Detached. Add your own remote with:"
    echo "  git remote add origin <your-repo-url>"
    echo "  git push -u origin main"
    ;;
  *)
    echo "Remote is '$URL' — not the template. Nothing to do."
    ;;
esac
