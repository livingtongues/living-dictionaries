---
title: Set up GitHub Issues sync with local .issues folder
type: feature
priority: 1
github_issue: 629
---

## Goal

Set up bidirectional sync between GitHub issues and local `.issues/` folder, mirroring the system from dev-setup repo.

## What's Been Done

- [x] Copied workflow files:
  - `.github/workflows/issues-pull.yml` - Syncs GitHub issue changes to local files
  - `.github/workflows/issues-push.yml` - Syncs local file changes to GitHub issues
- [x] Copied shell scripts:
  - `.github/workflows/issues-pull-single.sh` - Pulls a single issue from GitHub
  - `.github/workflows/issues-push-single.sh` - Pushes a single local file to GitHub
  - `bin/issues-sync.sh` - Full bidirectional sync script for local use

1. **Run `/issues-setup` from dev-setup repo** - This will:
   - Create GitHub labels: `status:triage`, `status:ready`, `status:blocked`, `status:in-progress`, `status:done`
   - Create type labels: `type:task`, `type:bug`, `type:feature`
   - Create priority labels: `priority:critical`, `priority:high`, `priority:medium`, `priority:low`, `priority:backlog`

2. **Add PROJECT_PAT secret to GitHub repo** - A Personal Access Token with:
   - `repo` scope (for issues)
   - `project` scope (for GitHub Projects, if using)
   
   Add it in: Repository Settings → Secrets and variables → Actions → New repository secret

## How the Sync Works

| Local Folder     | GitHub Label         | Project Column | Issue State |
|------------------|---------------------|----------------|-------------|
| `triage/`        | `status:triage`     | Triage         | open        |
| `ready/`         | `status:ready`      | Ready          | open        |
| `blocked/`       | `status:blocked`    | Blocked        | open        |
| `in-progress/`   | `status:in-progress`| In Progress    | open        |
| `done/`          | `status:done`       | Done           | closed      |

## Known Limitations

- **Project status changes don't trigger workflow** - The `projects_v2_item` event is only available for organization webhooks, not repository webhooks. When moving issues between columns in GitHub Project board, the local files won't auto-update. Status changes should be done locally (moving files between folders).

- **@me for project owner** - The scripts use `@me` instead of explicit username for `gh project` commands, which works reliably with PATs in GitHub Actions. This means the project owner is whoever owns the PAT.

## Reference

See completed issues in dev-setup:
- `.issues/done/github-issues-sync.md` - Original issue sync design
- `.issues/done/github-actions-issue-sync.md` - GitHub Actions workflow implementation
