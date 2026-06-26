# Architecture Overview

## Project Structure
This is a pnpm workspace monorepo containing the Living Dictionaries web application, a mobile-first community-focused dictionary-building platform built by Living Tongues Institute for Endangered Languages. The repository uses SvelteKit 2 for the main application and backend serverless functions hosted on Vercel. Supabase is used for database and authentication.

### Key Directories
- `/packages/site` - Main SvelteKit application
  - `/packages/site/src/routes` - SvelteKit routes and API endpoints
  - `/packages/site/src/lib` - Shared libraries and utilities
    - `/lib/components` - Reusable Svelte components (modals, keyboards, UI elements, maps)
    - `/lib/i18n` - Internationalization system with locale files
    - `/lib/supabase` - Supabase client, operations, and authentication
    - `/lib/helpers` - Utility functions and transformers
    - `/lib/constants.ts` - Application-wide constants (use these instead of magic strings)
    - `/lib/search` - Orama search integration
    - `/lib/export` - Data export functionality
    - `/lib/mocks` - Test mocks and seed data
  - `/packages/site/src/docs` - Documentation (markdown files served via Kitbook) - out of date
- `/packages/types` - Shared TypeScript types and interfaces
  - Database types (Supabase generated + custom)
  - Entry, dictionary, and user interfaces
  - GeoJSON, photo, video types
- `/packages/scripts` - Utility scripts for data operations
  - Database migrations and imports
  - Type generation and merging
  - Spreadsheet helpers
  - Locale updates
- `/supabase` - Supabase configuration
  - `/supabase/migrations` - Database schema migrations (SQL)
  - `/supabase/config.toml` - Supabase project configuration
- Root configuration files (ESLint, Vitest workspace, UnoCSS, etc.)

### Technology Stack
- **Frontend**: SvelteKit 2 with Svelte 4 syntax
- **Backend**: SvelteKit server endpoints (+server.ts files)
- **Styling**: UnoCSS with Tailwind CSS syntax
  - Svelte-scoped UnoCSS configuration
  - Iconify icons (prefix: `i-`, e.g., `<span class="i-iconamoon-arrow-left-1"></span>`)
  - Forms preset from `@julr/unocss-preset-forms`
- **Database & Auth**: 
  - Supabase (PostgreSQL with Row Level Security)
  - Authentication via Supabase Auth
  - Storage for media files (audio, images, video)
  - Real-time subscriptions where needed
- **Deployment**: Vercel with SSR (Server-Side Rendering)
- **Search**: Orama for client-side full-text search
- **Media Storage**: 
  - Google Cloud Storage (GCP) for media
- **Email**: AWS SES (Simple Email Service)
- **Internationalization**: Custom i18n system with JSON locale files
- **Package Manager**: pnpm (workspace monorepo)
- **Testing**:
  - Vitest for unit and integration tests
- **Build Tools**:
  - Vite (via SvelteKit)
  - TypeScript 5.1.6
  - ESLint with @antfu/eslint-config
  - svelte-check for type checking
- **Maps**: Mapbox GL JS for geographical visualizations
- **Rich Text**: CKEditor 5 for formatted text editing
- **Other Libraries**:
  - RecordRTC for audio/video recording
  - JSZip for file compression
  - D3 for data visualization (geo)
  - Turf.js for geospatial operations
  - Comlink for Web Workers
  - idb-keyval for IndexedDB storage

### Data Architecture

#### Database Schema (Supabase/PostgreSQL)
- **dictionaries_view** - Main dictionary metadata (name, public/private status, settings)
- **entries** - Dictionary entries with lexeme, phonetic, definitions, etc.
- **senses** - Individual sense data for entries (glosses, semantic domains)
- **users** - User profiles and authentication data
- **speakers** - Speaker profiles for audio recordings
- **content_updates** - Collaboration and suggestion system
- **api_keys** - External API access credentials
- **media_to_delete** - Cleanup tracking for orphaned media files

#### Entry Data Structure
Entries support rich multimedia content:
- Text fields: lexeme, phonetic, local orthography, notes
- Glosses in multiple languages (e.g., English, Spanish, French, etc.)
- Part of speech classification
- Semantic domains for categorization
- Example sentences with translations
- Audio recordings (multiple speakers)
- Photos with captions
- Video recordings
- Geographical coordinates (lat/lng) and regions
- Dialects/variants support for select dictionaries

#### Authentication & Authorization
- Supabase Auth with email/password and Google One-Tap
- Row Level Security (RLS) policies for data access
- User roles: admin, manager, contributor, viewer
- Cookie-based session management
- Access tokens: `sb-access-token`, `sb-refresh-token`

#### Media Storage Strategy
- Google Cloud Storage with serving URLs
- Media files organized by dictionary ID and type

#### Search Implementation
- Orama client-side search engine
- Indexed fields: lexeme, glosses, phonetic, semantic domains
- Cache stored in IndexedDB for offline access
- Real-time search updates as user types

### Key Features

#### Core Dictionary Features
- **Entry Management**: Create, read, update, delete dictionary entries in real-time
- **Multimedia Support**: 
  - Audio recording and playback with multiple speakers
  - Photo upload with automatic resizing
  - Video upload and playback
- **Search**: Full-text search across entries with Orama
- **Offline Access**: IndexedDB caching for offline dictionary access
- **Semantic Domains**: Categorize entries by semantic field
- **Glossing Languages**: Multiple target languages with on-screen keyboards
- **Import/Export**: 
  - CSV and JSON import
  - PDF and CSV export
  - FLEx (FieldWorks Language Explorer) format support
  - Standard Format support

#### Collaboration Features
- **Multi-user editing**: Real-time collaboration with role-based permissions
- **Contributor management**: Invite users with specific roles (manager, contributor, viewer)
- **Content suggestions**: Non-managers can suggest edits for review
- **Activity tracking**: Track contributions per user

#### Visibility & Access Control
- **Public/Private dictionaries**: Control who can view dictionary data
- **API access**: External API with key-based authentication
- **Embeddable widgets**: Share dictionary data on external sites

#### Language Learning Features
- **Flashcard view**: Study mode for language learners
- **Audio practice**: Listen to native speaker pronunciations
- **Example sentences**: Contextualized usage examples

#### Advanced Features
- **Geo-tagging**: Associate entries with specific locations
- **Dialect variants**: Track regional or dialectal variations
- **Peer review**: Collaborative spelling verification
- **Multiple orthographies**: Support different writing systems for same language
- **Custom keyboards**: IPA keyboard and Keyman integration for special characters
- **Batch operations**: Bulk editing and updates

#### Administrative Features
- **User management**: Admin dashboard for user oversight
- **Dictionary statistics**: Entry counts, contributor metrics
- **Content moderation**: Review and approve suggested changes
- **Data migration**: Tools for importing from legacy systems

## Coding Guidelines

### Code Style
- Use `snake_case` for variables, functions, and file names (not camelCase)
- Use Svelte 4 syntax (not Svelte 5 runes)
- Spell out variable names - avoid single letter variables except for short-lived loop indices (i, j, k)
- Use hard-coded constants from `lib/constants.ts` instead of arbitrary string values or magic numbers
- Add very few comments - only use them if code is doing something non-obvious
- Follow existing patterns in the codebase for consistency

### Styling
- Use UnoCSS with Tailwind CSS syntax for all styling
- Use Iconify icons with the `i-` prefix: `<span class="i-iconamoon-arrow-left-1"></span>`
- Available icon sets: all Iconify collections (search at iconify.design)
- Use `form-input` shortcut for consistent form styling
- Use `tw-prose` class for rich text content
- Prefer utility classes over custom CSS when possible
- Use scoped `<style>` blocks in Svelte components when custom styles are needed

### SQL & Database
- Use ALLCAPS for SQL keywords (SELECT, FROM, WHERE, etc.)
- Supabase tends to generate lowercase - fix this when you see it
- Always consider Row Level Security (RLS) when working with database queries
- Use typed Supabase client methods (from `@living-dictionaries/types`)
- Prefer server-side database operations in `+server.ts` files

### Internationalization (i18n)
- Place new English strings in `packages/site/src/lib/i18n/locales/en.json`
- Do NOT add translations for other languages - human translators handle these
- Access translations in Svelte components:
  ```svelte
  <script>
    import { page } from '$app/stores'
  </script>
  {$page.data.t.section.key}
  ```
- Organize translations by logical sections
- Use descriptive keys that indicate purpose

### TypeScript
- Use strict type checking
- Import types from `@living-dictionaries/types` package
- Prefer interfaces over type aliases for object shapes
- Use enums from `constants.ts` (e.g., `ResponseCodes`)
- Leverage Supabase generated types for database tables
- Avoid `any` - use `unknown` and type guards when needed

### File Structure & Imports
- Use SvelteKit's `$lib` alias for imports from `src/lib`
- Use `$api` alias for imports from `src/routes/api`
- Group imports: external libraries, then `$lib`, then relative
- Prefer named exports over default exports
- Keep files focused and single-purpose

### Component Guidelines
- Use `.svelte` extension for components
- Props should be clearly typed with TypeScript
- Use slot props for flexible component composition
- Prefer controlled components over uncontrolled when state is important

### Forms & Input
- Use UnoCSS forms preset styling
- Validate input on both client and server side
- Provide clear error messages
- Use appropriate input types (email, url, number, etc.)

### Error Handling
- Use try/catch for async operations
- Return appropriate HTTP status codes (use `ResponseCodes` enum)
- Log errors to Sentry in production
- Provide user-friendly error messages
- Handle edge cases explicitly

### Performance
- Lazy load heavy components and routes
- Use Web Workers (via Comlink) for expensive computations
- Implement virtual scrolling for long lists
- Optimize images and media
- Use IndexedDB for caching large datasets
- Minimize bundle size - check imports carefully

### Security
- Never commit secrets or API keys
- Validate all user input
- Sanitize HTML content with XSS library
- Use Supabase RLS for data access control
- Implement proper CORS policies
- Use Content Security Policy headers
- Verify user permissions before database operations

### Package Management
- When adding packages, consult documentation and leave links in PRs
- Use exact versions for critical dependencies
- Keep dependencies up to date with `pnpm check-packages`
- Prefer established, well-maintained packages
- Check bundle impact before adding new dependencies

## Development Workflow

### Development Commands (from root)
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm test` - Run all unit tests with Vitest
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm check` - Run svelte-check for type errors
- `pnpm generate-types` - Generate TypeScript types from Supabase schema

### Git Workflow
- Follow GitHub Flow methodology
- Branch naming: use kebab-case (e.g., `add-audio-feature`)
- Make atomic commits with descriptive messages
- Create pull requests for all changes
- Main branch automatically deploys to production on Vercel
- Use feature branches for all development work
- Keep branches up to date with main

### Local Database
- Supabase local instance for development
- Migrations in `/supabase/migrations`
- Seed data in `/supabase/seed.sql`
- Reset with `pnpm reset-db`
- Generate types after schema changes: `pnpm generate-types`

## Testing Guidelines

### Unit Tests (Vitest)
- Test files: `*.test.ts` or `*.spec.ts`
- Located next to source files or in `src/lib/helpers`
- Run with `pnpm test` from workspace root
- Run specific test: `pnpm test -- path/to/test.test.ts`
- Use `describe` and `test`/`it` blocks
- Mock external dependencies appropriately
- Test pure functions and business logic

### Testing Best Practices
- Write tests for bug fixes to prevent regression
- Test edge cases and error conditions
- Keep tests focused and independent
- Use descriptive test names
- Avoid testing implementation details
- Mock external services (APIs, databases) in unit tests
- Use integration tests for database operations
- Prefer E2E tests for critical user journeys

## Build & Deployment

### Build Process
1. `pnpm build` - Builds all workspace packages
2. SvelteKit builds to `.svelte-kit/output`
3. Vercel adapter optimizes for serverless deployment
4. Static assets processed and fingerprinted
5. Server endpoints bundled as serverless functions

## Project-Specific Notes

### API Endpoints
- `/api/db/*` - Database operations (authenticated)
- `/api/external/*` - Public API for external integrations
- `/api/upload` - Media upload handling
- `/api/email/*` - Email sending via AWS SES
- `/api/gcs_serving_url` - GCP serving URL generation

### Media Handling
- Audio: RecordRTC for browser recording, stored in Supabase/GCS
- Images: Auto-resized, multiple formats, serving URLs
- Video: Upload and playback, metadata tracking
- Lazy loading for performance

### Keyboard Implementations
- IPA keyboard for phonetic input
- Keyman integration for language-specific keyboards
- Special character picker for common diacritics
- On-screen keyboards for glossing languages

### Map Integration
- Mapbox GL JS for interactive maps
- Turf.js for geospatial calculations
- TopoJSON for efficient geographical data
- Coordinate entry and region selection

### Working with Supabase
- Use typed client from `lib/supabase`
- Respect RLS policies
- Use `admin.ts` for privileged operations
- Handle auth state in `hooks.server.ts`
- Cache frequently accessed data

### Scripts Package
Utility scripts for maintenance tasks:
- Data import from various formats
- Type generation and merging
- Database migrations
- Spreadsheet processing
- Locale file updates

### Known Limitations
- Don't run bash commands for dev, lint, etc. (use pnpm scripts)

## Common Patterns & Utilities

### Helper Functions (in `lib/helpers`)

### SvelteKit Patterns
- **Load functions** (`+page.ts`, `+layout.ts`): Fetch data before rendering
- **Server routes** (`+server.ts`): API endpoints and server logic
- **Server load** (`+page.server.ts`): Server-side data loading with auth
- **Form actions** (`+page.server.ts`): Handle form submissions
- **Hooks** (`hooks.server.ts`): Handle auth, set user context
- **Error boundaries** (`+error.svelte`): Custom error pages

### Database Query Patterns
- Use typed Supabase client from `lib/supabase`
- Always use `.select()` with specific columns (not `*`)
- Chain filters: `.eq()`, `.in()`, `.like()`, etc.
- Use `.single()` for single row queries
- Use `.maybeSingle()` when row might not exist
- Handle errors with try/catch
- Respect RLS - queries automatically filtered by user permissions

### Component Composition
- Use slots for flexible content injection
- Use slot props to pass data to slot content
- Export event handlers as props
- Use `$$restProps` for passing through HTML attributes
- Create reusable UI components in `lib/components/ui`

### Internationalization Pattern
1. Add English text to `locales/en.json`
2. Use descriptive section-based keys
3. Access via `$page.data.t.section.key`
4. Interpolate variables with helper function
5. Human translators add other languages later
