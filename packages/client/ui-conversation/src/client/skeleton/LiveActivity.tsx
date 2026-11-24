/** The workshop's live pulse: a small flower in the header that follows the work. */
import { useEffect, useState } from 'react'
import css from './ConversationRoot.module.css'

/** What the server says is happening, if anything. */
interface ActivityFocus {
  /** A capability id from the skill catalog. */
  readonly skill: string
  /** A few words for the caption. */
  readonly label: string
}

/**
 * Poll the activity endpoint while the tab is visible.
 *
 * The poll is deliberately slow: this is a mood indicator, not telemetry. A
 * failed request leaves the widget silent rather than broken — the app must not
 * care whether the flower knows what is happening.
 * @returns the current focus, or undefined when nothing is happening.
 */
function useActivity(): ActivityFocus | undefined {
  const [focus, setFocus] = useState<ActivityFocus | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const poll = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch('/api/one-turn/activity', { headers: { accept: 'application/json' } })
        if (!response.ok) return
        const data = await response.json() as { focus?: ActivityFocus | null }
        if (!cancelled) setFocus(data.focus ?? undefined)
      } catch {
        /* silence is correct: this is decoration, not function */
      }
    }
    const loop = (): void => {
      timer = window.setTimeout(() => { void poll().then(loop) }, 4000)
    }
    void poll().then(loop)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])
  return focus
}

/** The categories, as short words for a narrow header. */
const SHORT: Record<string, string> = {
  geometry: 'geometry',
  dashboard: 'data',
  'web-app': 'interface',
  scripting: 'script',
  testing: 'checks',
  docs: 'document',
  scanner: 'scanner',
  service: 'service',
  general: 'build',
}

/**
 * The live mark: a tiny flower that breathes while the workshop is working, with
 * the capability as one word beside it. Renders nothing at all when idle.
 * @returns the pulse element, or null.
 */
export function LiveActivity() {
  const focus = useActivity()
  if (focus === undefined) return null
  const word = SHORT[focus.skill] ?? 'build'
  return (
    <span className={css.liveActivity} title={focus.label} role="status" aria-live="polite">
      <svg width="16" height="16" viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="24" cy="24" r="9" strokeWidth="2.4" />
        <circle cx="33" cy="24" r="9" strokeWidth="2.4" />
        <circle cx="28.5" cy="31.79" r="9" strokeWidth="2.4" />
        <circle cx="19.5" cy="31.79" r="9" strokeWidth="2.4" />
        <circle cx="15" cy="24" r="9" strokeWidth="2.4" />
        <circle cx="19.5" cy="16.21" r="9" strokeWidth="2.4" />
        <circle cx="28.5" cy="16.21" r="9" strokeWidth="2.4" />
      </svg>
      <span className={css.liveWord}>{word}</span>
    </span>
  )
}
