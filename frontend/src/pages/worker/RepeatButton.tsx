import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  onStep: () => void
  disabled?: boolean
  className?: string
  'aria-label': string
  children: ReactNode
}

// Hold to repeat: one step right away, then after a pause faster and faster
const FIRST_DELAY_MS = 400
const START_INTERVAL_MS = 120
const MIN_INTERVAL_MS = 40

/** Button that keeps stepping while pressed (finger or mouse); keyboard Enter/Space steps once */
export function RepeatButton({ onStep, disabled, className, children, ...rest }: Props) {
  const timer = useRef<number | undefined>(undefined)
  // Always call the latest onStep, even from a timer started several renders ago
  const onStepRef = useRef(onStep)
  useEffect(() => {
    onStepRef.current = onStep
  })

  function stop() {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }

  function start() {
    stop()
    onStepRef.current()
    let interval = START_INTERVAL_MS
    const tick = () => {
      onStepRef.current()
      interval = Math.max(MIN_INTERVAL_MS, interval * 0.9)
      timer.current = window.setTimeout(tick, interval)
    }
    timer.current = window.setTimeout(tick, FIRST_DELAY_MS)
  }

  // A disabled button gets no pointerup (e.g. − reaching 0), so stop here too
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])
  useEffect(() => stop, [])

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={rest['aria-label']}
      onPointerDown={(e) => {
        if (e.button === 0) start()
      }}
      // Stops on release, when the finger starts scrolling (cancel) or the mouse slides off
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      // Pointer presses are handled above; click only for keyboard (detail 0 = no pointer)
      onClick={(e) => {
        if (e.detail === 0) onStepRef.current()
      }}
      // No long-press menu on tablets
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}
