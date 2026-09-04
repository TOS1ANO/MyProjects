# WatchSync

**Watch together. Stay in sync.**

WatchSync is a social synchronization layer for video. See what your friends are watching and tune into the exact moment they are watching it.

## MVP status

### Built
- React + TypeScript + Vite foundation
- Dark, cinematic, responsive UI
- Home activity feed and Tune In flow
- Real HTML5 demo video player
- Host-authoritative playback state model
- Play / pause / seek synchronization
- Drift correction: gradual correction for small drift, hard seek for large drift
- Late-state positioning model using server/client timestamps
- Supabase Realtime Broadcast transport when configured
- Browser BroadcastChannel fallback for two-tab local testing
- Watch room with participants, invite code and live chat UI
- Initial Supabase schema with profiles, sessions, participants and playback state
- Initial Row Level Security policies

### Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and anon key:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Install and run:

```bash
npm install
npm run dev
```

When the two environment variables are present, the WatchSync room uses a Supabase Realtime Broadcast channel. Without them, the room intentionally falls back to `BroadcastChannel`, so you can test synchronization in two browser tabs immediately.

## Demo sync test

1. Open the app in two browser tabs.
2. Enter the WatchSync room in both tabs.
3. Press play in one tab.
4. Pause or seek in either tab.
5. The other tab receives the playback state and corrects its position.
6. Try leaving one tab paused, then joining/reloading it while the other tab is playing.

The current demo video is a public CC0 sample used only to validate the player and synchronization engine.

## Architecture

```text
WatchSync UI
    ↓
Watch Room
    ↓
Sync Controller
    ↓
Sync Transport
    ├── Supabase Realtime Broadcast
    └── Browser BroadcastChannel (local fallback)
    ↓
Video Source
    └── Demo HTML5 Video
```

The provider boundary is intentionally kept separate so legitimate future video-source adapters can be added without rewriting the synchronization engine.

## Next implementation milestones

1. Supabase authentication and profiles
2. Persisted session creation and joining
3. Presence and participant state through Supabase Realtime
4. Realtime chat and timestamped reactions
5. Invite links, session codes and QR sharing
6. Friends, activity feed, notifications and Discover
7. Provider adapters for legitimate supported integrations
8. Production hardening, testing and deployment

No streaming credentials, private keys, DRM bypasses, unsupported provider integrations, or redistributed copyrighted streams belong in the client repository.
