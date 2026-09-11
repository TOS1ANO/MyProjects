export type ProviderPlaybackState = {
  position: number
  isPlaying: boolean
  playbackRate: number
  duration: number
}

export type ProviderAdapter = {
  provider: string

  isAvailable: () => boolean

  getState: () => Promise<ProviderPlaybackState>

  play: () => Promise<void>

  pause: () => Promise<void>

  seek: (position: number) => Promise<void>

  setPlaybackRate: (rate: number) => Promise<void>

  subscribe: (
    onStateChange: (state: ProviderPlaybackState) => void,
  ) => () => void

  open: (videoId: string) => Promise<void>
}