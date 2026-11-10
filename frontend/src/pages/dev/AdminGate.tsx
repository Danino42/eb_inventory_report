import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { checkAdminPin } from '../../api/admin'
import { ApiError, setAdminPin } from '../../api/client'
import { useAdminText } from '../../i18n/adminText'
import './AdminGate.css'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** The Verwaltung opens only with the PIN; both tabs stay open until ‹ Start or a reload. */
export function AdminGate() {
  const [unlocked, setUnlocked] = useState(false)

  // Leaving the Verwaltung locks it again
  useEffect(() => () => setAdminPin(null), [])

  if (unlocked) return <Outlet />
  return (
    <PinScreen
      onUnlock={(pin) => {
        // Sent with every request from now on: the server checks it for changes
        setAdminPin(pin)
        setUnlocked(true)
      }}
    />
  )
}

type Status = 'idle' | 'checking' | 'wrong' | 'offline'

function PinScreen({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const { t } = useAdminText()
  const [pin, setPin] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  // Counts wrong tries, so the dots shake again on every one
  const [wrongTries, setWrongTries] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function check(candidate: string) {
    setStatus('checking')
    try {
      await checkAdminPin(candidate)
      // Not if ‹ Start was tapped meanwhile (the server may take a minute to wake up)
      if (mounted.current) onUnlock(candidate)
    } catch (e) {
      setPin('')
      if (e instanceof ApiError && e.status === 401) {
        setStatus('wrong')
        setWrongTries((n) => n + 1)
      } else {
        setStatus('offline')
      }
    }
  }

  function press(digit: string) {
    if (status === 'checking' || pin.length >= PIN_LENGTH) return
    const next = pin + digit
    setPin(next)
    setStatus('idle')
    if (next.length === PIN_LENGTH) void check(next)
  }

  function erase() {
    if (status !== 'checking') setPin((p) => p.slice(0, -1))
  }

  // Keyboard on the laptop: digits and Backspace
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) press(e.key)
    else if (e.key === 'Backspace') erase()
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const busy = status === 'checking'
  const message = { idle: '', checking: t.checkingPin, wrong: t.wrongPin, offline: t.offline }[status]

  return (
    <div className="pin-page">
      <Link to="/" className="home-link">
        ‹ Start
      </Link>
      <main className={`pin${status === 'wrong' ? ' pin--wrong' : ''}`}>
        <h1>{t.adminTitle}</h1>
        <div key={wrongTries} className="pin__dots" aria-label={`PIN ${pin.length}/${PIN_LENGTH}`} role="img">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`pin__dot${i < pin.length ? ' is-filled' : ''}`} />
          ))}
        </div>
        <p
          className={`pin__message${status === 'wrong' || status === 'offline' ? ' is-error' : ''}`}
          role="status"
        >
          {message}
        </p>
        <div className="pin__keys">
          {KEYS.map((key) => (
            <button key={key} type="button" className="pin__key" disabled={busy} onClick={() => press(key)}>
              {key}
            </button>
          ))}
          <span />
          <button type="button" className="pin__key" disabled={busy} onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className="pin__key pin__key--erase"
            disabled={busy || !pin}
            onClick={erase}
            aria-label={t.eraseDigit}
          >
            ⌫
          </button>
        </div>
      </main>
    </div>
  )
}
