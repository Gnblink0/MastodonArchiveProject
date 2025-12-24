# Mastodon Archive Viewer

A pure frontend Mastodon archive viewer with persistent local storage. Upload your archive once, and browse your posts forever - no backend server required.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.2-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)

## Features

- **Persistent Storage** - Upload once, data stays in browser IndexedDB forever
- **Complete Privacy** - All data stays on your device, nothing leaves your browser
- **Multi-Account Support** - Manage multiple Mastodon accounts in one place
- **Full-Text Search** - Search across all posts, tags, and content
- **Statistics Dashboard** - Visualize your posting activity and engagement
- **Import History** - Track all imports with replace/merge strategies
- **Google Drive Backup** - Optional cloud backup to your own Google Drive
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Mastodon-Style UI** - Familiar interface matching the Mastodon experience
- **Zero Cost** - Static hosting, no server fees, completely free to deploy

## 🚀 Live Demo

[View Demo](#) <!-- Add your deployment URL here -->

## Why This Exists

Existing Mastodon archive viewers have significant limitations:

- Require re-uploading archives every time
- Data disappears on page refresh
- Need backend servers and databases
- No multi-account support

**This project solves all of these:**

- Upload once, data persists indefinitely
- Survives page refreshes and browser restarts
- Pure frontend - no server needed
- Manage multiple accounts with ease
- Optional cloud backup via Google Drive

## Core Architecture

**Key Insight**: Mastodon archives are read-only JSON files. We don't need a traditional database!

**How it works:**

```
User uploads ZIP/tar.gz archive
         ↓
Browser decompresses and parses files
         ↓
Extract: actor.json, outbox.json, likes.json, bookmarks.json
         ↓
Parse media from media_attachments/
         ↓
Store everything in IndexedDB (browser database)
         ↓
Query and display via React components
         ↓
Data persists across sessions
```

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Storage**: IndexedDB via Dexie.js
- **Archive Parsing**: @zip.js/zip.js (ZIP), pako + js-untar (tar.gz)
- **Search**: Fuse.js for fuzzy search
- **UI Components**: Lucide React icons
- **Routing**: React Router v7
- **Charts**: Recharts for statistics visualization
- **Virtual Scrolling**: @tanstack/react-virtual for performance
- **OAuth**: @react-oauth/google for Drive integration
- **Deployment**: Vercel (or any static hosting)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mastodon-viewer.git
cd mastodon-viewer

# Navigate to the app directory
cd mastodon-viewer

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the app.

### Building for Production

```bash
npm run build
```

The build output will be in `mastodon-viewer/dist/`.

### Preview Production Build

```bash
npm run preview
```

## How to Use

### Step 1: Get Your Mastodon Archive

1. Log in to your Mastodon account
2. Go to **Settings** → **Import and Export** → **Request Archive**
3. Wait for the email notification (usually within minutes to hours)
4. Download the `.zip` or `.tar.gz` file

### Step 2: Upload to the Viewer

1. Open the Mastodon Archive Viewer
2. Drag and drop your archive file, or click to select it
3. Wait for parsing to complete (may take a few minutes for large archives)
4. Start browsing!

### Step 3: Explore Your Data

- **Home Timeline**: Browse all your posts chronologically
- **Search**: Find specific posts, tags, or content
- **Statistics**: View charts of your posting activity
- **Favourites**: See all posts you've liked
- **Bookmarks**: Access your bookmarked posts
- **Accounts**: Manage multiple imported accounts

### Multi-Account Management

- Import archives from different Mastodon accounts
- Switch between accounts using the filter dropdown
- Choose **Replace** to overwrite existing data or **Merge** to combine imports
- View import history for each account

### Google Drive Backup (Optional)

1. Click **Login with Google** in the sidebar
2. Grant access to Google Drive
3. Use the backup/restore features in the Accounts page
4. Your archive data syncs to your personal Google Drive

## Project Structure

```
mastodon-viewer/
├── src/
│   ├── components/          # React components
│   │   ├── Upload/         # File upload and import dialogs
│   │   ├── Timeline/       # Timeline and post cards
│   │   ├── Thread/         # Thread view for conversations
│   │   ├── Search/         # Search functionality
│   │   ├── Layout/         # App layout components
│   │   └── Accounts/       # Account management
│   ├── pages/              # Route pages
│   │   ├── AccountsPage.tsx
│   │   ├── StatsPage.tsx
│   │   ├── InteractionsPage.tsx
│   │   └── ProfilePage.tsx
│   ├── lib/
│   │   ├── db.ts           # Dexie database schema
│   │   └── parser.ts       # Archive parser (ZIP/tar.gz)
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts (account filter)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
├── package.json
└── vite.config.ts
```

## Key Features Explained

### IndexedDB Schema

The app uses 7 tables to organize your data:

- **accounts**: User profiles with avatars and stats
- **posts**: All posts with content, tags, mentions, visibility
- **media**: Media files stored as Blobs
- **likes**: Favorited posts
- **bookmarks**: Bookmarked posts
- **metadata**: Archive metadata per account
- **importHistory**: Track of all imports

### Archive Format Support

- **ZIP files** (`.zip`): Standard Mastodon export format
- **tar.gz files** (`.tar.gz`, `.tgz`): Compressed archives

Both formats are auto-detected and handled seamlessly.

### Import Strategies

When re-importing an existing account:

- **Replace**: Delete old data and import fresh (useful for updates)
- **Merge**: Combine new and existing data (keeps both)

### Search Capabilities

- Full-text search across post content
- Filter by tags
- Filter by media attachments
- Date range filtering
- Account-specific search


**Made with ❤️ for the Fediverse community**
