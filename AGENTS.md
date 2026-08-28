# Deployment Policy

Apply these rules to every production-intended change in this repository unless the user explicitly asks not to deploy.

1. Run the smallest relevant validation before committing.
2. Stage only files related to the requested change. Never include unrelated worktree changes, generated files, or secrets.
3. Commit the validated change on its intended branch. The repository's `post-commit` hook pushes that branch to `origin` automatically.
4. For production releases, use `master`. The `Deploy to Tencent Cloud VPS` workflow is the only production deployment path.
5. Wait for GitHub CI and the VPS deployment workflow. Check the Tencent-hosted API `/ready` endpoint plus the web root.
6. If CI or deployment fails, inspect the failing GitHub job and the relevant Tencent VPS deployment logs, repair the root cause, rerun the smallest relevant validation, commit, and push again. Continue until the deployment is healthy or an external credential/platform blocker prevents progress.

Do not force-push, auto-commit unreviewed user work, or retry a failed deploy without first addressing the reported cause. Use `SKIP_AUTO_PUSH=1 git commit ...` only when the user explicitly wants a local-only commit.
