# Universal Agent Instructions

Use markdown files in `.issues/..` for managing issues and coordinating work.

## Core Rules
- Track strategic work in markdown files (multi-session, dependencies, discovered work)
- Create markdown issues for work that you need to get to in future sessions; use your own todo task list tool for simple single-session execution
- When in doubt, prefer using markdown files for task persistence so you don't lose context

## Workflow

### Planning Work
- To create a plan for future works, add a new markdown file in `.issues/triage` and write down the current plan as far as it's been developed. This file will be used for planning.
- When the plan is complete, the file can be moved in `.issues/ready` for execution.

### Starting Work
- To start working on the next task list files in `.issues/ready` to find available work defined in markdown files.
- Open a markdown file to review issue details for the chosen task and then move it to `.issues/in-progress` to claim it.
- Print out a short plan and update your local todo task list and then ask me any questions you have as well as asking if you've understood the task correctly and can proceed. Wait for my confirmation.
- As you work and need to save important details on the issue, just edit the markdown file.

### Completing Work
When you've finished a task, give me a summary and ask if it's complete. If you get my confirmation that it's completed then:
- 1. Update the markdown file contents with any pertinent information that changed during the task or that would be good to remember for the future and move it to `.issues/done`.
- 2. Do a grep of the `.issues/blocked` file contents to find any issues for which the just completed issue was a blocker. If so, remove that issue from it's `blocked_by` frontmatter field. If there is now no more issue ids in the `blocked_by` move that blocked issue to `.issues/ready`

### Creating & Updating Issues
- Save new issues into the `.issues/ready` or `.issues/blocked` folders according to their status. The filename is the issue id.
- If an issue depends on another issue being completed first, then place the blocked issue markdown file into `.issues/blocked`.
- Use YAML frontmatter at the top of each markdown file for metadata:
```markdown
---
title: Short descriptive title
type: task|bug|feature
priority: 2              # 0-4 (0=critical, 1=high, 2=medium/default, 3=low, 4=backlog)
assignee: jacob          # optional
blocked_by: [other-issue]  # optional, filename(s) without .md
---

Issue description and details here...
```

## JavaScript Coding Guidelines

- Functions with more than one argument must use an options object instead of positional parameters
- Never pass bare booleans as arguments; use named properties: `{ is_active: true }` not `true`
- Follow existing patterns in neighboring files
- Use `pnpm`
- Use snake_case, not camelCase
- Name files with lowercase and use hyphens between words
- Use Svelte 5 syntax (use the Svelte MCP tool to look things up)
  - use $app/state, not $app/stores
  - don't use createEventDispatcher, user functions passed in as props
- When importing .svelte.ts, include the extension as .svelte.js
- Don't ever use single letter variables except for very short lived loop variables like i, j, k - spell words out
- Add very few comments, only add them if the code is doing something non-obvious. Do not remove comments added by others unless your changes directly make them obsolete or incorrect, then update or remove as needed.
- When adding new functionality to already existing pages or classes, prefer creating new functions in separate files if easy to do so, rather than adding to existing large files.
- When adding functions to buttons in Svelte components, if they are simple functions, just write them inline in the onclick handler. If they are more complex, create a new function in the script block.
- SvelteKit +page.ts and +layout.ts files automatically pass parent data to children, no need to repass it.
