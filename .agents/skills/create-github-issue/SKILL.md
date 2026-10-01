---
name: create-github-issue
description: Create and assign a standardized KGB frontend GitHub Issue, then create its local work branch. Use for FE features, bugs, refactors, tests, docs, chores, or CI work. Do not use for backend Issues or Pull Requests.
---

# Create a frontend GitHub Issue

Read [the shared GitHub workflow policy](../references/github-workflow.md) before acting.

## Required input

Collect only missing values. If the request already proves them, do not ask again.

- One controlled type key and domain key
- Concise Korean summary and lowercase ASCII kebab-case branch slug
- GitHub assignee login
- Purpose, scope, acceptance criteria, requirement IDs (or `해당 없음`), references, and impact
- Type-specific fields required by the matching Issue Form

## Workflow

1. Confirm this frontend repository is the worktree root and run the shared preflight checks.
2. Build `[<type>][<domain>] <Korean summary>` and a body matching `.github/ISSUE_TEMPLATE/<type>.yml`. Preserve user intent and do not invent requirements.
3. Create and assign the Issue with the mapped type·domain labels in `100-hours-a-week/KTB4-10th-FE`. Capture its numeric Issue number.
4. Check `git status --porcelain`. If dirty, keep the Issue but do not fetch or switch; report the partial result.
5. Fetch `origin/dev` and create `<branch-type>/<issue-number>-<slug>` from `origin/dev`. Stop without switching if the local branch already exists.
6. Return the Issue URL, assignee, labels, and local branch.

Never push in this workflow. Never delete or close an Issue to compensate for branch creation failure.
