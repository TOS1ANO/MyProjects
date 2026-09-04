import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, MessageCircle, Pause, Play, Send, Users, X } from 'lucide-react'
import { createSyncTransport, getAuthoritativePosition, shouldHardSeek, type PlaybackState, type SyncTransport } from './sync'

const DEMO_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const SESSION_ID = 'demo-room'

const initialState: PlaybackState = {
  position: 0,
  isPlaying: false,
  playbackRate: 1,
  updatedAt: Date.now(),
  source: DEMO_VIDEO,
}

type Message = { id: number; name: string; text: string }

const initialMessages: Message[] = [
  { id: 1, name: 'Alex', text: 'Welcome to the WatchSync demo 👋' },
  { id: 2, name: 'Maya', text: 'The sync feels instant!' },
]

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const secs = safe % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export default function WatchRoom({ onLeave }: { onLeave: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const transportRef = useRef<SyncTransport | null>(null)
  const applyingRemoteRef = useRef(false)
  const stateRef = useRef<PlaybackState>(initialState)
  const [state, setState] = useState(initialState)
  const [transportMode, setTransportMode] = useState<'supabase' | 'browser'>('browser')
  const [messages, setMessages] = useState(initialMessages)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const applyRemoteState = useCallback(async (remote: PlaybackState) => {
    const video = videoRef.current
    if (!video) return

    const target = getAuthoritativePosition(remote)
    const drift = target - video.currentTime
    applyingRemoteRef.current = true

    try {
      if (shouldHardSeek(drift)) video.currentTime = target
      else if (Math.abs(drift) > 0.12) video.currentTime += drift * 0.35

      video.playbackRate = remote.playbackRate
      if (remote.isPlaying && video.paused) await video.play().catch(() => undefined)
      if (!remote.isPlaying && !video.paused) video.pause()
    } finally {
      applyingRemoteRef.current = false
    }

    stateRef.current = remote
    setState(remote)
  }, [])

  const broadcast = useCallback((next: PlaybackState) => {
    stateRef.current = next
    setState(next)
    void transportRef.current?.send(next)
  }, [])

  const syncFromVideo = useCallback((isPlaying: boolean) => {
    const video = videoRef.current
    if (!video || applyingRemoteRef.current) return

    broadcast({
      position: video.currentTime,
      isPlaying,
      playbackRate: video.playbackRate,
      updatedAt: Date.now(),
      source: DEMO_VIDEO,
    })
  }, [broadcast])

  useEffect(() => {
    let active = true

    void createSyncTransport(SESSION_ID).then((transport) => {
      if (!active) {
        void transport.close()
        return
      }
      transportRef.current = transport
      setTransportMode(transport.mode)
      const unsubscribe = transport.subscribe((remote) => void applyRemoteState(remote))
      ;(transportRef.current as SyncTransport & { unsubscribe?: () => void }).unsubscribe = unsubscribe
    })

    return () => {
      active = false
      void transportRef.current?.close()
      transportRef.current = null
    }
  }, [applyRemoteState])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const video = videoRef.current
      if (!video || applyingRemoteRef.current || !stateRef.current.isPlaying) return
      const next = { ...stateRef.current, position: video.currentTime, updatedAt: Date.now() }
      stateRef.current = next
      setState(next)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const handlePlay = async () => {
    await videoRef.current?.play()
    syncFromVideo(true)
  }

  const handlePause = () => {
    videoRef.current?.pause()
    syncFromVideo(false)
  }

  const handleSeek = (value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    syncFromVideo(stateRef.current.isPlaying)
  }

  const sendMessage = () => {
    const text = message.trim()
    if (!text) return
    setMessages((current) => [...current, { id: Date.now(), name: 'You', text }])
    setMessage('')
  }

  const copyInvite = async () => {
    await navigator.clipboard?.writeText('WS-DEMO')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const displayedTime = state.isPlaying ? getAuthoritativePosition(state) : state.position

  return (
    <div className="watch-room">
      <header className="room-header">
        <button className="room-back" onClick={onLeave}><ArrowLeft size={18} /> <span>Leave room</span></button>
        <div className="room-title"><span className="live-dot" /> <strong>Interstellar — WatchSync Demo</strong><small>{transportMode === 'supabase' ? 'Realtime connected' : 'Local two-tab sync'}</small></div>
        <button className="invite-button" onClick={() => void copyInvite()}><Copy size={16} /> {copied ? 'Copied' : 'WS-DEMO'}</button>
      </header>

      <div className="room-layout">
        <section className="player-column">
          <div className="video-shell">
            <video
              ref={videoRef}
              src={DEMO_VIDEO}
              playsInline
              preload="metadata"
              onPlay={() => syncFromVideo(true)}
              onPause={() => syncFromVideo(false)}
              onRateChange={() => syncFromVideo(stateRef.current.isPlaying)}
              onSeeked={() => syncFromVideo(stateRef.current.isPlaying)}
              controls={false}
            />
            <div className="video-badge"><span className="live-dot" /> SYNCED</div>
            <div className="video-time">{formatTime(displayedTime)}</div>
          </div>

          <div className="player-controls">
            <button className="play-control" onClick={() => state.isPlaying ? handlePause() : void handlePlay()}>{state.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
            <input className="seekbar" type="range" min="0" max={videoRef.current?.duration || 60} step="0.1" value={Math.min(displayedTime, videoRef.current?.duration || 60)} onChange={(event) => handleSeek(Number(event.target.value))} />
            <span className="time-label">{formatTime(displayedTime)} / {formatTime(videoRef.current?.duration || 0)}</span>
          </div>

          <div className="room-status">
            <div><span className="status-pulse" /> Host controls playback</div>
            <span>Drift correction active</span>
          </div>
        </section>

        <aside className="room-side">
          <div className="participants-panel">
            <div className="panel-heading"><strong><Users size={17} /> Watching now</strong><span>3</span></div>
            <div className="participant"><span className="avatar">TO</span><div><strong>You</strong><small>Host</small></div><i /></div>
            <div className="participant"><span className="avatar">AM</span><div><strong>Alex Morgan</strong><small>Watching</small></div><i /></div>
            <div className="participant"><span className="avatar">MC</span><div><strong>Maya Chen</strong><small>Watching</small></div><i /></div>
          </div>

          <div className="chat-panel">
            <div className="panel-heading"><strong><MessageCircle size={17} /> Live chat</strong></div>
            <div className="messages">{messages.map((item) => <div className="message" key={item.id}><strong>{item.name}</strong><span>{item.text}</span></div>)}</div>
            <form className="chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage() }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Say something..." /><button aria-label="Send"><Send size={16} /></button></form>
          </div>
        </aside>
      </div>

      <button className="room-close" onClick={onLeave}><X size={16} /> Close WatchSync</button>
    </div>
  )
}
