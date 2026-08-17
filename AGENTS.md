# Deployment Policy

Apply these rules to every production-intended change in this repository unless the user explicitly asks not to deploy.

1. Run the smallest relevant validation before committing.
2. Stage only files related to the requested change. Never include unrelated worktree changes, generated files, or secrets.
3. Commit the validated change on its intended branch. The repository's `post-commit` hook pushes that branch to `origin` automatically.
4. For production releases, use `master`. Render is linked to `master` and starts deployment only after GitHub CI passes.
5. Wait for GitHub CI and the `Verify Render deployment` workflow. Check Render service status and the live API `/ready` endpoint plus web root.
6. If CI or deployment fails, inspect the failing GitHub job and the relevant Render build/runtime logs, repair the root cause, rerun the smallest relevant validation, commit, and push again. Continue until the deployment is healthy or an external credential/platform blocker prevents progress.

Do not force-push, auto-commit unreviewed user work, or retry a failed deploy without first addressing the reported cause. Use `SKIP_AUTO_PUSH=1 git commit ...` only when the user explicitly wants a local-only commit.
