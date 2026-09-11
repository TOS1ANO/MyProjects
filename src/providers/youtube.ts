import type {
  ProviderAdapter,
  ProviderPlaybackState,
} from './types'

type YouTubePlayer = {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlaybackRate: () => number
  getPlayerState: () => number
  loadVideoById: (videoId: string) => void
  destroy: () => void
}

type YouTubeEvent = {
  target: YouTubePlayer
  data?: number
}

type YouTubeConstructor = new (
  element: HTMLElement | string,
  options: {
    videoId?: string
    playerVars?: Record<string, number | string>
    events?: {
      onReady?: (event: YouTubeEvent) => void
      onStateChange?: (event: YouTubeEvent) => void
      onPlaybackRateChange?: (event: YouTubeEvent) => void
    }
  },
) => YouTubePlayer

declare global {
  interface Window {
    YT?: {
      Player: YouTubeConstructor
      PlayerState: {
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

export function createYouTubeAdapter(
  container: HTMLElement,
): ProviderAdapter & {
  mount: (videoId: string) => Promise<void>
} {
  let player: YouTubePlayer | null = null
  let listeners: ((state: ProviderPlaybackState) => void)[] = []

  const emitState = () => {
    if (!player || !window.YT) return

    const playerState = player.getPlayerState()

    listeners.forEach((listener) =>
      listener({
        position: player.getCurrentTime(),
        isPlaying: playerState === window.YT.PlayerState.PLAYING,
        playbackRate: player.getPlaybackRate(),
        duration: player.getDuration(),
      }),
    )
  }

  const loadApi = () =>
    new Promise<void>((resolve, reject) => {
      if (window.YT?.Player) {
        resolve()
        return
      }

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      )

      const previousReady = window.onYouTubeIframeAPIReady

      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        resolve()
      }

      if (existingScript) return

      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('Could not load YouTube API.'))

      document.head.appendChild(script)
    })

  const mount = async (videoId: string) => {
    await loadApi()

    if (!window.YT?.Player) {
      throw new Error('YouTube Player API is unavailable.')
    }

    player?.destroy()

    player = new window.YT.Player(container, {
      videoId,
      playerVars: {
        playsinline: 1,
        controls: 1,
        rel: 0,
      },
      events: {
        onReady: () => emitState(),
        onStateChange: () => emitState(),
        onPlaybackRateChange: () => emitState(),
      },
    })
  }

  return {
    provider: 'youtube',

    isAvailable: () => Boolean(window.YT?.Player),

    getState: async () => {
      if (!player || !window.YT) {
        throw new Error('YouTube player is not ready.')
      }

      const playerState = player.getPlayerState()

      return {
        position: player.getCurrentTime(),
        isPlaying: playerState === window.YT.PlayerState.PLAYING,
        playbackRate: player.getPlaybackRate(),
        duration: player.getDuration(),
      }
    },

    play: async () => {
      if (!player) throw new Error('YouTube player is not ready.')
      player.playVideo()
    },

    pause: async () => {
      if (!player) throw new Error('YouTube player is not ready.')
      player.pauseVideo()
    },

    seek: async (position: number) => {
      if (!player) throw new Error('YouTube player is not ready.')
      player.seekTo(Math.max(0, position), true)
    },

    setPlaybackRate: async (rate: number) => {
      if (!player) throw new Error('YouTube player is not ready.')
      player.setPlaybackRate(rate)
    },

    subscribe: (onStateChange) => {
      listeners.push(onStateChange)

      return () => {
        listeners = listeners.filter(
          (listener) => listener !== onStateChange,
        )
      }
    },

    open: async (videoId: string) => {
      if (!player) {
        await mount(videoId)
        return
      }

      player.loadVideoById(videoId)
    },

    mount,
  }
}