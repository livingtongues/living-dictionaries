# Universal Agent Instructions

## Core Rules
- Track work in markdown files in `.issues/..` for coordination and memory.
- Always verify your work with tests, browser use/screenshots, log messages, etc, based on the type of task. We want to use good feedback loops. If you don't have the tooling in place yet to verify your work, tell me what you need and we'll work together to get it setup.

## Workflow

### Planning Work
- To create a plan for work, add a new markdown file in `.issues/triage` with this format:
```markdown
---
title: Short descriptive title
type: task|bug|feature
priority: 2              # 0-4 (0=critical, 1=high, 2=medium/default, 3=low, 4=backlog)
assignee: jacob          # optional
blocked_by: [other-issue]  # optional, filename(s) without .md
---

Issue description and plan details here...
```
- proceed to write down the current plan. You and I will iterate on this document until all your questions are answered and until I'm satisfied that the plan is complete and thorough. Do a very thorough job of reading the codebase as we make a plan. Be comprehensive and write down everything of value into the plan. Most likely after we make a thorough plan, I'm going to clear the session and start fresh on implementing the task with just the plan file.
- Sometimes I will just mention an issue to you and won't have time to work on a plan. It that situation, just write down a brief plan according to your current knowledge and then make some notes about what needs researched in the future to complete the plan.
- When the plan is complete, the file can be moved to `.issues/ready`, unless the task depends on another issue being completed first, then place the blocked issue markdown file into `.issues/blocked`.

### Starting Work
- You can start implementing a task when I point you to an issue markdown file. Read it and then move it to `.issues/in-progress`.
- As you work, be sure to update the markdown file often, checking off completed tasks with a ✅, saving important lessons learned and other pertinent details on the issue that would be needed if a new coding session was required to continue this task. By the time you finish a task, the markdown file should have been turned into a journal of what happened and what we should remember from the process. Try to make small, incremental edits to the markdown file and not wipe out big chunks unless they're completely irrelevant because our course of action took a different direction.

### Completing Work
When you've finished a task, give me a summary and ask if it's complete. If you get my confirmation that it's completed then:
- 1. Update the markdown file contents with any further pertinent information that you learned during the task that hasn't already been recorded or that would be good to remember for the future and move it to `.issues/done`.

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
- Don't use ! at the end of values to assert they exist. I don't use strict ts mode anyway so it's just noise.

## General Guidelines
- I use voice transcription to write out my messages to you sometimes so if an underscore is missing when saying a function or db table name or something is misspelled, just extrapolate and don't take spoken names too literally if the punctuation is a little off because of the transcription process.
- If you are working with code and using an environment variable name, don't try to read any .env files. Just assume I've already taken care of adding the proper variables and continue on.
