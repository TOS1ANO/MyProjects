export type VideoProvider =
  | 'demo'
  | 'netflix'
  | 'prime_video'
  | 'max'
  | 'disney_plus'
  | 'hulu'
  | 'apple_tv'
  | 'youtube'
  | 'twitch'

export type ProviderStatus = 'available' | 'coming_soon' | 'unsupported'

export type ProviderDefinition = {
  id: VideoProvider
  name: string
  status: ProviderStatus
  description: string
  website: string
  requiresExtension: boolean
}

export const videoProviders: ProviderDefinition[] = [
  {
    id: 'demo',
    name: 'WatchSync Demo',
    status: 'available',
    description: 'Built-in demo video for testing WatchSync.',
    website: '',
    requiresExtension: false,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    status: 'coming_soon',
    description: 'Sync Netflix viewing with WatchSync.',
    website: 'https://www.netflix.com',
    requiresExtension: true,
  },
  {
    id: 'prime_video',
    name: 'Prime Video',
    status: 'coming_soon',
    description: 'Sync Prime Video viewing with WatchSync.',
    website: 'https://www.primevideo.com',
    requiresExtension: true,
  },
  {
    id: 'max',
    name: 'Max',
    status: 'coming_soon',
    description: 'Sync Max viewing with WatchSync.',
    website: 'https://www.max.com',
    requiresExtension: true,
  },
  {
    id: 'disney_plus',
    name: 'Disney+',
    status: 'coming_soon',
    description: 'Sync Disney+ viewing with WatchSync.',
    website: 'https://www.disneyplus.com',
    requiresExtension: true,
  },
  {
    id: 'hulu',
    name: 'Hulu',
    status: 'coming_soon',
    description: 'Sync Hulu viewing with WatchSync.',
    website: 'https://www.hulu.com',
    requiresExtension: true,
  },
  {
    id: 'apple_tv',
    name: 'Apple TV+',
    status: 'coming_soon',
    description: 'Sync Apple TV+ viewing with WatchSync.',
    website: 'https://tv.apple.com',
    requiresExtension: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    status: 'available',
    description: 'Sync supported YouTube videos with WatchSync.',
    website: 'https://www.youtube.com',
    requiresExtension: false,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    status: 'coming_soon',
    description: 'Sync Twitch streams with WatchSync.',
    website: 'https://www.twitch.tv',
    requiresExtension: true,
  },
]

export function getProvider(providerId: string) {
  return videoProviders.find((provider) => provider.id === providerId)
}

export function getProviderName(providerId: string) {
  return getProvider(providerId)?.name || providerId
}

export function getProviderStatusLabel(status: ProviderStatus) {
  if (status === 'available') return 'Available'
  if (status === 'coming_soon') return 'Coming soon'
  return 'Unsupported'
}

export function isProviderAvailable(providerId: string) {
  return getProvider(providerId)?.status === 'available'
}