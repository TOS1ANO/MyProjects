import { FormEvent, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Play } from 'lucide-react'
import { supabase } from './supabase'

type AuthMode = 'login' | 'signup' | 'forgot'

type AuthProps = {
  onBack: () => void
}

function Auth({ onBack }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resetMessages = () => {
    setMessage('')
    setError('')
  }

  const createProfile = async (userId: string) => {
    if (!supabase) return

    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim() || cleanUsername

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          username: cleanUsername,
          display_name: cleanDisplayName,
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      throw profileError
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    resetMessages()

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (loginError) throw loginError

        if (data.user) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!existingProfile) {
            const metadataUsername = data.user.user_metadata?.username
            const metadataDisplayName = data.user.user_metadata?.display_name

            if (metadataUsername) {
              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  username: metadataUsername,
                  display_name: metadataDisplayName || metadataUsername,
                })

              if (profileError) {
                console.error('Could not create profile:', profileError)
              }
            }
          }
        }
      }

      if (mode === 'signup') {
        const cleanUsername = username.trim().toLowerCase()
        const cleanDisplayName = displayName.trim() || cleanUsername

        if (cleanUsername.length < 3) {
          throw new Error('Username must be at least 3 characters.')
        }

        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanDisplayName,
            },
          },
        })

        if (signupError) throw signupError

        if (data.user && data.session) {
          await createProfile(data.user.id)
          setMessage('Account created successfully.')
        } else {
          setMessage(
            'Account created. Check your email to confirm your account, then log in.',
          )
        }
      }

      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}`,
          },
        )

        if (resetError) throw resetError

        setMessage('Password reset instructions have been sent to your email.')
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Welcome back.'
      : mode === 'signup'
        ? 'Join WatchSync.'
        : 'Reset your password.'

  const subtitle =
    mode === 'login'
      ? 'Sign in and tune into what your people are watching.'
      : mode === 'signup'
        ? 'Create your account and start watching together.'
        : 'Enter your email and we’ll send you a reset link.'

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to WatchSync
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <Play size={16} fill="currentColor" />
          </span>
          <span>WatchSync</span>
        </div>

        <div className="auth-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {error && <div className="auth-message error">{error}</div>}
        {message && <div className="auth-message success">{message}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <>
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="tosiano"
                  minLength={3}
                  required
                />
              </label>

              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Tosiano"
                  required
                />
              </label>
            </>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {mode !== 'forgot' && (
            <label>
              Password
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="forgot-button"
              onClick={() => {
                resetMessages()
                setMode('forgot')
              }}
            >
              Forgot password?
            </button>
          )}

          <button className="primary-button auth-submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Log In'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'forgot' ? (
            <button
              onClick={() => {
                resetMessages()
                setMode('login')
              }}
            >
              ← Back to login
            </button>
          ) : mode === 'login' ? (
            <>
              Don't have an account?
              <button
                onClick={() => {
                  resetMessages()
                  setMode('signup')
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?
              <button
                onClick={() => {
                  resetMessages()
                  setMode('login')
                }}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Auth