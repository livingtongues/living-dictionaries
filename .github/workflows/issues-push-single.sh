#!/usr/bin/env bash
# issues-push-single.sh - Push a single local issue file to GitHub
# Usage: ./bin/issues-push-single.sh .issues/ready/my-issue.md

set -euo pipefail

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

# Get repo info
REPO_INFO=$(gh repo view --json owner,name)
OWNER=$(echo "$REPO_INFO" | jq -r '.owner.login')
REPO_NAME=$(echo "$REPO_INFO" | jq -r '.name')

# For gh project commands, use @me for user-owned projects
# This works more reliably with PATs in GitHub Actions
PROJECT_OWNER="@me"

# Get project linked to this repo
PROJECT_DATA=$(gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      projectsV2(first: 1) {
        nodes { 
          id 
          number
          field(name: "Status") {
            ... on ProjectV2SingleSelectField {
              id
              options { id name }
            }
          }
        }
      }
    }
  }' -f owner="$OWNER" -f repo="$REPO_NAME")

PROJECT_NUM=$(echo "$PROJECT_DATA" | jq -r '.data.repository.projectsV2.nodes[0].number // empty')
PROJECT_ID=$(echo "$PROJECT_DATA" | jq -r '.data.repository.projectsV2.nodes[0].id // empty')
FIELD_ID=$(echo "$PROJECT_DATA" | jq -r '.data.repository.projectsV2.nodes[0].field.id // empty')

get_status_option_id() {
  echo "$PROJECT_DATA" | jq -r --arg name "$1" \
    '.data.repository.projectsV2.nodes[0].field.options[] | select(.name == $name) | .id'
}

declare -A PRIORITY_LABELS=(
  [0]="priority:critical" [1]="priority:high" [2]="priority:medium"
  [3]="priority:low" [4]="priority:backlog"
)

folder_to_status() {
  case "$1" in
    triage) echo "Triage" ;;
    blocked) echo "Blocked" ;;
    ready) echo "Ready" ;;
    in-progress) echo "In Progress" ;;
    done) echo "Done" ;;
  esac
}

# Parse file
folder=$(dirname "$FILE" | xargs basename)
content=$(cat "$FILE")
fm_end=$(echo "$content" | awk '/^---$/{n++;if(n==2){print NR;exit}}')
frontmatter=$(echo "$content" | sed -n "2,$((fm_end-1))p")
body=$(echo "$content" | tail -n +$((fm_end+1)))

# Extract frontmatter fields
title=$(echo "$frontmatter" | grep "^title:" | sed 's/^title: *//')
type=$(echo "$frontmatter" | grep "^type:" | sed 's/^type: *//')
priority=$(echo "$frontmatter" | grep "^priority:" | sed 's/^priority: *//')
assignee=$(echo "$frontmatter" | grep "^assignee:" | sed 's/^assignee: *//' || true)
github_issue=$(echo "$frontmatter" | grep "^github_issue:" | sed 's/^github_issue: *//' || true)

# Build labels
labels="type:${type}"
[ -n "$priority" ] && labels="${labels},${PRIORITY_LABELS[$priority]}"

status_name=$(folder_to_status "$folder")

echo "Processing: $FILE"
echo "  Title: $title"
echo "  Folder: $folder -> Status: $status_name"

if [ -z "$github_issue" ]; then
  # Create new issue
  echo "  Creating new issue..."
  issue_url=$(gh issue create --title "$title" --body "$body" --label "$labels")
  issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
  echo "  Created issue #$issue_num"

  # Add to project if exists
  if [ -n "$PROJECT_NUM" ]; then
    item_id=$(gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$issue_url" --format json | jq -r '.id')
    option_id=$(get_status_option_id "$status_name")

    gh api graphql -f query='
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }) { projectV2Item { id } }
      }' -f projectId="$PROJECT_ID" -f itemId="$item_id" -f fieldId="$FIELD_ID" -f optionId="$option_id" > /dev/null
    echo "  Set status: $status_name"
  fi

  # Close if in done folder
  [ "$folder" = "done" ] && gh issue close "$issue_num" > /dev/null && echo "  Closed issue"

  # Add assignee if set
  [ -n "$assignee" ] && gh issue edit "$issue_num" --add-assignee "$assignee" > /dev/null && echo "  Assigned: $assignee"

  # Update frontmatter with github_issue
  new_fm=$(echo "$frontmatter" | grep -v "^github_issue:" | grep -v "^synced_at:")
  new_fm="${new_fm}
github_issue: ${issue_num}"

  { echo "---"; echo "$new_fm"; echo "---"; echo "$body"; } > "$FILE"
  echo "  Updated frontmatter"

else
  # Update existing issue - fetch current state first
  current=$(gh issue view "$github_issue" --json title,body,labels,state)
  current_title=$(echo "$current" | jq -r '.title')
  current_body=$(echo "$current" | jq -r '.body')
  current_state=$(echo "$current" | jq -r '.state')
  current_labels=$(echo "$current" | jq -r '[.labels[].name] | sort | join(",")')
  desired_labels=$(echo "$labels" | tr ',' '\n' | sort | tr '\n' ',' | sed 's/,$//')

  changes_made=false
  echo "  Issue #$github_issue exists, checking for changes..."

  # Update title/body only if different
  if [ "$current_title" != "$title" ] || [ "$current_body" != "$body" ]; then
    gh issue edit "$github_issue" --title "$title" --body "$body" > /dev/null
    echo "    Updated title/body"
    changes_made=true
  fi

  # Update labels only if different
  if [ "$current_labels" != "$desired_labels" ]; then
    gh issue edit "$github_issue" --remove-label "type:task,type:bug,type:feature" > /dev/null 2>&1 || true
    gh issue edit "$github_issue" --remove-label "priority:critical,priority:high,priority:medium,priority:low,priority:backlog" > /dev/null 2>&1 || true
    gh issue edit "$github_issue" --add-label "$labels" > /dev/null
    echo "    Updated labels"
    changes_made=true
  fi

  # Update project status only if different
  if [ -n "$PROJECT_NUM" ]; then
    item_data=$(gh api graphql -f query='
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 1) {
            nodes { 
              items(first: 100) {
                nodes { 
                  id 
                  content { ... on Issue { number } }
                  fieldValueByName(name: "Status") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                }
              }
            }
          }
        }
      }' -f owner="$OWNER" -f repo="$REPO_NAME" \
      --jq ".data.repository.projectsV2.nodes[0].items.nodes[] | select(.content.number == $github_issue)")

    item_id=$(echo "$item_data" | jq -r '.id // empty')
    current_status=$(echo "$item_data" | jq -r '.fieldValueByName.name // ""')

    if [ -n "$item_id" ] && [ "$current_status" != "$status_name" ]; then
      option_id=$(get_status_option_id "$status_name")
      gh api graphql -f query='
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
            value: { singleSelectOptionId: $optionId }
          }) { projectV2Item { id } }
        }' -f projectId="$PROJECT_ID" -f itemId="$item_id" -f fieldId="$FIELD_ID" -f optionId="$option_id" > /dev/null
      echo "    Updated status: $status_name"
      changes_made=true
    fi
  fi

  # Handle open/close state
  if [ "$folder" = "done" ] && [ "$current_state" = "OPEN" ]; then
    gh issue close "$github_issue" > /dev/null
    echo "    Closed issue"
    changes_made=true
  elif [ "$folder" != "done" ] && [ "$current_state" = "CLOSED" ]; then
    gh issue reopen "$github_issue" > /dev/null
    echo "    Reopened issue"
    changes_made=true
  fi

  if [ "$changes_made" = false ]; then
    echo "    No changes needed"
  fi
fi
