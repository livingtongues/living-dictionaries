---
name: learn-about-app
description: Learn about the Living Dictionaries app architecture, data structures, and key features
---

## When to use me
When you want to quickly understand more about the Living Dictionaries app architecture, data structures, and key features.

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
