# Architecture Overview

## Project Structure
This is a monorepo containing...

### Key Directories
- `/site` - Main SvelteKit sitelication
  - `/site/src/routes/(site)` - Main site routes
  - `/site/src/lib` - Shared libraries and utilities
    - `/lib/i18n` - Internationalization
    - `/lib/supabase` - Supabase client and types
- `/supabase` - Supabase configuration and functions
- `/scripts` - Build and utility scripts

### Technology Stack
- **Frontend**: SvelteKit 2 with Svelte 4 syntax
- **Backend**: SvelteKit server endpoints
- **Styling**: UnoCSS (Tailwind CSS syntax) with Iconify icons
- **Database**: 
  - Supabase (auth, functions, shared data, storage)
- **Internationalization**: Custom i18n system
- **Package Manager**: pnpm (workspace monorepo)

### Data Architecture

### Key Features

## Coding Guidelines

- Use snake_case, not camelCase
- Use Svelte 4 syntax
- Use hard-coded constants in lib/constants.ts instead of arbitrary string values
- Use Tailwind CSS for styling (I actually use UnoCSS but the syntax is the same)
  - I use all the iconify icons available, inserted like this: <span class="i-iconamoon-arrow-left-1"></span>
- Don't run any bash commands to check, dev, lint, etc
- Use ALLCAPS for SQL keywords (Supabase likes to user lowercase, so fix when possible)
- When adding strings, place them in English in `src/lib/i18n/locales/en.json`. We will manually take care of the other languages with human translators. Don't try to add anything other than English. Import { page } from '$app/stores' and use {$page.data.t.section.id} to access them in Svelte files.
- Don't ever use single letter variables except for very short lived loop variables like i, j, k - spell words out
- Use very few comments, only use them if the code is doing something non-obvious
- When you add packages and consult documentation, leave the links in PRs and conversation threads so I can check your work.