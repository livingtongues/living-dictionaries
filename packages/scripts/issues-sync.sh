#!/usr/bin/env bash
# issues-sync.sh - Bidirectional sync between local .issues/ and GitHub
# Usage: ./bin/issues-sync.sh [push|pull|sync]
#   push  - Push local changes to GitHub
#   pull  - Pull all open issues from GitHub
#   sync  - Push then pull (default)

set -euo pipefail

MODE="${1:-sync}"

# Get repo info
OWNER=$(gh repo view --json owner -q '.owner.login')
REPO_NAME=$(gh repo view --json name -q '.name')

# Get project linked to this repo with Status field info
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

if [ -z "$PROJECT_NUM" ]; then
  echo "Warning: No GitHub project linked to $OWNER/$REPO_NAME"
fi

get_status_option_id() {
  echo "$PROJECT_DATA" | jq -r --arg name "$1" \
    '.data.repository.projectsV2.nodes[0].field.options[] | select(.name == $name) | .id'
}

declare -A PRIORITY_LABELS=(
  [0]="priority:critical" [1]="priority:high" [2]="priority:medium"
  [3]="priority:low" [4]="priority:backlog"
)

declare -A PRIORITY_NUMBERS=(
  ["priority:critical"]=0 ["priority:high"]=1 ["priority:medium"]=2
  ["priority:low"]=3 ["priority:backlog"]=4
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

status_to_folder() {
  case "$1" in
    Triage) echo "triage" ;;
    Blocked) echo "blocked" ;;
    Ready) echo "ready" ;;
    "In Progress") echo "in-progress" ;;
    Done) echo "done" ;;
    *) echo "triage" ;;
  esac
}

CREATED=0
UPDATED=0
PULLED=0

push_issue() {
  local file="$1"
  local folder
  folder=$(dirname "$file" | xargs basename)
  
  local content
  content=$(cat "$file")
  local fm_end
  fm_end=$(echo "$content" | awk '/^---$/{n++;if(n==2){print NR;exit}}')
  
  local frontmatter body
  frontmatter=$(echo "$content" | sed -n "2,$((fm_end-1))p")
  body=$(echo "$content" | tail -n +$((fm_end+1)))

  local title type priority assignee github_issue
  title=$(echo "$frontmatter" | grep "^title:" | sed 's/^title: *//')
  type=$(echo "$frontmatter" | grep "^type:" | sed 's/^type: *//')
  priority=$(echo "$frontmatter" | grep "^priority:" | sed 's/^priority: *//')
  assignee=$(echo "$frontmatter" | grep "^assignee:" | sed 's/^assignee: *//' || true)
  github_issue=$(echo "$frontmatter" | grep "^github_issue:" | sed 's/^github_issue: *//' || true)

  local labels="type:${type}"
  [ -n "$priority" ] && labels="${labels},${PRIORITY_LABELS[$priority]}"

  local status_name
  status_name=$(folder_to_status "$folder")

  echo "Processing: $file"
  echo "  Title: $title"
  echo "  Folder: $folder -> Status: $status_name"
  
  if [ -z "$github_issue" ]; then
    echo "  Creating new issue..."
    local issue_url issue_num
    issue_url=$(gh issue create --title "$title" --body "$body" --label "$labels")
    issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
    echo "  Created issue #$issue_num"

    if [ -n "$PROJECT_NUM" ]; then
      local item_id option_id
      item_id=$(gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$issue_url" --format json | jq -r '.id')
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

    [ "$folder" = "done" ] && gh issue close "$issue_num" > /dev/null && echo "  Closed issue"
    [ -n "$assignee" ] && gh issue edit "$issue_num" --add-assignee "$assignee" > /dev/null && echo "  Assigned: $assignee"

    # Update frontmatter with github_issue
    local new_fm
    new_fm=$(echo "$frontmatter" | grep -v "^github_issue:")
    new_fm="${new_fm}
github_issue: ${issue_num}"

    { echo "---"; echo "$new_fm"; echo "---"; echo "$body"; } > "$file"
    echo "  Updated frontmatter"
    
    CREATED=$((CREATED + 1))
  else
    # Update existing issue
    local current current_title current_body current_state current_labels desired_labels
    current=$(gh issue view "$github_issue" --json title,body,labels,state)
    current_title=$(echo "$current" | jq -r '.title')
    current_body=$(echo "$current" | jq -r '.body')
    current_state=$(echo "$current" | jq -r '.state')
    current_labels=$(echo "$current" | jq -r '[.labels[].name] | sort | join(",")')
    desired_labels=$(echo "$labels" | tr ',' '\n' | sort | tr '\n' ',' | sed 's/,$//')
    
    local changes_made=false
    echo "  Issue #$github_issue exists, checking for changes..."

    if [ "$current_title" != "$title" ] || [ "$current_body" != "$body" ]; then
      gh issue edit "$github_issue" --title "$title" --body "$body" > /dev/null
      echo "    Updated title/body"
      changes_made=true
    fi
    
    if [ "$current_labels" != "$desired_labels" ]; then
      gh issue edit "$github_issue" --remove-label "type:task,type:bug,type:feature" > /dev/null 2>&1 || true
      gh issue edit "$github_issue" --remove-label "priority:critical,priority:high,priority:medium,priority:low,priority:backlog" > /dev/null 2>&1 || true
      gh issue edit "$github_issue" --add-label "$labels" > /dev/null
      echo "    Updated labels"
      changes_made=true
    fi

    if [ -n "$PROJECT_NUM" ]; then
      local item_data item_id current_status option_id
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

    if [ "$folder" = "done" ] && [ "$current_state" = "OPEN" ]; then
      gh issue close "$github_issue" > /dev/null
      echo "    Closed issue"
      changes_made=true
    elif [ "$folder" != "done" ] && [ "$current_state" = "CLOSED" ]; then
      gh issue reopen "$github_issue" > /dev/null
      echo "    Reopened issue"
      changes_made=true
    fi
    
    [ "$changes_made" = false ] && echo "    No changes needed"
    UPDATED=$((UPDATED + 1))
  fi
  echo ""
}

pull_issue() {
  local issue_num="$1"
  
  local issue_data title body state assignee type priority_label priority
  issue_data=$(gh issue view "$issue_num" --json number,title,body,labels,state,assignees)
  title=$(echo "$issue_data" | jq -r '.title')
  body=$(echo "$issue_data" | jq -r '.body // ""' | sed '/./,$!d')
  state=$(echo "$issue_data" | jq -r '.state')
  assignee=$(echo "$issue_data" | jq -r '.assignees[0].login // ""')
  
  type=$(echo "$issue_data" | jq -r '[.labels[].name | select(startswith("type:"))] | .[0] // "type:task"' | sed 's/type://')
  priority_label=$(echo "$issue_data" | jq -r '[.labels[].name | select(startswith("priority:"))] | .[0] // "priority:medium"')
  priority="${PRIORITY_NUMBERS[$priority_label]:-2}"

  local status_name="" folder
  if [ -n "$PROJECT_NUM" ]; then
    status_name=$(gh api graphql -f query='
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
      }' -f owner="$OWNER" -f repo="$REPO_NAME" \
      --jq ".data.repository.projectsV2.nodes[0].items.nodes[] | select(.content.number == $issue_num) | .fieldValueByName.name // \"\"" 2>/dev/null || echo "")
  fi

  if [ "$state" = "CLOSED" ]; then
    folder="done"
  elif [ -n "$status_name" ]; then
    folder=$(status_to_folder "$status_name")
  else
    folder="triage"
  fi

  # Find existing file
  local existing_file target_file filename
  existing_file=$(grep -rl "^github_issue: $issue_num$" .issues/ 2>/dev/null | head -1 || echo "")

  if [ -n "$existing_file" ]; then
    local current_folder
    current_folder=$(dirname "$existing_file" | xargs basename)
    filename=$(basename "$existing_file")
    
    if [ "$current_folder" != "$folder" ]; then
      echo "  Moving $existing_file to .issues/$folder/"
      mv "$existing_file" ".issues/$folder/$filename"
    fi
    target_file=".issues/$folder/$filename"
  else
    filename=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//').md
    target_file=".issues/$folder/$filename"
  fi

  echo "Pulling issue #$issue_num to $target_file"
  echo "  Title: $title"
  echo "  Status: ${status_name:-unknown} -> Folder: $folder"

  {
    echo "---"
    echo "title: $title"
    echo "type: $type"
    echo "priority: $priority"
    [ -n "$assignee" ] && echo "assignee: $assignee"
    echo "github_issue: $issue_num"
    echo "---"
    echo ""
    echo "$body"
  } > "$target_file"

  PULLED=$((PULLED + 1))
  echo ""
}

do_push() {
  echo "Pushing local issues to GitHub..."
  echo "Owner: $OWNER, Repo: $REPO_NAME"
  [ -n "$PROJECT_NUM" ] && echo "Project: $PROJECT_NUM"
  echo ""

  for folder in triage ready blocked in-progress done; do
    for file in .issues/"$folder"/*.md; do
      [ -f "$file" ] && push_issue "$file"
    done
  done
}

do_pull() {
  echo "Pulling open issues from GitHub..."
  echo ""
  
  local issues
  issues=$(gh issue list --state open --json number --jq '.[].number')
  
  for issue_num in $issues; do
    pull_issue "$issue_num"
  done
}

# Main
case "$MODE" in
  push)
    do_push
    ;;
  pull)
    do_pull
    ;;
  sync)
    do_push
    do_pull
    ;;
  *)
    echo "Usage: $0 [push|pull|sync]"
    exit 1
    ;;
esac

echo "========================================"
echo "Summary: Created=$CREATED, Updated=$UPDATED, Pulled=$PULLED"
echo "========================================"
