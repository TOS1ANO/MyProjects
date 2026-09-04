import { supabase } from './supabase'

export type PlaybackState = {
  position: number
  isPlaying: boolean
  playbackRate: number
  updatedAt: number
  source: string
}

type SyncMessage = {
  type: 'playback'
  state: PlaybackState
}

export type SyncTransport = {
  send: (state: PlaybackState) => Promise<void> | void
  subscribe: (onMessage: (state: PlaybackState) => void) => () => void
  close: () => Promise<void> | void
  mode: 'supabase' | 'browser'
}

export async function createSyncTransport(sessionId: string): Promise<SyncTransport> {
  if (supabase) {
    const channel = supabase.channel(`watchsync:${sessionId}`)

    await channel.subscribe()

    return {
      mode: 'supabase',
      send: async (state) => {
        await channel.send({
          type: 'broadcast',
          event: 'playback',
          payload: { type: 'playback', state } satisfies SyncMessage,
        })
      },
      subscribe: (onMessage) => {
        channel.on('broadcast', { event: 'playback' }, ({ payload }) => {
          const message = payload as SyncMessage
          if (message.type === 'playback') onMessage(message.state)
        })
        return () => undefined
      },
      close: async () => {
        await supabase.removeChannel(channel)
      },
    }
  }

  const channel = new BroadcastChannel(`watchsync:${sessionId}`)

  return {
    mode: 'browser',
    send: (state) => channel.postMessage({ type: 'playback', state } satisfies SyncMessage),
    subscribe: (onMessage) => {
      const handler = (event: MessageEvent<SyncMessage>) => {
        if (event.data?.type === 'playback') onMessage(event.data.state)
      }
      channel.addEventListener('message', handler)
      return () => channel.removeEventListener('message', handler)
    },
    close: () => channel.close(),
  }
}

export function getAuthoritativePosition(state: PlaybackState, now = Date.now()) {
  if (!state.isPlaying) return state.position
  const elapsed = Math.max(0, (now - state.updatedAt) / 1000)
  return state.position + elapsed * state.playbackRate
}

export function shouldHardSeek(driftSeconds: number) {
  return Math.abs(driftSeconds) >= 1.25
}
