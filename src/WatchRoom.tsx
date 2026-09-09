import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, Copy, MessageCircle, Pause, Play, Send, Users, X } from 'lucide-react'
import { createSyncTransport, getAuthoritativePosition, shouldHardSeek, type PlaybackState, type SyncTransport } from './sync'
import './watch-room.css'
import { supabase } from './supabase'

const DEMO_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const REACTIONS = ['❤️', '😂', '🔥', '😮', '👏']
const initialState: PlaybackState = { position: 0, isPlaying: false, playbackRate: 1, updatedAt: Date.now(), source: DEMO_VIDEO }
type Message = { id: number; name: string; text: string }
type Participant = { id: string; name: string; avatar: string; status: string; isHost: boolean }
type Reaction = { id: number; userId: string; reaction: string; left: number; size: number; duration: number; rotation: number; delay: number }
const initialMessages: Message[] = []
const initialReactions: Reaction[] = []

function formatTime(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); const minutes = Math.floor(safe / 60); const secs = safe % 60; return `${minutes}:${secs.toString().padStart(2, '0')}` }
function getInitials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'WS' }

type WatchRoomProps = {
  sessionId: string | null
  inviteCode: string | null
  onLeave: () => void
}

export default function WatchRoom({ sessionId, inviteCode, onLeave }: WatchRoomProps) {
const videoRef = useRef<HTMLVideoElement>(null)
const transportRef = useRef<SyncTransport | null>(null)
const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
const reactionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
const applyingRemoteRef = useRef(false)
const lastBroadcastRef = useRef(0)
const lastPersistRef = useRef(0)
const stateRef = useRef(initialState)
const isHostRef = useRef(false)
const hostUserIdRef = useRef<string | null>(null)
const currentUserIdRef = useRef<string | null>(null)
const currentUserNameRef = useRef('You')
const currentPresenceKeyRef = useRef<string | null>(null)
const hasLeftRef = useRef(false)
const [state, setState] = useState(initialState)
const [duration, setDuration] = useState(0)
const [transportMode, setTransportMode] = useState<'supabase' | 'browser'>('browser')
const [messages, setMessages] = useState(initialMessages)
const [message, setMessage] = useState('')
const [copied, setCopied] = useState(false)
const [isHost, setIsHost] = useState(false)
const [participants, setParticipants] = useState<Participant[]>([])
const [reactions, setReactions] = useState(initialReactions)

const markParticipantInactive = useCallback(async () => {
if (!supabase || !sessionId || !currentUserIdRef.current || hasLeftRef.current) return

hasLeftRef.current = true

const { error } = await supabase
  .from('participants')
  .update({
    is_active: false,
    left_at: new Date().toISOString(),
  })
  .eq('session_id', sessionId)
  .eq('user_id', currentUserIdRef.current)

if (error) console.error('Could not mark participant inactive:', error)
}, [sessionId])

useEffect(() => {
hasLeftRef.current = false

return () => {
  void markParticipantInactive()
}
}, [sessionId, markParticipantInactive])

const leaveRoom = useCallback(async () => {
await markParticipantInactive()
onLeave()
}, [markParticipantInactive, onLeave])

const createReaction = useCallback((id: number, userId: string, reaction: string): Reaction => ({
id,
userId,
reaction,
left: Math.floor(Math.random() * 82) + 8,
size: Math.floor(Math.random() * 13) + 25,
duration: Number((Math.random() * 1.4 + 2.8).toFixed(2)),
rotation: Math.floor(Math.random() * 25) - 12,
delay: Number((Math.random() * 0.35).toFixed(2)),
}), [])

const persistState = useCallback(async (next: PlaybackState, force = false) => {
if (!supabase || !sessionId || !isHostRef.current || !hostUserIdRef.current) return

const now = Date.now()
if (!force && now - lastPersistRef.current < 1500) return

lastPersistRef.current = now

const { error } = await supabase
  .from('playback_state')
  .upsert({
    session_id: sessionId,
    is_playing: next.isPlaying,
    position: next.position,
    playback_rate: next.playbackRate,
    updated_at: new Date(next.updatedAt).toISOString(),
    updated_by: hostUserIdRef.current,
  })

if (error) console.error('Could not save playback state:', error)
}, [sessionId])

useEffect(() => {
let active = true
if (!supabase || !sessionId) return

void (async () => {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return

  currentUserIdRef.current = authData.user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', authData.user.id)
    .maybeSingle()

  currentUserNameRef.current = profile?.display_name || profile?.username || 'You'

  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .select('host_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) {
    console.error('Could not check host:', sessionError)
    return
  }

  const hostUserId = sessionData?.host_id || null
  const host = hostUserId === authData.user.id

  if (active) {
    isHostRef.current = host
    hostUserIdRef.current = hostUserId
    setIsHost(host)
  }

  const { data: savedState, error: stateError } = await supabase
    .from('playback_state')
    .select('is_playing, position, playback_rate, updated_at')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (stateError) {
    console.error('Could not load playback state:', stateError)
    return
  }

  if (savedState && active && !host) {
    const loaded: PlaybackState = {
      position: savedState.position,
      isPlaying: savedState.is_playing,
      playbackRate: savedState.playback_rate,
      updatedAt: Date.now(),
      source: DEMO_VIDEO,
    }

    stateRef.current = loaded
    setState(loaded)

    if (videoRef.current) {
      videoRef.current.currentTime = loaded.position
      videoRef.current.playbackRate = loaded.playbackRate

      if (loaded.isPlaying) {
        void videoRef.current.play().catch(() => undefined)
      }
    }
  }

  if (!savedState && host) {
    const initial: PlaybackState = {
      position: 0,
      isPlaying: false,
      playbackRate: 1,
      updatedAt: Date.now(),
      source: DEMO_VIDEO,
    }

    stateRef.current = initial
    await persistState(initial, true)
  }
})()

return () => {
  active = false
}
}, [sessionId, persistState])

useEffect(() => {
let active = true
if (!supabase || !sessionId) return

void (async () => {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user || !active) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', authData.user.id)
    .maybeSingle()

  const name = profile?.display_name || profile?.username || 'You'
  const presenceKey = `${authData.user.id}:${crypto.randomUUID()}`
  currentPresenceKeyRef.current = presenceKey

  const channel = supabase.channel(`watchsync-presence:${sessionId}`, {
    config: {
      presence: {
        key: presenceKey,
      },
    },
  })

  presenceChannelRef.current = channel

  const updateParticipants = () => {
    const presence = channel.presenceState()
    const next: Participant[] = []

    Object.entries(presence).forEach(([presenceId, entries]) => {
      const entry = (entries[0] || {}) as {
        name?: string
        isHost?: boolean
        userId?: string
        joinedAt?: number
      }

      next.push({
        id: presenceId,
        name: entry.name || 'Watching',
        avatar: getInitials(entry.name || 'Watching'),
        status: stateRef.current.isPlaying ? 'Watching now' : 'Paused',
        isHost: Boolean(entry.isHost),
      })
    })

    next.sort((a, b) => {
      if (a.id === presenceKey) return -1
      if (b.id === presenceKey) return 1
      return a.name.localeCompare(b.name)
    })

    if (active) setParticipants(next)
  }

  channel
    .on('presence', { event: 'sync' }, updateParticipants)
    .on('presence', { event: 'join' }, updateParticipants)
    .on('presence', { event: 'leave' }, updateParticipants)

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userId: authData.user.id,
        name,
        isHost: isHostRef.current,
        joinedAt: Date.now(),
      })

      updateParticipants()
    }
  })
})()

return () => {
  active = false
  currentPresenceKeyRef.current = null

  const channel = presenceChannelRef.current
  presenceChannelRef.current = null

  if (channel) void supabase.removeChannel(channel)
}
}, [sessionId])

useEffect(() => {
if (!supabase || !sessionId) return

setParticipants((current) =>
  current.map((participant) => ({
    ...participant,
    status: stateRef.current.isPlaying ? 'Watching now' : 'Paused',
  })),
)
}, [state.isPlaying, sessionId])

useEffect(() => {
let active = true
if (!supabase || !sessionId) return

void (async () => {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user || !active) return

  currentUserIdRef.current = authData.user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', authData.user.id)
    .maybeSingle()

  const userName = profile?.display_name || profile?.username || 'You'
  currentUserNameRef.current = userName

  const { data, error } = await supabase
    .from('messages')
    .select('id, user_id, text, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Could not load messages:', error)
  } else if (active) {
    const userIds = [...new Set((data || []).map((item) => item.user_id))]
    let profiles: { id: string; display_name: string; username: string }[] = []

    if (userIds.length) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', userIds)

      profiles = profileData || []
    }

    const loadedMessages: Message[] = (data || []).map((item) => {
      const sender = profiles.find((profile) => profile.id === item.user_id)
      const senderName = sender?.display_name || sender?.username || 'You'

      return {
        id: Number(item.id),
        name: item.user_id === authData.user.id ? 'You' : senderName,
        text: item.text,
      }
    })

    setMessages(loadedMessages)
  }

  const channel = supabase.channel(`watchsync-chat:${sessionId}`)
  chatChannelRef.current = channel

  channel.on('broadcast', { event: 'message' }, ({ payload }) => {
    const incoming = payload as {
      id: number
      userId: string
      name: string
      text: string
    }

    if (!incoming?.text || incoming.userId === currentUserIdRef.current) return

    setMessages((current) => {
      if (current.some((item) => item.id === incoming.id)) return current

      return [...current, {
        id: incoming.id,
        name: incoming.name,
        text: incoming.text,
      }]
    })
  })

  await channel.subscribe()
})()

return () => {
  active = false
  const channel = chatChannelRef.current
  chatChannelRef.current = null
  if (channel) void supabase.removeChannel(channel)
}
}, [sessionId])

useEffect(() => {
let active = true
if (!supabase || !sessionId) return

void (async () => {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user || !active) return

  currentUserIdRef.current = authData.user.id

  const { data, error } = await supabase
    .from('reactions')
    .select('id, user_id, reaction, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Could not load reactions:', error)
  } else if (active) {
    setReactions(
      (data || []).map((item) => createReaction(
        Number(item.id),
        item.user_id,
        item.reaction,
      )),
    )
  }

  const channel = supabase.channel(`watchsync-reactions:${sessionId}`)
  reactionChannelRef.current = channel

  channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
    const incoming = payload as {
      id: number
      userId: string
      reaction: string
    }

    if (!incoming?.reaction) return

    setReactions((current) => {
      if (current.some((item) => item.id === incoming.id)) return current

      return [
        ...current,
        createReaction(
          incoming.id,
          incoming.userId,
          incoming.reaction,
        ),
      ].slice(-30)
    })

    window.setTimeout(() => {
      setReactions((current) => current.filter((item) => item.id !== incoming.id))
    }, 3500)
  })

  await channel.subscribe()
})()

return () => {
  active = false
  const channel = reactionChannelRef.current
  reactionChannelRef.current = null
  if (channel) void supabase.removeChannel(channel)
}
}, [sessionId, createReaction])

const broadcast = useCallback((next: PlaybackState, force = false) => {
if (!isHostRef.current) return

const now = Date.now()
if (!force && now - lastBroadcastRef.current < 250) return

lastBroadcastRef.current = now
stateRef.current = next
setState(next)
void transportRef.current?.send(next)
void persistState(next, force)
}, [persistState])

const syncFromVideo = useCallback((isPlaying: boolean, force = false) => {
const video = videoRef.current
if (!video || applyingRemoteRef.current || !isHostRef.current) return

broadcast({
  position: video.currentTime,
  isPlaying,
  playbackRate: video.playbackRate,
  updatedAt: Date.now(),
  source: DEMO_VIDEO,
}, force)
}, [broadcast])

const applyRemoteState = useCallback(async (remote: PlaybackState) => {
const video = videoRef.current
if (!video || applyingRemoteRef.current) return

const target = Math.min(getAuthoritativePosition(remote), duration || Number.MAX_SAFE_INTEGER)
const drift = target - video.currentTime

applyingRemoteRef.current = true

try {
  if (shouldHardSeek(drift)) {
    video.currentTime = target
  } else if (Math.abs(drift) > 0.08) {
    video.currentTime += drift * 0.25
  }

  if (Math.abs(video.playbackRate - remote.playbackRate) > 0.01) {
    video.playbackRate = remote.playbackRate
  }

  if (remote.isPlaying && video.paused) {
    await video.play().catch(() => undefined)
  }

  if (!remote.isPlaying && !video.paused) {
    video.pause()
  }
} finally {
  applyingRemoteRef.current = false
}

stateRef.current = remote
setState(remote)
}, [duration])

useEffect(() => {
let active = true
if (!sessionId) return

void createSyncTransport(sessionId).then((transport) => {
  if (!active) {
    void transport.close()
    return
  }

  transportRef.current = transport
  setTransportMode(transport.mode)
  transport.subscribe((remote) => void applyRemoteState(remote))
})

return () => {
  active = false
  void transportRef.current?.close()
  transportRef.current = null
}
}, [sessionId, applyRemoteState])

useEffect(() => {
const interval = window.setInterval(() => {
const video = videoRef.current
if (!video || applyingRemoteRef.current || !stateRef.current.isPlaying) return

const next = { ...stateRef.current, position: video.currentTime, updatedAt: Date.now() }
stateRef.current = next
setState(next)

if (isHostRef.current) void persistState(next)
}, 1000)

return () => window.clearInterval(interval)
}, [persistState])

const handlePlay = async () => {
if (!isHostRef.current) return
const video = videoRef.current
if (!video) return
await video.play().catch(() => undefined)
syncFromVideo(true, true)
}

const handlePause = () => {
if (!isHostRef.current) return
const video = videoRef.current
if (!video) return
video.pause()
syncFromVideo(false, true)
}

const handleSeek = (value: number) => {
if (!isHostRef.current) return
const video = videoRef.current
if (!video) return

video.currentTime = value

const now = Date.now()

if (now - lastBroadcastRef.current >= 100) {
  lastBroadcastRef.current = now

  const next: PlaybackState = {
    position: video.currentTime,
    isPlaying: stateRef.current.isPlaying,
    playbackRate: video.playbackRate,
    updatedAt: now,
    source: DEMO_VIDEO,
  }

  stateRef.current = next
  setState(next)
  void transportRef.current?.send(next)
  void persistState(next)
}
}

const sendMessage = async () => {
const text = message.trim()
if (!text || !supabase || !sessionId || !currentUserIdRef.current) return

const userId = currentUserIdRef.current

const { data, error } = await supabase
  .from('messages')
  .insert({
    session_id: sessionId,
    user_id: userId,
    text,
  })
  .select('id, created_at')
  .single()

if (error) {
  console.error('Could not send message:', error)
  return
}

const newMessage: Message = {
  id: Number(data.id),
  name: 'You',
  text,
}

setMessages((current) => [...current, newMessage])
setMessage('')

await chatChannelRef.current?.send({
  type: 'broadcast',
  event: 'message',
  payload: {
    id: Number(data.id),
    userId,
    name: currentUserNameRef.current,
    text,
  },
})
}

const sendReaction = async (reaction: string) => {
if (!supabase || !sessionId || !currentUserIdRef.current) return

const userId = currentUserIdRef.current

const { data, error } = await supabase
  .from('reactions')
  .insert({
    session_id: sessionId,
    user_id: userId,
    reaction,
  })
  .select('id')
  .single()

if (error) {
  console.error('Could not send reaction:', error)
  return
}

const id = Number(data.id)
const newReaction = createReaction(id, userId, reaction)

setReactions((current) => [
  ...current,
  newReaction,
].slice(-30))

window.setTimeout(() => {
  setReactions((current) => current.filter((item) => item.id !== id))
}, 3500)

await reactionChannelRef.current?.send({
  type: 'broadcast',
  event: 'reaction',
  payload: {
    id,
    userId,
    reaction,
  },
})
}

const copyInvite = async () => {
if (!inviteCode) return
await navigator.clipboard?.writeText(inviteCode)
setCopied(true)
window.setTimeout(() => setCopied(false), 1600)
}

const displayedTime = state.isPlaying ? getAuthoritativePosition(state) : state.position

return <div className="watch-room"> <header className="room-header"><button className="room-back" onClick={() => void leaveRoom()}><ArrowLeft size={18} /> <span>Leave room</span></button><div className="room-title"><span className="live-dot" /><strong>Interstellar — WatchSync Demo</strong><small>{transportMode === 'supabase' ? 'Realtime connected' : 'Local two-tab sync'}</small></div><button className="invite-button" onClick={() => void copyInvite()}><Copy size={16} /> {copied ? 'Copied' : inviteCode || 'Invite'}</button></header> <div className="room-layout"><section className="player-column"><div className="video-shell"><video ref={videoRef} src={DEMO_VIDEO} playsInline preload="metadata" onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} onPlay={() => syncFromVideo(true, true)} onPause={() => syncFromVideo(false, true)} onRateChange={() => syncFromVideo(stateRef.current.isPlaying, true)} onSeeked={() => syncFromVideo(stateRef.current.isPlaying)} controls={false} /><div className="video-badge"><span className="live-dot" /> SYNCED</div><div className="video-time">{formatTime(displayedTime)}</div></div><div className="player-controls"><button className="play-control" onClick={() => state.isPlaying ? handlePause() : void handlePlay()} disabled={!isHost}>{state.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><input className="seekbar" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(displayedTime, duration || 1)} onChange={(event) => handleSeek(Number(event.target.value))} disabled={!isHost} /><span className="time-label">{formatTime(displayedTime)} / {formatTime(duration)}</span></div><div className="reaction-bar"><span>React</span>{REACTIONS.map((reaction) => <button key={reaction} onClick={() => void sendReaction(reaction)} aria-label={`Send ${reaction}`}>{reaction}</button>)}</div><div className="floating-reactions">{reactions.map((item) => <span className="floating-reaction" key={item.id} style={{ left: `${item.left}%`, fontSize: `${item.size}px`, animationDuration: `${item.duration}s`, animationDelay: `${item.delay}s`, '--reaction-rotation': `${item.rotation}deg` } as CSSProperties}>{item.reaction}</span>)}</div><div className="room-status"><div><span className="status-pulse" /> {isHost ? 'You control playback' : 'Host controls playback'}</div><span>{participants.length} {participants.length === 1 ? 'person' : 'people'} watching</span></div></section><aside className="room-side"><div className="participants-panel"><div className="panel-heading"><strong><Users size={17} /> Watching now</strong><span>{participants.length}</span></div>{participants.map((participant) => <div className="participant" key={participant.id}><span className="avatar">{participant.avatar}</span><div><strong>{participant.id === currentPresenceKeyRef.current ? 'You' : participant.name}</strong><small>{participant.isHost ? 'Host' : participant.status}</small></div><i /></div>)}</div><div className="chat-panel"><div className="panel-heading"><strong><MessageCircle size={17} /> Live chat</strong><span>{messages.length}</span></div><div className="messages">{messages.map((item) => <div className="message" key={item.id}><strong>{item.name}</strong><span>{item.text}</span></div>)}</div><form className="chat-form" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Say something..." /><button aria-label="Send" type="submit"><Send size={16} /></button></form></div></aside></div><button className="room-close" onClick={() => void leaveRoom()}><X size={16} /> Close WatchSync</button></div>
}