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

const generateInviteCode = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let i = 0; i < 4; i++) {
    code += characters[Math.floor(Math.random() * characters.length)]
  }

  return `WS-${code}`
}

type Activity = {
  id: number
  name: string
  title: string
  time: string
  image: string
  viewers: number
  avatar: string
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

const activities: Activity[] = [
  { id: 1, name: 'Alex Morgan', title: 'Interstellar', time: '1:14:32', image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80', viewers: 4, avatar: 'AM' },
  { id: 2, name: 'Jordan Lee', title: 'The Dark Knight', time: '0:42:18', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80', viewers: 7, avatar: 'JL' },
  { id: 3, name: 'Maya Chen', title: 'Dune: Part Two', time: '0:58:07', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80', viewers: 3, avatar: 'MC' },
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

  const visibleActivities = activities.filter((activity) =>
    `${activity.name} ${activity.title}`.toLowerCase().includes(search.toLowerCase()),
  )

  const visibleFriends = friends.filter((friend) =>
    `${friend.displayName} ${friend.username} ${friend.bio}`.toLowerCase().includes(search.toLowerCase()),
  )

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
    const followingIds = new Set((followingData || []).map((follow) => follow.following_id))

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
      followers: followerCounts.filter((item) => item.following_id === profile.id).length,
      following: followingCounts.filter((item) => item.follower_id === profile.id).length,
    }))

    setFriends(nextFriends)
    setFriendsLoading(false)
  }

  useEffect(() => {
    if (activeNav !== 'Friends' || !session?.user.id) return
    void loadFriends()
  }, [activeNav, session?.user.id])

  const toggleFollow = async (friendId: string, currentlyFollowing: boolean) => {
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
      return
    }

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: session.user.id,
        following_id: friendId,
      })

    if (error) {
      console.error('Could not follow user:', error)
      return
    }

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

  if (showRoom) return <WatchRoom sessionId={sessionId} inviteCode={inviteCode} onLeave={() => setShowRoom(false)} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Play size={16} fill="currentColor" /></span><span>WatchSync</span></div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => <button className={`nav-item ${activeNav === label ? 'active' : ''}`} key={label} onClick={() => setActiveNav(label)}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setActiveNav('Notifications')}><Bell size={19} /><span>Notifications</span><span className="notification-dot" /></button>
          <div className="profile-area">
            <button className="profile-mini" onClick={() => setActiveNav('Profile')}><span className="avatar avatar-self">TO</span><span className="profile-copy"><strong>{session.user.email?.split('@')[0] || 'You'}</strong><small>View profile</small></span></button>
            <button className="logout-button" onClick={async () => { if (supabase) { await supabase.auth.signOut() } }}>Log out</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Play size={14} fill="currentColor" /></span>WatchSync</div>
          <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeNav === 'Friends' ? 'Search people...' : 'Search people, movies, shows...'} /></label>
          <button className="top-create" onClick={() => setShowCreate(true)}><Plus size={18} /><span>New WatchSync</span></button>
        </header>

        {activeNav === 'Friends' ? (
          <section className="section-block">
            <div className="section-heading">
              <div><span className="section-kicker">YOUR PEOPLE</span><h2>Find friends</h2></div>
              <button className="text-button" onClick={() => void loadFriends()}>Refresh <span>↻</span></button>
            </div>

            {friendsLoading ? (
              <div className="auth-loading"><span>Loading people...</span></div>
            ) : friendsError ? (
              <div className="join-error">{friendsError}</div>
            ) : visibleFriends.length ? (
              <div className="activity-grid">
                {visibleFriends.map((friend) => <article className="friends-card" key={friend.id}>
                  <div className="activity-info">
                    <span className="avatar">{friend.avatar ? <img src={friend.avatar} alt={friend.displayName} /> : friend.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                    <div className="activity-copy">
                      <strong>{friend.displayName}</strong>
                      <span>@{friend.username}</span>
                      {friend.bio && <span>{friend.bio}</span>}
                      <small>{friend.followers} followers · {friend.following} following</small>
                    </div>
                    <button className={friend.isFollowing ? 'ghost-button' : 'tune-button'} onClick={() => void toggleFollow(friend.id, friend.isFollowing)}>{friend.isFollowing ? 'Following' : 'Follow'}</button>
                  </div>
                </article>)}
              </div>
            ) : (
              <div className="how-section">
                <span className="section-kicker">NO PEOPLE FOUND</span>
                <h2>Try another search.</h2>
                <p>Once more people create WatchSync profiles, they’ll appear here.</p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow"><span className="live-dot" /> LIVE WITH YOUR PEOPLE</span>
                <h1>Watch together.<br /><span>Stay in sync.</span></h1>
                <p>See what your friends are watching and tune into the exact moment they’re watching it.</p>
                <div className="hero-actions"><button className="primary-button" onClick={() => setShowCreate(true)}><Play size={17} fill="currentColor" /> Start Watching</button><button className="ghost-button" onClick={() => setActiveNav('Discover')}><Compass size={17} /> Explore Live</button></div>
              </div>
              <div className="hero-visual"><div className="hero-glow" /><div className="hero-screen"><img src={activities[0].image} alt="Cinematic scene" /><div className="screen-overlay" /><div className="sync-pill"><span className="live-dot" /> LIVE</div><div className="screen-info"><div className="screen-time">1:14:32</div><div className="screen-title">Interstellar</div><div className="screen-user"><span className="avatar avatar-sm">AM</span> Alex is watching</div></div><div className="screen-controls"><span /><span /><span /><b /></div></div></div>
            </section>

            <section className="section-block">
              <div className="section-heading"><div><span className="section-kicker">RIGHT NOW</span><h2>Friends are watching</h2></div><button className="text-button" onClick={() => setActiveNav('Discover')}>See all <span>→</span></button></div>
              <div className="activity-grid">
                {visibleActivities.map((activity) => <article className="activity-card" key={activity.id}><div className="poster-wrap"><img src={activity.image} alt={activity.title} /><div className="poster-gradient" /><div className="live-label"><span className="live-dot" /> LIVE</div><div className="poster-bottom"><span>{activity.time}</span><span>{activity.viewers} watching</span></div></div><div className="activity-info"><span className="avatar">{activity.avatar}</span><div className="activity-copy"><strong>{activity.name}</strong><span>is watching <b>{activity.title}</b></span></div><button className="tune-button" onClick={() => setShowJoin(true)}>Tune In</button></div></article>)}
              </div>
            </section>

            <section className="how-section"><div><span className="section-kicker">HOW IT WORKS</span><h2>One tap. You’re there.</h2></div><div className="steps"><div className="step"><span>01</span><div><strong>Find your people</strong><p>See friends who are watching something right now.</p></div></div><div className="step"><span>02</span><div><strong>Tap Tune In</strong><p>Jump straight to the moment they’re watching.</p></div></div><div className="step"><span>03</span><div><strong>Watch together</strong><p>Stay synced with chat, reactions and presence.</p></div></div></div></section>
            <footer><span>WatchSync</span><span>Watch together. Stay in sync.</span></footer>
          </>
        )}

        {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><div className="create-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="section-kicker">NEW SESSION</span><h2>Create a WatchSync</h2></div><button className="close-button" onClick={() => setShowCreate(false)}><X size={19} /></button></div><label>What are you watching?<input placeholder="Movie, show or video title" /></label><div className="source-grid"><button onClick={() => { setShowCreate(false); setShowRoom(true) }}><Video size={20} /><strong>Demo Videos</strong><small>Ready for the MVP</small></button><button disabled><Plus size={20} /><strong>Upload / Owned</strong><small>Coming next</small></button><button disabled><Compass size={20} /><strong>Public Video</strong><small>Provider adapters next</small></button></div><label>Privacy<select defaultValue="friends"><option value="public">Public</option><option value="friends">Friends only</option><option value="invite">Invite only</option></select></label><button className="primary-button full" onClick={async () => {
          if (!supabase || !session.user.id) return

          const newInviteCode = generateInviteCode()

          const { data, error } = await supabase
            .from('sessions')
            .insert({
              host_id: session.user.id,
              title: 'WatchSync Session',
              video_source: 'demo',
              video_id: 'demo',
              privacy: 'friends',
              status: 'live',
              invite_code: newInviteCode,
            })
            .select('id, invite_code')
            .single()

          if (error) {
            console.error('Could not create session:', error)
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
            console.error('Could not add host as participant:', participantError)
            return
          }

          setSessionId(data.id)
          setInviteCode(data.invite_code)
          setShowCreate(false)
          setShowRoom(true)
        }}>Create WatchSync <Play size={16} fill="currentColor" /></button><button className="ghost-button full" onClick={() => { setShowCreate(false); setJoinCode(''); setJoinError(''); setShowJoin(true) }}><Users size={17} /> Join an existing WatchSync</button></div></div>}

        {showJoin && <div className="modal-backdrop" onMouseDown={() => setShowJoin(false)}><div className="create-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="section-kicker">JOIN SESSION</span><h2>Join a WatchSync</h2></div><button className="close-button" onClick={() => setShowJoin(false)}><X size={19} /></button></div><p>Enter the invite code shared by the person hosting the session.</p><label>Invite code<input value={joinCode} onChange={(event) => { setJoinCode(event.target.value.toUpperCase()); setJoinError('') }} placeholder="WS-7K4P" maxLength={7} autoFocus /></label>{joinError && <div className="join-error">{joinError}</div>}<button className="primary-button full" onClick={() => void handleJoinSession()}>Join WatchSync <Users size={17} /></button></div></div>}

        <div className="mobile-nav">{[...navItems.slice(0, 2), { label: 'Create', icon: Plus }, { label: 'Activity', icon: MessageCircle }, { label: 'Profile', icon: Users }].map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => label === 'Create' ? setShowCreate(true) : setActiveNav(label)}><Icon size={19} /><span>{label}</span></button>)}</div>
      </main>
    </div>
  )
}

export default App