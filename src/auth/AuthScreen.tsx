import React, { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { assignColor } from '../lib/utils'
import { playButtonClick, playJoinBoard } from '../lib/sounds'
import { NetworkCanvas } from './NetworkCanvas'

interface AuthScreenProps {
  onLogin: (userId: string, name: string, color: string) => void
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password required')
      return
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Name is required')
      return
    }
    setError('')
    setLoading(true)

    try {
      let userCredential
      if (mode === 'signup') {
        userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(userCredential.user, { displayName: name.trim() })
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), password)
      }

      const user = userCredential.user
      const displayName = user.displayName || name.trim() || email.split('@')[0]
      const color = assignColor(user.uid)

      playJoinBoard()
      sessionStorage.setItem('cb_userId', user.uid)
      sessionStorage.setItem('cb_userName', displayName)
      sessionStorage.setItem('cb_userColor', color)
      onLogin(user.uid, displayName, color)
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/email-already-in-use') setError('Email already in use')
      else if (code === 'auth/invalid-email') setError('Invalid email')
      else if (code === 'auth/weak-password') setError('Password must be 6+ characters')
      else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') setError('Invalid email or password')
      else if (code === 'auth/wrong-password') setError('Invalid email or password')
      else setError(err?.message || 'Authentication failed')
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="auth-screen">
      <NetworkCanvas />
      <div className="auth-content">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="4" width="40" height="40" rx="8" stroke="#89b4fa" strokeWidth="2.5" />
            <rect x="12" y="12" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.6" />
            <rect x="26" y="12" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.4" />
            <rect x="12" y="26" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.4" />
            <rect x="26" y="26" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.8" />
            <line x1="22" y1="17" x2="26" y2="17" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="17" y1="22" x2="17" y2="26" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="31" y1="22" x2="31" y2="26" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="22" y1="31" x2="26" y2="31" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </div>
        <h1>Masterboard</h1>
        <p>Real-time collaborative whiteboard</p>
        <div className="auth-form">
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              onKeyDown={handleKeyDown}
              onFocus={playButtonClick}
              autoFocus
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            onKeyDown={handleKeyDown}
            onFocus={playButtonClick}
            autoFocus={mode === 'login'}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            onKeyDown={handleKeyDown}
            onFocus={playButtonClick}
          />
          {error && <div className="auth-error">{error}</div>}
          <button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
        <div className="auth-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { playButtonClick(); setMode('signup'); setError('') }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { playButtonClick(); setMode('login'); setError('') }}>Sign in</button></>
          )}
        </div>
        <div className="auth-footer">
          Collaborate in real-time with AI assistance
        </div>
      </div>
    </div>
  )
}
