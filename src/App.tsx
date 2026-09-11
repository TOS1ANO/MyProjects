import { useEffect, useState } from 'react'
import Auth from './Auth'
import { supabase } from './supabase'
import {
  Bell,
  Compass,
  Home,
  MessageCircle,
  Play,
  Plus,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react'
import WatchRoom from './WatchRoom'

const getYouTubeVideoId = (value: string) => {
  const input = value.trim()
  if (!input) return ''

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input

  try {
    const url = new URL(input)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0]
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v')
      if (id) return id
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] || ''
    }
  } catch {
    return ''
  }

  return ''
}

const generateInviteCode = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let i = 0; i < 4; i++) {
    code += characters[Math.floor(Math.random() * characters.length)]
  }

  return `WS-${code}`
}

const formatPlaybackTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

type Activity = {
  id: string
  name: string
  title: string
  time: string
  image: string
  viewers: number
  avatar: string
  avatarUrl: string
  sessionId: string
  inviteCode: string
  isOwn: boolean
}

type DiscoverSession = {
  id: string
  hostId: string
  hostName: string
  hostUsername: string
  hostAvatar: string
  title: string
  image: string
  inviteCode: string
  isOwn: boolean
  viewerCount: number
}

type Friend = {
  id: string
  username: string
  displayName: string
  avatar: string
  bio: string
  isFollowing: boolean
  followers: number
  following: number
}

const fallbackImages = [
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
]

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Discover', icon: Compass },
  { label: 'WatchSync', icon: Video },
  { label: 'Friends', icon: Users },
]

function App() {
  const [session, setSession] = useState<{
    user: {
      id: string
      email?: string
    }
  } | null>(null)

  const [authLoading, setAuthLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const [activeNav, setActiveNav] = useState('Home')
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createSource, setCreateSource] = useState<'demo' | 'youtube'>('demo')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [createPrivacy, setCreatePrivacy] = useState<'public' | 'friends' | 'invite'>('friends')
  const [showJoin, setShowJoin] = useState(false)
  const [showRoom, setShowRoom] = useState(false)
  const [search, setSearch] = useState('')

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')

  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendsError, setFriendsError] = useState('')
  const [selectedProfileData, setSelectedProfileData] = useState<Friend | null>(null)
  const [selectedProfileActivity, setSelectedProfileActivity] = useState<Activity | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState('')

  const [discoverSessions, setDiscoverSessions] = useState<DiscoverSession[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')

  type Notification = {
    id: number
    type: 'follow' | 'watching'
    message: string
    isRead: boolean
    createdAt: string
    actorName: string
    actorUsername: string
    actorAvatar: string
  }

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')

  const visibleActivities = activities.filter((activity) =>
    `${activity.name} ${activity.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const visibleFriends = friends.filter((friend) =>
    `${friend.displayName} ${friend.username} ${friend.bio}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const visibleDiscoverSessions = discoverSessions.filter((watchSession) =>
    `${watchSession.hostName} ${watchSession.hostUsername} ${watchSession.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const loadActivities = async () => {
    if (!supabase || !session?.user.id) return

    setActivitiesLoading(true)
    setActivitiesError('')

    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)

    if (followingError) {
      console.error('Could not load activity follows:', followingError)
      setActivitiesError('Could not load activity right now.')
      setActivitiesLoading(false)
      return
    }

    const followingIds = (followingData || []).map(
      (follow) => follow.following_id,
    )

    const hostIds = [...new Set([session.user.id, ...followingIds])]

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select(
        'id, host_id, title, thumbnail_url, invite_code, status, created_at',
      )
      .eq('status', 'live')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Could not load live activity:', sessionsError)
      setActivitiesError('Could not load live activity right now.')
      setActivitiesLoading(false)
      return
    }

    if (!sessionsData?.length) {
      setActivities([])
      setActivitiesLoading(false)
      return
    }

    // Keep only the newest live session for each person.
    const latestSessionsByHost = new Map<
      string,
      (typeof sessionsData)[number]
    >()

    for (const watchSession of sessionsData) {
      if (!latestSessionsByHost.has(watchSession.host_id)) {
        latestSessionsByHost.set(watchSession.host_id, watchSession)
      }
    }

    const uniqueSessions = Array.from(latestSessionsByHost.values())

    const sessionIds = uniqueSessions.map((item) => item.id)

    const profileIds = [
      ...new Set(uniqueSessions.map((item) => item.host_id)),
    ]

    const [
      { data: profilesData, error: profilesError },
      { data: participantsData, error: participantsError },
      { data: playbackData, error: playbackError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', profileIds),

      supabase
        .from('participants')
        .select('session_id, is_active')
        .in('session_id', sessionIds)
        .eq('is_active', true),

      supabase
        .from('playback_state')
        .select(
          'session_id, position, is_playing, playback_rate, updated_at',
        )
        .in('session_id', sessionIds),
    ])

    if (profilesError) {
      console.error('Could not load activity profiles:', profilesError)
    }

    if (participantsError) {
      console.error(
        'Could not load activity participants:',
        participantsError,
      )
    }

    if (playbackError) {
      console.error('Could not load playback state:', playbackError)
    }

    const profiles = profilesData || []
    const participants = participantsData || []
    const playbackStates = playbackData || []

    const nextActivities: Activity[] = uniqueSessions.map(
      (watchSession, index) => {
        const profile = profiles.find(
          (item) => item.id === watchSession.host_id,
        )

        const playback = playbackStates.find(
          (item) => item.session_id === watchSession.id,
        )

        let position = playback?.position || 0

        if (playback?.is_playing && playback.updated_at) {
          const elapsed = Math.max(
            0,
            (Date.now() - new Date(playback.updated_at).getTime()) / 1000,
          )

          position += elapsed * (playback.playback_rate || 1)
        }

        const viewerCount = participants.filter(
          (participant) => participant.session_id === watchSession.id,
        ).length

        const displayName =
          profile?.display_name || profile?.username || 'Someone'

        const initials = displayName
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        return {
          id: watchSession.id,
          name: displayName,
          title: watchSession.title || 'WatchSync Session',
          time: formatPlaybackTime(position),
          image:
            watchSession.thumbnail_url ||
            fallbackImages[index % fallbackImages.length],
          viewers: viewerCount,
          avatar: initials,
          avatarUrl: profile?.avatar_url || '',
          sessionId: watchSession.id,
          inviteCode: watchSession.invite_code || '',
          isOwn: watchSession.host_id === session.user.id,
        }
      },
    )

    setActivities(nextActivities)
    setActivitiesLoading(false)
  }

  useEffect(() => {
    if (!session?.user.id) return
    void loadActivities()
  }, [session?.user.id])

  const formatNotificationTime = (value: string) => {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 1000),
    )

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return new Date(value).toLocaleDateString()
  }

  const loadNotifications = async () => {
    if (!supabase || !session?.user.id) return

    setNotificationsLoading(true)
    setNotificationsError('')

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, is_read, created_at, actor_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Could not load notifications:', error)
      setNotificationsError('Could not load notifications right now.')
      setNotificationsLoading(false)
      return
    }

    const actorIds = [
      ...new Set(
        (data || [])
          .map((notification) => notification.actor_id)
          .filter(Boolean),
      ),
    ]

    let profiles: {
      id: string
      display_name: string
      username: string
      avatar_url: string | null
    }[] = []

    if (actorIds.length) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', actorIds)

      if (profilesError) {
        console.error('Could not load notification profiles:', profilesError)
      } else {
        profiles = profilesData || []
      }
    }

    const nextNotifications: Notification[] = (data || []).map(
      (notification) => {
        const actor = profiles.find(
          (profile) => profile.id === notification.actor_id,
        )
        const actorName =
          actor?.display_name || actor?.username || 'Someone'
        const actorUsername = actor?.username || ''
        const actorAvatar =
          actor?.avatar_url ||
          actorName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

        return {
          id: notification.id,
          type: notification.type,
          message: notification.message,
          isRead: notification.is_read,
          createdAt: notification.created_at,
          actorName,
          actorUsername,
          actorAvatar,
        }
      },
    )

    setNotifications(nextNotifications)
    setNotificationsLoading(false)
  }

  const markNotificationRead = async (notificationId: number) => {
    if (!supabase || !session?.user.id) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Could not mark notification as read:', error)
      return
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    )
  }

  const markAllNotificationsRead = async () => {
    if (!supabase || !session?.user.id) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Could not mark notifications as read:', error)
      return
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        isRead: true,
      })),
    )
  }

  useEffect(() => {
    if (!session?.user.id) return
    void loadNotifications()
  }, [session?.user.id])

  useEffect(() => {
    if (
      activeNav !== 'Notifications' ||
      !session?.user.id
    ) return

    void loadNotifications()

    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [activeNav, session?.user.id])

  useEffect(() => {
    if (!supabase || !session?.user.id) return

    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          void loadNotifications()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user.id])

  const loadDiscover = async () => {
    if (!supabase || !session?.user.id) return

    setDiscoverLoading(true)
    setDiscoverError('')

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, host_id, title, thumbnail_url, invite_code, status, created_at')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(30)

    if (sessionsError) {
      console.error('Could not load Discover sessions:', sessionsError)
      setDiscoverError('Could not load live sessions right now.')
      setDiscoverLoading(false)
      return
    }

    if (!sessionsData?.length) {
      setDiscoverSessions([])
      setDiscoverLoading(false)
      return
    }

    const hostIds = [...new Set(sessionsData.map((watchSession) => watchSession.host_id))]

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', hostIds)

    if (profilesError) {
      console.error('Could not load Discover profiles:', profilesError)
    }

    const profiles = profilesData || []
    const latestSessionsByHost = new Map<string, (typeof sessionsData)[number]>()

    for (const watchSession of sessionsData) {
      if (!latestSessionsByHost.has(watchSession.host_id)) {
        latestSessionsByHost.set(watchSession.host_id, watchSession)
      }
    }

    const uniqueSessions = Array.from(latestSessionsByHost.values())
    const sessionIds = uniqueSessions.map((watchSession) => watchSession.id)
    const { data: viewerCountsData, error: viewerCountsError } = await supabase.rpc('get_live_session_viewer_counts', { session_ids: sessionIds })

    if (viewerCountsError) {
      console.error('Could not load Discover viewer counts:', viewerCountsError)
    }

    const viewerCounts = new Map(
      (viewerCountsData || []).map((item) => [item.session_id, Number(item.viewer_count) || 0]),
    )

    const nextDiscoverSessions: DiscoverSession[] = uniqueSessions.map((watchSession, index) => {
      const profile = profiles.find((item) => item.id === watchSession.host_id)
      const hostName = profile?.display_name || profile?.username || 'Someone'
      const hostUsername = profile?.username || ''
      const initials = hostName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

      return {
        id: watchSession.id,
        hostId: watchSession.host_id,
        hostName,
        hostUsername,
        hostAvatar: profile?.avatar_url || initials,
        title: watchSession.title || 'WatchSync Session',
        image: watchSession.thumbnail_url || fallbackImages[index % fallbackImages.length],
        inviteCode: watchSession.invite_code || '',
        isOwn: watchSession.host_id === session.user.id,
        viewerCount: viewerCounts.get(watchSession.id) || 0,
      }
    })

    setDiscoverSessions(nextDiscoverSessions)
    setDiscoverLoading(false)
  }

  useEffect(() => {
    if (activeNav !== 'Discover' || !session?.user.id) return
    void loadDiscover()

    const interval = window.setInterval(() => {
      void loadDiscover()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [activeNav, session?.user.id])

  useEffect(() => {
    if (!session?.user.id) return

    const interval = window.setInterval(() => {
      void loadActivities()
    }, 15000)

    return () => {
      window.clearInterval(interval)
    }
  }, [session?.user.id])

  const loadFriends = async () => {
    if (!supabase || !session?.user.id) return

    setFriendsLoading(true)
    setFriendsError('')

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .neq('id', session.user.id)
      .order('display_name', { ascending: true })

    if (profileError) {
      console.error('Could not load people:', profileError)
      setFriendsError('Could not load people right now.')
      setFriendsLoading(false)
      return
    }

    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id)

    if (followingError) {
      console.error('Could not load follows:', followingError)
      setFriendsError('Could not load your follows right now.')
      setFriendsLoading(false)
      return
    }

    const profileIds = (profiles || []).map((profile) => profile.id)

    const followingIds = new Set(
      (followingData || []).map((follow) => follow.following_id),
    )

    let followerCounts: { following_id: string }[] = []
    let followingCounts: { follower_id: string }[] = []

    if (profileIds.length) {
      const { data: followers } = await supabase
        .from('follows')
        .select('following_id')
        .in('following_id', profileIds)

      const { data: following } = await supabase
        .from('follows')
        .select('follower_id')
        .in('follower_id', profileIds)

      followerCounts = followers || []
      followingCounts = following || []
    }

    const nextFriends: Friend[] = (profiles || []).map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatar: profile.avatar_url || '',
      bio: profile.bio || '',
      isFollowing: followingIds.has(profile.id),
      followers: followerCounts.filter(
        (item) => item.following_id === profile.id,
      ).length,
      following: followingCounts.filter(
        (item) => item.follower_id === profile.id,
      ).length,
    }))

    setFriends(nextFriends)
    setFriendsLoading(false)
  }

  useEffect(() => {
    if (activeNav !== 'Friends' || !session?.user.id) return
    void loadFriends()
  }, [activeNav, session?.user.id])

  const toggleFollow = async (
  friendId: string,
  currentlyFollowing: boolean,
) => {
  if (!supabase || !session?.user.id) return

  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', friendId)

    if (error) {
      console.error('Could not unfollow user:', error)
      return
    }

    setFriends((current) =>
      current.map((friend) =>
        friend.id === friendId
          ? {
              ...friend,
              isFollowing: false,
              followers: Math.max(0, friend.followers - 1),
            }
          : friend,
      ),
    )

    void loadActivities()
    return
  }

  const { error } = await supabase.from('follows').insert({
    follower_id: session.user.id,
    following_id: friendId,
  })

  if (error) {
    console.error('Could not follow user:', error)
    return
  }

  await supabase.from('notifications').insert({
    user_id: friendId,
    actor_id: session.user.id,
    type: 'follow',
    message: 'started following you',
  })

  setFriends((current) =>
    current.map((friend) =>
      friend.id === friendId
        ? {
            ...friend,
            isFollowing: true,
            followers: friend.followers + 1,
          }
        : friend,
    ),
  )

  void loadActivities()
}

  const loadProfile = async (profileId: string) => {
    if (!supabase || !session?.user.id) return

    setProfileLoading(true)
    setProfileError('')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('id', profileId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('Could not load profile:', profileError)
      setProfileError('Could not load this profile right now.')
      setSelectedProfileData(null)
      setSelectedProfileActivity(null)
      setProfileLoading(false)
      return
    }

    const [{ data: followingData }, { data: followerData }, { data: followingCountData }, { data: liveSessionData }] = await Promise.all([
      supabase.from('follows').select('id').eq('follower_id', session.user.id).eq('following_id', profileId),
      supabase.from('follows').select('id').eq('following_id', profileId),
      supabase.from('follows').select('id').eq('follower_id', profileId),
      supabase.from('sessions').select('id, title, thumbnail_url, invite_code').eq('host_id', profileId).eq('status', 'live').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const nextProfile: Friend = {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatar: profile.avatar_url || '',
      bio: profile.bio || '',
      isFollowing: Boolean(followingData?.length),
      followers: followerData?.length || 0,
      following: followingCountData?.length || 0,
    }

    setSelectedProfileData(nextProfile)
    setSelectedProfileActivity(null)

    if (liveSessionData) {
      const { data: playbackData } = await supabase
        .from('playback_state')
        .select('position, is_playing, playback_rate, updated_at')
        .eq('session_id', liveSessionData.id)
        .maybeSingle()

      const { data: viewerCountData } = await supabase.rpc('get_live_session_viewer_counts', { session_ids: [liveSessionData.id] })
      const viewerCount = Number(viewerCountData?.[0]?.viewer_count) || 0
      const position = Number(playbackData?.position) || 0
      const updatedAt = playbackData?.updated_at ? new Date(playbackData.updated_at).getTime() : Date.now()
      const currentPosition = playbackData?.is_playing
        ? position + Math.max(0, (Date.now() - updatedAt) / 1000) * (Number(playbackData.playback_rate) || 1)
        : position
      const initials = nextProfile.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

      setSelectedProfileActivity({
        id: liveSessionData.id,
        name: nextProfile.displayName,
        title: liveSessionData.title || 'WatchSync Session',
        time: formatPlaybackTime(currentPosition),
        image: liveSessionData.thumbnail_url || fallbackImages[0],
        viewers: viewerCount,
        avatar: initials,
        avatarUrl: nextProfile.avatar,
        sessionId: liveSessionData.id,
        inviteCode: liveSessionData.invite_code || '',
        isOwn: profileId === session.user.id,
      })
    }

    setProfileLoading(false)
  }

  const openProfile = (profileId: string) => {
    setActiveNav('Profile')
    setSearch('')
    void loadProfile(profileId)
  }

  const tuneIntoActivity = async (activity: Activity) => {
    if (!supabase || !session?.user.id) return

    const { error } = await supabase.from('participants').upsert(
      {
        session_id: activity.sessionId,
        user_id: session.user.id,
        is_active: true,
        left_at: null,
      },
      { onConflict: 'session_id,user_id' },
    )

    if (error) {
      console.error('Could not join activity:', error)
      setJoinError('Could not join this WatchSync session.')
      setShowJoin(true)
      return
    }

    setSessionId(activity.sessionId)
    setInviteCode(activity.inviteCode || null)
    setShowRoom(true)
  }

  const handleJoinSession = async () => {
    if (!supabase || !session?.user.id) return

    const cleanedCode = joinCode.trim().toUpperCase()

    if (!cleanedCode) {
      setJoinError('Enter an invite code.')
      return
    }

    setJoinError('')

    const { data, error } = await supabase
      .from('sessions')
      .select('id, invite_code')
      .eq('invite_code', cleanedCode)
      .eq('status', 'live')
      .maybeSingle()

    if (error) {
      console.error('Could not find session:', error)
      setJoinError('Could not find that session.')
      return
    }

    if (!data) {
      setJoinError('Invalid or expired invite code.')
      return
    }

    const { error: participantError } = await supabase
      .from('participants')
      .upsert(
        {
          session_id: data.id,
          user_id: session.user.id,
          is_active: true,
          left_at: null,
        },
        { onConflict: 'session_id,user_id' },
      )

    if (participantError) {
      console.error('Could not join session:', participantError)
      setJoinError('Could not join this WatchSync session.')
      return
    }

    setSessionId(data.id)
    setInviteCode(data.invite_code)
    setJoinCode('')
    setShowJoin(false)
    setShowRoom(true)
  }

  if (authLoading) {
    return (
      <div className="auth-loading">
        <span className="brand-mark">
          <Play size={16} fill="currentColor" />
        </span>
        <span>Loading WatchSync...</span>
      </div>
    )
  }

  if (!session || showAuth) {
    return <Auth onBack={() => setShowAuth(false)} />
  }

  if (showRoom) {
    return (
      <WatchRoom
        sessionId={sessionId}
        inviteCode={inviteCode}
        onLeave={() => {
          setShowRoom(false)
          void loadActivities()
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Play size={16} fill="currentColor" />
          </span>
          <span>WatchSync</span>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${activeNav === label ? 'active' : ''}`}
              key={label}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setActiveNav('Notifications')}
          >
            <Bell size={19} />
            <span>Notifications</span>
            {notifications.some((notification) => !notification.isRead) && (
              <span className="notification-dot" />
            )}
          </button>

          <div className="profile-area">
            <button
              className="profile-mini"
              onClick={() => openProfile(session.user.id)}
            >
              <span className="avatar avatar-self">TO</span>

              <span className="profile-copy">
                <strong>
                  {session.user.email?.split('@')[0] || 'You'}
                </strong>
                <small>View profile</small>
              </span>
            </button>

            <button
              className="logout-button"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut()
                }
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Play size={14} fill="currentColor" />
            </span>
            WatchSync
          </div>

          <label className="search-box">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeNav === 'Friends'
                  ? 'Search people...'
                  : 'Search people, movies, shows...'
              }
            />
          </label>

          <button
            className="top-create"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={18} />
            <span>New WatchSync</span>
          </button>
        </header>

        {activeNav === 'Notifications' ? (
          <section className="friends-page">
            <div className="section-heading">
              <div>
                <span className="section-kicker">ACTIVITY</span>
                <h2>Notifications</h2>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="text-button"
                  onClick={() => void loadNotifications()}
                >
                  Refresh <span>↻</span>
                </button>

                {notifications.some((notification) => !notification.isRead) && (
                  <button
                    className="text-button"
                    onClick={() => void markAllNotificationsRead()}
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {notificationsLoading ? (
              <div className="friends-loading">
                <span>Loading notifications...</span>
              </div>
            ) : notificationsError ? (
              <div className="join-error">{notificationsError}</div>
            ) : notifications.length ? (
              <div className="activity-grid">
                {notifications.map((notification) => (
                  <article
                    className="friends-card"
                    key={notification.id}
                    style={{
                      opacity: notification.isRead ? 0.72 : 1,
                      borderColor: notification.isRead
                        ? undefined
                        : 'rgba(255,255,255,0.16)',
                    }}
                  >
                    <div className="activity-info">
                      <span className="avatar">
                        {notification.actorAvatar.startsWith('http') ? (
                          <img
                            src={notification.actorAvatar}
                            alt={notification.actorName}
                          />
                        ) : (
                          notification.actorAvatar
                        )}
                      </span>

                      <div className="activity-copy">
                        <strong>{notification.actorName}</strong>
                        <span>
                          {notification.message}
                        </span>
                        {notification.actorUsername && (
                          <small>@{notification.actorUsername}</small>
                        )}
                        <small>
                          {formatNotificationTime(notification.createdAt)}
                        </small>
                      </div>

                      {!notification.isRead && (
                        <button
                          className="ghost-button"
                          onClick={() =>
                            void markNotificationRead(notification.id)
                          }
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="friends-empty">
                <span className="section-kicker">ALL QUIET</span>
                <h2>No notifications yet.</h2>
                <p>
                  When someone follows you or other social activity happens,
                  you’ll see it here.
                </p>
              </div>
            )}
          </section>
        ) : activeNav === 'Profile' && selectedProfileData ? (
          <section className="friends-page">
            <div className="section-heading">
              <div>
                <span className="section-kicker">PROFILE</span>
                <h2>{selectedProfileData.displayName}</h2>
              </div>
              <button className="text-button" onClick={() => { setSelectedProfileData(null); setSelectedProfileActivity(null); setActiveNav('Friends') }}>← Back to friends</button>
            </div>

            {profileLoading ? (
              <div className="friends-loading"><span>Loading profile...</span></div>
            ) : profileError ? (
              <div className="join-error">{profileError}</div>
            ) : (
              <>
                <article className="friends-card">
                  <div className="activity-info">
                    <span className="avatar">
                      {selectedProfileData.avatar ? <img src={selectedProfileData.avatar} alt={selectedProfileData.displayName} /> : selectedProfileData.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="activity-copy">
                      <strong>{selectedProfileData.displayName}</strong>
                      <span>@{selectedProfileData.username}</span>
                      {selectedProfileData.bio && <span>{selectedProfileData.bio}</span>}
                      <small>{selectedProfileData.followers} followers · {selectedProfileData.following} following</small>
                    </div>
                    {selectedProfileData.id !== session.user.id && (
                      <button className={selectedProfileData.isFollowing ? 'ghost-button' : 'tune-button'} onClick={() => void toggleFollow(selectedProfileData.id, selectedProfileData.isFollowing)}>
                        {selectedProfileData.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </article>

                <div className="section-heading" style={{ marginTop: 34 }}>
                  <div><span className="section-kicker">LIVE NOW</span><h2>{selectedProfileData.id === session.user.id ? 'Your current session' : 'Currently watching'}</h2></div>
                </div>

                {selectedProfileActivity ? (
                  <article className="activity-card">
                    <div className="poster-wrap">
                      <img src={selectedProfileActivity.image} alt={selectedProfileActivity.title} />
                      <div className="poster-gradient" />
                      <div className="live-label"><span className="live-dot" /> LIVE NOW</div>
                      <div className="poster-bottom"><span>{selectedProfileActivity.time}</span><span>{selectedProfileActivity.viewers} {selectedProfileActivity.viewers === 1 ? 'person' : 'people'} watching</span></div>
                    </div>
                    <div className="activity-info">
                      <span className="avatar">{selectedProfileActivity.avatarUrl ? <img src={selectedProfileActivity.avatarUrl} alt={selectedProfileActivity.name} /> : selectedProfileActivity.avatar}</span>
                      <div className="activity-copy">
                        <strong>{selectedProfileActivity.title}</strong>
                        <span>{selectedProfileActivity.name} is watching</span>
                      </div>
                      {selectedProfileActivity.isOwn ? (
                        <button className="ghost-button" onClick={() => { setSessionId(selectedProfileActivity.sessionId); setInviteCode(selectedProfileActivity.inviteCode || null); setShowRoom(true) }}>Open</button>
                      ) : (
                        <button className="tune-button" onClick={() => void tuneIntoActivity(selectedProfileActivity)}>Tune In</button>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="friends-empty">
                    <span className="section-kicker">NOT WATCHING</span>
                    <h2>No live session right now.</h2>
                    <p>When this person starts watching, their live session will appear here.</p>
                  </div>
                )}
              </>
            )}
          </section>
        ) : activeNav === 'Discover' ? (
          <section className="discover-page">
            <div className="discover-hero">
              <div>
                <span className="section-kicker">DISCOVER</span>
                <h1>Find people to watch with.</h1>
                <p>Explore live WatchSync sessions and jump into the action.</p>
              </div>
              <button className="ghost-button" onClick={() => void loadDiscover()}>Refresh <span>↻</span></button>
            </div>

            {discoverLoading ? (
              <div className="friends-loading"><span>Finding live sessions...</span></div>
            ) : discoverError ? (
              <div className="join-error">{discoverError}</div>
            ) : visibleDiscoverSessions.length ? (
              <div className="activity-grid discover-grid">
                {visibleDiscoverSessions.map((watchSession) => (
                  <article className="activity-card discover-card" key={watchSession.id}>
                    <div className="poster-wrap">
                      <img src={watchSession.image} alt={watchSession.title} />
                      <div className="poster-gradient" />
                      <div className="live-label"><span className="live-dot" /> LIVE NOW</div>
                      <div className="poster-bottom"><span>WatchSync</span><span>{watchSession.viewerCount} {watchSession.viewerCount === 1 ? 'person' : 'people'} watching</span></div>
                    </div>
                    <div className="activity-info">
                      <span className="avatar">
                        {watchSession.hostAvatar.startsWith('http') ? <img src={watchSession.hostAvatar} alt={watchSession.hostName} /> : watchSession.hostAvatar}
                      </span>
                      <div className="activity-copy">
                        <strong>{watchSession.isOwn ? 'You' : watchSession.hostName}</strong>
                        <span>{watchSession.isOwn ? 'are watching' : 'is watching'} <b>{watchSession.title}</b></span>
                        {watchSession.hostUsername && <small>@{watchSession.hostUsername}</small>}
                      </div>
                      {watchSession.isOwn ? (
                        <button className="ghost-button" onClick={() => { setSessionId(watchSession.id); setInviteCode(watchSession.inviteCode || null); setShowRoom(true) }}>Open</button>
                      ) : (
                        <button className="tune-button" onClick={() => void tuneIntoActivity({ id: watchSession.id, name: watchSession.hostName, title: watchSession.title, time: '0:00', image: watchSession.image, viewers: watchSession.viewerCount, avatar: '', avatarUrl: '', sessionId: watchSession.id, inviteCode: watchSession.inviteCode, isOwn: false })}>Tune In</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="friends-empty">
                <span className="section-kicker">QUIET RIGHT NOW</span>
                <h2>No live sessions yet.</h2>
                <p>Start a WatchSync session and it will appear here for the community.</p>
                <button className="primary-button" onClick={() => setShowCreate(true)}><Play size={16} fill="currentColor" /> Start Watching</button>
              </div>
            )}
          </section>
        ) : activeNav === 'Friends' ? (
          <section className="friends-page">
            <div className="section-heading">
              <div>
                <span className="section-kicker">YOUR PEOPLE</span>
                <h2>Find friends</h2>
              </div>

              <button
                className="text-button"
                onClick={() => void loadFriends()}
              >
                Refresh <span>↻</span>
              </button>
            </div>

            {friendsLoading ? (
              <div className="friends-loading">
                <span>Loading people...</span>
              </div>
            ) : friendsError ? (
              <div className="join-error">{friendsError}</div>
            ) : visibleFriends.length ? (
              <div className="activity-grid">
                {visibleFriends.map((friend) => (
                  <article
                    className="friends-card"
                    key={friend.id}
                    onClick={() => openProfile(friend.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openProfile(friend.id) }}
                  >
                    <div className="activity-info">
                      <span className="avatar">
                        {friend.avatar ? (
                          <img
                            src={friend.avatar}
                            alt={friend.displayName}
                          />
                        ) : (
                          friend.displayName
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        )}
                      </span>

                      <div className="activity-copy">
                        <strong>{friend.displayName}</strong>
                        <span>@{friend.username}</span>

                        {friend.bio && (
                          <span>{friend.bio}</span>
                        )}

                        <small>
                          {friend.followers} followers ·{' '}
                          {friend.following} following
                        </small>
                      </div>

                      <button
                        className={
                          friend.isFollowing
                            ? 'ghost-button'
                            : 'tune-button'
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          void toggleFollow(friend.id, friend.isFollowing)
                        }}
                      >
                        {friend.isFollowing
                          ? 'Following'
                          : 'Follow'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="friends-empty">
                <span className="section-kicker">
                  NO PEOPLE FOUND
                </span>
                <h2>Try another search.</h2>
                <p>
                  Once more people create WatchSync profiles,
                  they’ll appear here.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="live-dot" /> LIVE WITH YOUR PEOPLE
                </span>

                <h1>
                  Watch together.
                  <br />
                  <span>Stay in sync.</span>
                </h1>

                <p>
                  See what your friends are watching and tune into
                  the exact moment they’re watching it.
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => setShowCreate(true)}
                  >
                    <Play size={17} fill="currentColor" /> Start
                    Watching
                  </button>

                  <button
                    className="ghost-button"
                    onClick={() => setActiveNav('Discover')}
                  >
                    <Compass size={17} /> Explore Live
                  </button>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-glow" />

                <div className="hero-screen">
                  <img
                    src={
                      activities[0]?.image ||
                      fallbackImages[0]
                    }
                    alt="Cinematic scene"
                  />

                  <div className="screen-overlay" />

                  <div className="sync-pill">
                    <span className="live-dot" /> LIVE
                  </div>

                  <div className="screen-info">
                    <div className="screen-time">
                      {activities[0]?.time || '0:00'}
                    </div>

                    <div className="screen-title">
                      {activities[0]?.title ||
                        'Watch together'}
                    </div>

                    <div className="screen-user">
                      <span className="avatar avatar-sm">
                        {activities[0]?.avatar || 'WS'}
                      </span>

                      {activities[0]
                        ? activities[0].isOwn
                          ? 'You are watching'
                          : `${activities[0].name} is watching`
                        : 'Your people are watching'}
                    </div>
                  </div>

                  <div className="screen-controls">
                    <span />
                    <span />
                    <span />
                    <b />
                  </div>
                </div>
              </div>
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">
                    RIGHT NOW
                  </span>
                  <h2>Friends are watching</h2>
                </div>

                <button
                  className="text-button"
                  onClick={() => void loadActivities()}
                >
                  Refresh <span>↻</span>
                </button>
              </div>

              {activitiesLoading ? (
                <div className="friends-loading">
                  <span>Loading live activity...</span>
                </div>
              ) : activitiesError ? (
                <div className="join-error">
                  {activitiesError}
                </div>
              ) : visibleActivities.length ? (
                <div className="activity-grid">
                  {visibleActivities.map((activity) => (
                    <article
                      className="activity-card"
                      key={activity.id}
                    >
                      <div className="poster-wrap">
                        <img
                          src={activity.image}
                          alt={activity.title}
                        />

                        <div className="poster-gradient" />

                        <div className="live-label">
                          <span className="live-dot" /> LIVE
                        </div>

                        <div className="poster-bottom">
                          <span>{activity.time}</span>
                          <span>
                            {activity.viewers} watching
                          </span>
                        </div>
                      </div>

                      <div className="activity-info">
                        <span className="avatar">
                          {activity.avatarUrl ? (
                            <img
                              src={activity.avatarUrl}
                              alt={activity.name}
                            />
                          ) : (
                            activity.avatar
                          )}
                        </span>

                        <div className="activity-copy">
                          <strong>
                            {activity.isOwn
                              ? 'You'
                              : activity.name}
                          </strong>

                          <span>
                            {activity.isOwn
                              ? 'are watching'
                              : 'is watching'}{' '}
                            <b>{activity.title}</b>
                          </span>
                        </div>

                        {activity.isOwn ? (
                          <button
                            className="ghost-button"
                            onClick={() => {
                              setSessionId(
                                activity.sessionId,
                              )
                              setInviteCode(
                                activity.inviteCode ||
                                  null,
                              )
                              setShowRoom(true)
                            }}
                          >
                            Open
                          </button>
                        ) : (
                          <button
                            className="tune-button"
                            onClick={() =>
                              void tuneIntoActivity(
                                activity,
                              )
                            }
                          >
                            Tune In
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="friends-empty">
                  <span className="section-kicker">
                    QUIET RIGHT NOW
                  </span>

                  <h2>No one is watching yet.</h2>

                  <p>
                    Follow people and their live WatchSync
                    sessions will appear here.
                  </p>
                </div>
              )}
            </section>

            <section className="how-section">
              <div>
                <span className="section-kicker">
                  HOW IT WORKS
                </span>

                <h2>One tap. You’re there.</h2>
              </div>

              <div className="steps">
                <div className="step">
                  <span>01</span>

                  <div>
                    <strong>Find your people</strong>
                    <p>
                      See friends who are watching something
                      right now.
                    </p>
                  </div>
                </div>

                <div className="step">
                  <span>02</span>

                  <div>
                    <strong>Tap Tune In</strong>
                    <p>
                      Jump straight to the moment they’re
                      watching.
                    </p>
                  </div>
                </div>

                <div className="step">
                  <span>03</span>

                  <div>
                    <strong>Watch together</strong>
                    <p>
                      Stay synced with chat, reactions and
                      presence.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <footer>
              <span>WatchSync</span>
              <span>Watch together. Stay in sync.</span>
            </footer>
          </>
        )}

        {showCreate && (
          <div
            className="modal-backdrop"
            onMouseDown={() => setShowCreate(false)}
          >
            <div
              className="create-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <span className="section-kicker">
                    NEW SESSION
                  </span>
                  <h2>Create a WatchSync</h2>
                </div>

                <button
                  className="close-button"
                  onClick={() => setShowCreate(false)}
                >
                  <X size={19} />
                </button>
              </div>

              <label>
                What are you watching?
                <input
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder="Movie, show or video title"
                />
              </label>

              <div className="source-grid">
                <button
                  className={createSource === 'demo' ? 'active' : ''}
                  onClick={() => setCreateSource('demo')}
                >
                  <Video size={20} />
                  <strong>Demo Videos</strong>
                  <small>Ready for the MVP</small>
                </button>

                <button
                  className={createSource === 'youtube' ? 'active' : ''}
                  onClick={() => setCreateSource('youtube')}
                >
                  <Play size={20} />
                  <strong>YouTube</strong>
                  <small>Available now</small>
                </button>

                <button disabled>
                  <Plus size={20} />
                  <strong>Upload / Owned</strong>
                  <small>Coming next</small>
                </button>
              </div>

              {createSource === 'youtube' && (
                <label>
                  YouTube video
                  <input
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <small>Paste a YouTube URL or 11-character video ID.</small>
                </label>
              )}

              <label>
                Privacy
                <select
                  value={createPrivacy}
                  onChange={(event) =>
                    setCreatePrivacy(event.target.value as 'public' | 'friends' | 'invite')
                  }
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends only</option>
                  <option value="invite">Invite only</option>
                </select>
              </label>

              <button
                className="primary-button full"
                onClick={async () => {
                  if (!supabase || !session.user.id) return

                  const videoId =
                    createSource === 'youtube'
                      ? getYouTubeVideoId(youtubeUrl)
                      : 'demo'

                  if (createSource === 'youtube' && !videoId) {
                    console.error('Please enter a valid YouTube URL or video ID.')
                    return
                  }

                  const newInviteCode = generateInviteCode()

                  const { data, error } = await supabase
                    .from('sessions')
                    .insert({
                      host_id: session.user.id,
                      title: createTitle.trim() || 'WatchSync Session',
                      video_source: createSource,
                      video_id: videoId,
                      privacy: createPrivacy,
                      status: 'live',
                      invite_code: newInviteCode,
                    })
                    .select('id, invite_code')
                    .single()

                  if (error) {
                    console.error(
                      'Could not create session:',
                      error,
                    )
                    return
                  }

                  const { error: participantError } =
                    await supabase
                      .from('participants')
                      .upsert(
                        {
                          session_id: data.id,
                          user_id: session.user.id,
                          is_active: true,
                          left_at: null,
                        },
                        {
                          onConflict:
                            'session_id,user_id',
                        },
                      )

                  if (participantError) {
                    console.error(
                      'Could not add host as participant:',
                      participantError,
                    )
                    return
                  }

                  const { data: followersData, error: followersError } =
                    await supabase
                      .from('follows')
                      .select('follower_id')
                      .eq('following_id', session.user.id)

                  if (followersError) {
                    console.error(
                      'Could not load followers for notifications:',
                      followersError,
                    )
                  } else if (followersData?.length) {
                    const notificationsToCreate = followersData.map(
                      ({ follower_id }) => ({
                        user_id: follower_id,
                        actor_id: session.user.id,
                        type: 'watching' as const,
                        session_id: data.id,
                        message: 'started watching a WatchSync session',
                      }),
                    )

                    const { error: notificationError } = await supabase
                      .from('notifications')
                      .insert(notificationsToCreate)

                    if (notificationError) {
                      console.error(
                        'Could not create watching notifications:',
                        notificationError,
                      )
                    }
                  }

                  setSessionId(data.id)
                  setInviteCode(data.invite_code)
                  setShowCreate(false)
                  setShowRoom(true)
                }}
              >
                Create WatchSync
                <Play size={16} fill="currentColor" />
              </button>

              <button
                className="ghost-button full"
                onClick={() => {
                  setShowCreate(false)
                  setJoinCode('')
                  setJoinError('')
                  setShowJoin(true)
                }}
              >
                <Users size={17} /> Join an existing WatchSync
              </button>
            </div>
          </div>
        )}

        {showJoin && (
          <div
            className="modal-backdrop"
            onMouseDown={() => setShowJoin(false)}
          >
            <div
              className="create-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <span className="section-kicker">
                    JOIN SESSION
                  </span>
                  <h2>Join a WatchSync</h2>
                </div>

                <button
                  className="close-button"
                  onClick={() => setShowJoin(false)}
                >
                  <X size={19} />
                </button>
              </div>

              <p>
                Enter the invite code shared by the person
                hosting the session.
              </p>

              <label>
                Invite code
                <input
                  value={joinCode}
                  onChange={(event) => {
                    setJoinCode(
                      event.target.value.toUpperCase(),
                    )
                    setJoinError('')
                  }}
                  placeholder="WS-7K4P"
                  maxLength={7}
                  autoFocus
                />
              </label>

              {joinError && (
                <div className="join-error">
                  {joinError}
                </div>
              )}

              <button
                className="primary-button full"
                onClick={() =>
                  void handleJoinSession()
                }
              >
                Join WatchSync <Users size={17} />
              </button>
            </div>
          </div>
        )}

        <div className="mobile-nav">
          {[
            ...navItems.slice(0, 2),
            { label: 'Create', icon: Plus },
            { label: 'Activity', icon: MessageCircle },
            { label: 'Profile', icon: Users },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={
                activeNav === label ? 'active' : ''
              }
              onClick={() =>
                label === 'Create'
                  ? setShowCreate(true)
                  : setActiveNav(label === 'Activity' ? 'Notifications' : label)
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

export default App