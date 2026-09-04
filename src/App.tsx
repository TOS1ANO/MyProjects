import { useState } from 'react'
import {
  Bell,
  Compass,
  Heart,
  Home,
  MessageCircle,
  Play,
  Plus,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react'

type Activity = {
  id: number
  name: string
  title: string
  time: string
  image: string
  viewers: number
  avatar: string
}

const activities: Activity[] = [
  {
    id: 1,
    name: 'Alex Morgan',
    title: 'Interstellar',
    time: '1:14:32',
    image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
    viewers: 4,
    avatar: 'AM',
  },
  {
    id: 2,
    name: 'Jordan Lee',
    title: 'The Dark Knight',
    time: '0:42:18',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
    viewers: 7,
    avatar: 'JL',
  },
  {
    id: 3,
    name: 'Maya Chen',
    title: 'Dune: Part Two',
    time: '0:58:07',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    viewers: 3,
    avatar: 'MC',
  },
]

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Discover', icon: Compass },
  { label: 'WatchSync', icon: Video },
  { label: 'Friends', icon: Users },
]

function App() {
  const [activeNav, setActiveNav] = useState('Home')
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const visibleActivities = activities.filter((activity) =>
    `${activity.name} ${activity.title}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Play size={16} fill="currentColor" /></span>
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
          <button className="nav-item" onClick={() => alert('Notifications coming next.')}> 
            <Bell size={19} />
            <span>Notifications</span>
            <span className="notification-dot" />
          </button>
          <button className="profile-mini" onClick={() => setActiveNav('Profile')}>
            <span className="avatar avatar-self">TO</span>
            <span className="profile-copy"><strong>Tosiano</strong><small>View profile</small></span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><Play size={14} fill="currentColor" /></span>
            WatchSync
          </div>
          <label className="search-box">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, movies, shows..." />
          </label>
          <button className="top-create" onClick={() => setShowCreate(true)}><Plus size={18} /> <span>New WatchSync</span></button>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow"><span className="live-dot" /> LIVE WITH YOUR PEOPLE</span>
            <h1>Watch together.<br /><span>Stay in sync.</span></h1>
            <p>See what your friends are watching and tune into the exact moment they’re watching it.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setShowCreate(true)}><Play size={17} fill="currentColor" /> Start Watching</button>
              <button className="ghost-button" onClick={() => setActiveNav('Discover')}><Compass size={17} /> Explore Live</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-glow" />
            <div className="hero-screen">
              <img src={activities[0].image} alt="Cinematic scene" />
              <div className="screen-overlay" />
              <div className="sync-pill"><span className="live-dot" /> LIVE</div>
              <div className="screen-info">
                <div className="screen-time">1:14:32</div>
                <div className="screen-title">Interstellar</div>
                <div className="screen-user"><span className="avatar avatar-sm">AM</span> Alex is watching</div>
              </div>
              <div className="screen-controls"><span /><span /><span /><b /></div>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><span className="section-kicker">RIGHT NOW</span><h2>Friends are watching</h2></div>
            <button className="text-button" onClick={() => setActiveNav('Discover')}>See all <span>→</span></button>
          </div>
          <div className="activity-grid">
            {visibleActivities.map((activity) => (
              <article className="activity-card" key={activity.id}>
                <div className="poster-wrap">
                  <img src={activity.image} alt={activity.title} />
                  <div className="poster-gradient" />
                  <div className="live-label"><span className="live-dot" /> LIVE</div>
                  <div className="poster-bottom"><span>{activity.time}</span><span>{activity.viewers} watching</span></div>
                </div>
                <div className="activity-info">
                  <span className="avatar">{activity.avatar}</span>
                  <div className="activity-copy"><strong>{activity.name}</strong><span>is watching <b>{activity.title}</b></span></div>
                  <button className="tune-button" onClick={() => alert(`Tuning into ${activity.name} at ${activity.time}`)}>Tune In</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="how-section">
          <div><span className="section-kicker">HOW IT WORKS</span><h2>One tap. You’re there.</h2></div>
          <div className="steps">
            <div className="step"><span>01</span><div><strong>Find your people</strong><p>See friends who are watching something right now.</p></div></div>
            <div className="step"><span>02</span><div><strong>Tap Tune In</strong><p>Jump straight to the moment they’re watching.</p></div></div>
            <div className="step"><span>03</span><div><strong>Watch together</strong><p>Stay synced with chat, reactions and presence.</p></div></div>
          </div>
        </section>

        <footer><span>WatchSync</span><span>Watch together. Stay in sync.</span></footer>
      </main>

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <div className="create-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="section-kicker">NEW SESSION</span><h2>Create a WatchSync</h2></div><button className="close-button" onClick={() => setShowCreate(false)}><X size={19} /></button></div>
            <label>What are you watching?<input placeholder="Movie, show or video title" /></label>
            <div className="source-grid"><button><Video size={20} /><strong>Demo Videos</strong><small>Ready for the MVP</small></button><button><Plus size={20} /><strong>Upload / Owned</strong><small>Connect your source</small></button><button><Compass size={20} /><strong>Public Video</strong><small>Supported sources</small></button></div>
            <label>Privacy<select defaultValue="friends"><option value="public">Public</option><option value="friends">Friends only</option><option value="invite">Invite only</option></select></label>
            <button className="primary-button full" onClick={() => { setShowCreate(false); alert('Demo WatchSync created.') }}>Create WatchSync <Play size={16} fill="currentColor" /></button>
          </div>
        </div>
      )}

      <div className="mobile-nav">
        {[...navItems.slice(0, 2), { label: 'Create', icon: Plus }, { label: 'Activity', icon: MessageCircle }, { label: 'Profile', icon: Users }].map(({ label, icon: Icon }) => (
          <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => label === 'Create' ? setShowCreate(true) : setActiveNav(label)}><Icon size={19} /><span>{label}</span></button>
        ))}
      </div>
    </div>
  )
}

export default App
