# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A pure frontend Mastodon archive viewer that stores data in browser IndexedDB. Users upload their Mastodon archive (ZIP or tar.gz) once, and the data persists locally without any backend server. The app supports multiple accounts, archive history tracking, and Google Drive integration for backups.

**Key Insight**: Mastodon archives are read-only JSON files, so this eliminates the need for a traditional database and backend entirely.

## Common Commands

All commands should be run from the `mastodon-viewer/` directory:

```bash
# Development
cd mastodon-viewer
npm install
npm run dev          # Start dev server at http://localhost:5173

# Building
npm run build        # TypeScript compilation + Vite build → mastodon-viewer/dist/

# Linting
npm run lint         # ESLint check

# Preview production build
npm run preview
```

## Architecture

### Data Flow

```
User uploads archive (ZIP/tar.gz)
  ↓
Browser-side decompression (@zip.js/zip.js or pako + js-untar)
  ↓
Parse JSON files (actor.json, outbox.json, likes.json, bookmarks.json)
  ↓
Extract media files from media_attachments/
  ↓
Store everything in IndexedDB (Dexie.js)
  ↓
Query and display via React components
```

### IndexedDB Schema (Dexie)

**Location**: `src/lib/db.ts`

The database (`MastodonArchiveDB`) uses Dexie.js with these tables:

- **accounts**: User profiles with avatar/header Blobs, stats (multi-account support added in v4)
- **posts**: All posts with accountId, timestamp, tags, visibility, mentions, mediaIds
- **media**: Media files as Blobs with generated Object URLs
- **likes**: Favorited posts linked by activityId and targetUrl
- **bookmarks**: Bookmarked posts linked by activityId and targetUrl
- **metadata**: Archive upload metadata per account
- **importHistory**: Track each import with strategy (replace/merge) and stats

**Key Indexes**:
- `posts`: `[accountId+timestamp]`, `accountId`, `timestamp`, `*tags`, `inReplyTo`, `visibility`
- `media`: `accountId`, `[accountId+type]`
- `likes/bookmarks`: `accountId`, `[accountId+likedAt]`

**Multi-account Strategy**:
- Each account has a unique `id` (derived from ActivityPub actor.id)
- All data (posts, media, likes, bookmarks) includes an `accountId` field
- Users can import multiple archives, either replacing or merging data per account

### Archive Parser

**Location**: `src/lib/parser.ts`

The `ArchiveParser` class handles:

1. **Format Detection**: Auto-detects ZIP (.zip) vs tar.gz (.tar.gz, .tgz) and uses appropriate decompressor
2. **Unified Interface**: `ArchiveContainer` abstracts both formats for file access
3. **ActivityPub Parsing**: Converts ActivityPub JSON (actor.json, outbox.json, etc.) to internal types
4. **Media Extraction**: Processes `media_attachments/` folder, detects MIME types, creates Blobs
5. **Batch Processing**: Large archives are saved in batches to avoid memory issues (posts: 2000, media: 50, likes/bookmarks: 5000)
6. **Conflict Resolution**: When re-importing an existing account, users choose "replace" (delete old data) or "merge" (keep both)

**Key Methods**:
- `parseArchive(file)`: Main entry point, returns `ArchiveMetadata`
- `parseActor()`, `parsePosts()`, `parseMedia()`, `parseLikes()`, `parseBookmarks()`: Extract specific data
- `saveToDatabase()`: Handles import strategies and batch inserts

### State Management

**Global Account Filter**: `src/contexts/AccountFilterContext.tsx`
- Provides `selectedAccountId` to filter posts/stats by account across the app
- Persists selection to localStorage for continuity across sessions

**Custom Hooks**: `src/hooks/usePosts.ts`
- `useAccounts()`: Live query all accounts with cached Object URLs
- `useAccount(accountId)`: Get single account
- `usePosts(limit, offset, accountId?)`: Paginated posts, optionally filtered by account
- `usePostsCount(accountId?)`: Total post count
- `useMedia(mediaIds)`: Fetch media by IDs and regenerate Object URLs

All hooks use `useLiveQuery` from dexie-react-hooks for reactive IndexedDB queries.

### Component Structure

**Pages** (`src/pages/`):
- `AccountsPage`: List all imported accounts, upload new archives, show import history
- `AccountDetailPage`: Single account view with stats and timeline
- `InteractionsPage`: Unified view for likes/bookmarks
- `StatsPage`: Charts and statistics using recharts
- `ProfilePage`: User profile display

**Key Components** (`src/components/`):
- `Upload/UploadZone`: Drag-and-drop file upload with progress indicator
- `Upload/ImportStrategyDialog`: Dialog for choosing replace/merge on re-import
- `Timeline/Timeline`: Main timeline with infinite scroll and search
- `Timeline/PostCard`: Individual post rendering with media gallery
- `Thread/ThreadView`: Thread display with reply chains
- `Layout/MainLayout`: Three-column layout (left nav, center content, right sidebar)

### Routing

**Main Routes** (`src/App.tsx`):
- `/`: Home timeline with optional post detail sidebar
- `/post/:id`: Mobile thread view
- `/stats`: Statistics dashboard
- `/accounts`: Multi-account management
- `/account/:id/*`: Account-specific pages
- `/favourites`: Likes view
- `/bookmarks`: Bookmarks view
- `/profile`: Profile page

**Right Sidebar Behavior**:
- Desktop (≥1024px): Shows `ThreadView` when post clicked
- Mobile (<1024px): Navigates to `/post/:id` route
- Stats/Profile/Accounts pages: No right sidebar

### Object URL Management

**Critical Pattern**: Blobs stored in IndexedDB must be converted to Object URLs for display.

- Object URLs are generated on-demand in hooks (`usePosts`, `useMedia`, `useAccount`)
- **URL Cache**: `usePosts.ts` maintains a `Map<string, string>` to avoid creating duplicate URLs for the same Blob
- When Blobs change (re-import), the cache key uses `accountId-avatar` or `accountId-header` format
- Media URLs are recreated on each query because media items don't have stable keys

### Google Drive Integration

**OAuth Flow** (`src/App.tsx`):
- Uses `@react-oauth/google` with scope `https://www.googleapis.com/auth/drive.file`
- Token and user info stored in localStorage with expiry tracking
- On mount, checks if stored token is valid; auto-logout if expired
- Users can backup/restore archives to their own Google Drive (implementation in `AccountsPage`)

### Key Types

**Location**: `src/types/index.ts`

- `Account`: Multi-account user profile with stats and import dates
- `Post`: Supports both regular posts and boosts, includes visibility, mentions, tags
- `Media`: Blob storage with MIME type detection (image/video/audio/unknown)
- `Like`, `Bookmark`: Links to posts via `activityId` and `targetUrl`
- `ImportRecord`: Tracks each import event with strategy and file metadata
- `ActivityPub*`: Raw ActivityPub JSON structures for parsing

## Development Guidelines

### When Working with Archive Data

1. **Always test with both ZIP and tar.gz formats** - The parser supports both, ensure changes work for both
2. **Handle missing optional files gracefully** - likes.json and bookmarks.json may not exist in all archives
3. **Use indexed queries** - Posts and media tables have compound indexes (`[accountId+timestamp]`), use them for performance
4. **Batch large operations** - Follow existing batch sizes to avoid IndexedDB transaction limits

### When Modifying the Database Schema

1. **Create a new version** in `db.ts` with `.version(N).stores({...})`
2. **Write migration logic** in `.upgrade()` callback if needed
3. **Test with existing data** - Use the debug dashboard (`/debug`) to inspect data
4. **Update TypeScript types** in `src/types/index.ts` to match schema changes

### When Adding UI Features

1. **Respect the account filter context** - Most views should filter by `selectedAccountId` from `useAccountFilter()`
2. **Use responsive breakpoints** - Tailwind breakpoints: `md:`, `lg:` for 768px, 1024px
3. **Follow Mastodon's design patterns** - Color scheme uses CSS custom properties (mastodon-primary, mastodon-bg, mastodon-text-*)
4. **Optimize for mobile** - App uses `dvh` units and `pb-safe` for safe areas

### Performance Considerations

- **Virtual scrolling**: Timeline uses `@tanstack/react-virtual` for long lists
- **Pagination**: Default 20 posts per load, use offset-based pagination
- **Object URL cleanup**: Be cautious about creating too many Object URLs, use the cache pattern
- **Media loading**: Large media blobs should be lazy-loaded; use batch size limits when querying

## Deployment

The app is configured for Vercel (see `vercel.json` at project root):

```bash
# Deploy to Vercel
vercel --prod

# Or use Vercel's GitHub integration for auto-deploys
```

Build output is in `mastodon-viewer/dist/` and is a static SPA.

## Common Patterns

### Querying Posts with Account Filter

```typescript
const { selectedAccountId } = useAccountFilter()
const posts = usePosts(20, 0, selectedAccountId) // Filtered or all accounts
const totalCount = usePostsCount(selectedAccountId)
```

### Handling Import Conflicts

```typescript
const parser = new ArchiveParser(
  onProgress,
  async (conflict: AccountConflict) => {
    // Show dialog to user
    return 'replace' // or 'merge'
  }
)
```

### Creating Object URLs from Blobs

```typescript
// In hooks - use cache
const urlCache = new Map<string, string>()
const url = urlCache.get(key) || URL.createObjectURL(blob)
urlCache.set(key, url)

// In components - regenerate from Blob in DB
const media = useMedia(post.mediaIds)
// media items already have .url generated
```

### Multi-Account Data Deletion

```typescript
// Delete specific account
await db.clearAccount(accountId)

// Delete all data
await db.clearAll()
```

## Important Notes

- **Data Privacy**: All data stays in the browser's IndexedDB; nothing is uploaded to any server (except optional Google Drive backups)
- **Browser Storage Limits**: IndexedDB typically supports up to 1-2GB; large archives (>500MB) may need longer processing
- **Object URL Lifecycle**: Object URLs persist until page reload; Blobs are re-read from IndexedDB on mount
- **IndexedDB Version Migration**: Dexie handles schema upgrades automatically; existing data is preserved
- **ActivityPub ID Handling**: Post IDs are extracted from URLs and may have trailing slashes; parser normalizes them
