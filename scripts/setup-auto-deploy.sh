#!/usr/bin/env sh

set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if ! git remote get-url origin >/dev/null 2>&1; then
  printf '%s\n' 'Missing Git remote "origin". Add it before enabling automatic pushes.' >&2
  exit 1
fi

chmod +x .githooks/post-commit
git config core.hooksPath .githooks

printf '%s\n' 'Automatic push hook enabled.'
printf '%s\n' 'Each successful git commit now pushes its current branch to origin.'
printf '%s\n' 'Render deploys master only after GitHub CI passes.'
printf '%s\n' 'Use SKIP_AUTO_PUSH=1 git commit ... to keep an individual commit local.'
