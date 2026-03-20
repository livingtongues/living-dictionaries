#!/usr/bin/env bash
# issues-pull-single.sh - Pull a single GitHub issue to local file
# Usage: ./bin/issues-pull-single.sh 42

set -euo pipefail

ISSUE_NUM="$1"
if [ -z "$ISSUE_NUM" ]; then
  echo "Usage: $0 <issue-number>"
  exit 1
fi

# Get repo info
OWNER=$(gh repo view --json owner -q '.owner.login')
REPO_NAME=$(gh repo view --json name -q '.name')

# Fetch issue data
ISSUE_DATA=$(gh issue view "$ISSUE_NUM" --json number,title,body,labels,state,assignees)
title=$(echo "$ISSUE_DATA" | jq -r '.title')
body=$(echo "$ISSUE_DATA" | jq -r '.body // ""' | sed '/./,$!d')
state=$(echo "$ISSUE_DATA" | jq -r '.state')
assignee=$(echo "$ISSUE_DATA" | jq -r '.assignees[0].login // ""')

# Parse labels for type and priority
type=$(echo "$ISSUE_DATA" | jq -r '[.labels[].name | select(startswith("type:"))] | .[0] // "type:task"' | sed 's/type://')
priority_label=$(echo "$ISSUE_DATA" | jq -r '[.labels[].name | select(startswith("priority:"))] | .[0] // "priority:medium"')

# Map priority label to number
case "$priority_label" in
  priority:critical) priority=0 ;;
  priority:high) priority=1 ;;
  priority:medium) priority=2 ;;
  priority:low) priority=3 ;;
  priority:backlog) priority=4 ;;
  *) priority=2 ;;
esac

# Get project status if available
status_name=""
PROJECT_DATA=$(gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      projectsV2(first: 1) {
        nodes { 
          items(first: 100) {
            nodes { 
              content { ... on Issue { number } }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
    }
  }' -f owner="$OWNER" -f repo="$REPO_NAME" 2>/dev/null || echo "{}")

status_name=$(echo "$PROJECT_DATA" | jq -r \
  ".data.repository.projectsV2.nodes[0].items.nodes[] | select(.content.number == $ISSUE_NUM) | .fieldValueByName.name // \"\"" 2>/dev/null || echo "")

# Determine folder from status (or state if no project)
if [ "$state" = "CLOSED" ]; then
  folder="done"
elif [ -n "$status_name" ]; then
  case "$status_name" in
    Triage) folder="triage" ;;
    Blocked) folder="blocked" ;;
    Ready) folder="ready" ;;
    "In Progress") folder="in-progress" ;;
    Done) folder="done" ;;
    *) folder="triage" ;;
  esac
else
  folder="triage"
fi

# Find existing file with this github_issue number
existing_file=$(grep -rl "^github_issue: $ISSUE_NUM$" .issues/ 2>/dev/null | head -1 || echo "")

if [ -n "$existing_file" ]; then
  # File exists - check if it needs to move folders
  current_folder=$(dirname "$existing_file" | xargs basename)
  filename=$(basename "$existing_file")
  
  if [ "$current_folder" != "$folder" ]; then
    echo "Moving $existing_file to .issues/$folder/"
    mv "$existing_file" ".issues/$folder/$filename"
    target_file=".issues/$folder/$filename"
  else
    target_file="$existing_file"
  fi
else
  # New file - generate filename from title
  filename=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//').md
  target_file=".issues/$folder/$filename"
fi

echo "Pulling issue #$ISSUE_NUM to $target_file"
echo "  Title: $title"
echo "  Status: $status_name -> Folder: $folder"

# Build frontmatter
{
  echo "---"
  echo "title: $title"
  echo "type: $type"
  echo "priority: $priority"
  [ -n "$assignee" ] && echo "assignee: $assignee"
  echo "github_issue: $ISSUE_NUM"
  echo "---"
  echo ""
  echo "$body"
} > "$target_file"

echo "  Written to: $target_file"
