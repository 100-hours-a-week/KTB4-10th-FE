---
name: create-github-pr
description: Ensure frontend work has a matching GitHub Issue, then validate, test, push, and open a standardized Draft Pull Request. Use when FE work is ready to publish, including work without an Issue. Do not use for backend PRs.
---

# Create a frontend Draft Pull Request

Read [the shared GitHub workflow policy](../references/github-workflow.md) before acting.

## Resolve the Issue

1. Inspect the current branch, status, commits, and `git diff origin/dev...HEAD`.
2. Reuse an open Issue only when its purpose and actual diff match.
3. If none exists, derive type, controlled domain, purpose, scope, acceptance criteria, requirement IDs, and impact from the diff and user request. Ask only for material intent that cannot be proven.
4. Create and assign the Issue with both labels. Do not create a second work branch for already implemented work.
5. Rename a local unpublished branch to `<type>/<issue-number>-<slug>` when needed. Do not rename or delete an already published remote branch automatically.

Stop before tests, push, or PR creation if Issue creation or any shared preflight check fails.

## Preflight

- Issue is open and assignee/reviewer are valid and different.
- Worktree is clean before testing.
- Current branch is not `main` or `dev` and normally matches `^(feat|fix|refactor|test|docs|chore|ci)/<issue-number>-[a-z0-9]+(?:-[a-z0-9]+)*$`.
- PR title type matches the branch type.
- No open PR exists for the head branch.

## Workflow

1. Run separately and in order: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`.
2. Stop at the first failure. Do not push or create a PR.
3. Build the PR body from `.github/PULL_REQUEST_TEMPLATE.md`, including `Close #<issue-number>`, test results, user-visible/API/storage/document impact, and review points.
4. Push the current branch and create one Draft PR targeting `dev`, assigned to the worker with the other pair member as default reviewer.
5. Return the PR URL, base/head, Issue, assignee/reviewer, and validation results.

The close workflow completes an Issue only after the PR is merged into `dev`, and only when the branch Issue number matches `Close #<number>`. Do not close an Issue when merely creating a Draft PR. If push succeeds but PR creation fails, keep the remote branch and report the exact failure.
