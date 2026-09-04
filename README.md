# WatchSync

**Watch together. Stay in sync.**

WatchSync is a social synchronization layer for video. See what your friends are watching and tune into the exact moment they are watching it.

## MVP foundation

- React + TypeScript + Vite
- Dark, cinematic, responsive UI
- Home activity feed
- Live WatchSync cards
- Tune In interaction
- Create WatchSync modal
- Source/provider selection foundation
- Privacy selection foundation
- Desktop sidebar + mobile navigation
- Search filtering
- Demo-first architecture ready for realtime playback

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Next implementation milestones

1. Supabase authentication and profiles
2. Demo video provider + real video player
3. Realtime host-authoritative playback synchronization
4. Late-join synchronization and drift correction
5. Presence, chat, reactions and participant state
6. Invite links, session codes and QR sharing
7. Friends, activity feed, notifications and Discover
8. Provider adapters for legitimate supported integrations

No streaming credentials, private keys, DRM bypasses, or unsupported provider integrations belong in the client repository.
