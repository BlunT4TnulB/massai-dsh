// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'
import {
  IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { ConversationContentProps } from '../contract/slots.ts'
import { LiveActivity } from './LiveActivity.tsx'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationContentProps['t']

/**
 * Basename label for the workspace chip (the shared derivation);
 * separator-only paths echo the raw cwd.
 * @param cwd - workspace directory path (non-empty).
 * @returns chip label.
 */
export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/**
 * The workspace chip (folder + label + chevron), always interactive: before
 * the first message the workspace stays switchable — picking another one
 * moves the New Session flow to that workspace's blank session. Without a
 * label the chip renders its placeholder state: closed folder + the
 * "Choose workspace" call to action.
 * @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
 * @param props.menuOpen - menu expansion echo.
 * @param props.onClick - menu toggle.
 * @returns the chip button element.
 */
export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderCloseRegular className={css.folder} size={16} />
        : <IconFolderOpenRegular className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutlineRegular className={css.chevron} size={12} />
    </button>
  )
}

/** Hero chrome props. The workspace row rides the InputBar accessory hole, not here. */
export interface HeroShellProps {
  /** The owner's locale seat, passed down as a plain prop. */
  t: HeroTranslate
  /** Authorized renderer for the hero brand-mark slot. */
  renderSlot: ConversationContentProps['renderSlot']
  /** Overlay content after the stack (modals). */
  children?: ReactNode
}


/** The nineteen points of a flower of life: seven centres, twelve intersections. */
const FLOWER_POINTS: ReadonlyArray<readonly [number, number]> = [
  [24, 24], [33, 24], [28.5, 31.79], [19.5, 31.79], [15, 24], [19.5, 16.21], [28.5, 16.21],
  [24, 9.4], [24, 38.6], [9.4, 24], [38.6, 24],
  [33, 18.8], [33, 29.2], [15, 18.8], [15, 29.2],
  [19.5, 9.4], [28.5, 9.4], [19.5, 38.6], [28.5, 38.6],
]

/**
 * The brand mark as a physical object: a flower of life that turns.
 *
 * One SVG inside a perspective stage. Dragging rotates it on two axes, the way a
 * hand turns a medallion; letting go eases it back into a slow idle turn. Every
 * intersection is a real dot, so the geometry reads as constructed rather than
 * decorative — and the points are hoverable, which is the hook if they ever need
 * to mean something.
 *
 * Motion is refused under `prefers-reduced-motion`: the same mark, still, with
 * the dots still present.
 * @param props.size - rendered edge length in pixels.
 * @returns the stage element tree.
 */
function FlowerMark({ size }: { size: number }) {
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, x: 0, y: 0, rx: -12, ry: 18 })
  const [dragging, setDragging] = useState(false)

  /** Paint the current rotation onto the stage. */
  const paint = (): void => {
    const node = stage.current
    if (node === null) return
    const { rx, ry } = drag.current
    node.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
  }

  useEffect(() => {
    paint()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min(64, now - last)
      last = now
      // A hidden tab draws nothing: the mark is decoration, and a phone in a
      // pocket should not pay for it.
      if (document.visibilityState === 'hidden') {
        raf = requestAnimationFrame(tick)
        return
      }
      if (!drag.current.active) {
        // Idle: one slow axis, with the tilt easing home.
        drag.current.ry = (drag.current.ry + dt * 0.012) % 360
        drag.current.rx += (-12 - drag.current.rx) * 0.02
        paint()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf) }
  }, [])

  return (
    <div
      className={css.markStage}
      style={{ width: size, height: size }}
      onPointerDown={(event) => {
        drag.current.active = true
        drag.current.x = event.clientX
        drag.current.y = event.clientY
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current.active) return
        drag.current.ry += (event.clientX - drag.current.x) * 1.1
        drag.current.rx = Math.max(-80, Math.min(80, drag.current.rx - (event.clientY - drag.current.y) * 0.9))
        drag.current.x = event.clientX
        drag.current.y = event.clientY
        paint()
      }}
      onPointerUp={() => { drag.current.active = false; setDragging(false) }}
      onPointerCancel={() => { drag.current.active = false; setDragging(false) }}
      aria-hidden="true"
      data-dragging={dragging ? 'true' : 'false'}
    >
      <div ref={stage} className={css.markObject}>
        <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor">
          <circle cx="24" cy="24" r="22" strokeWidth="1.6" opacity="0.95" />
          <circle cx="24" cy="24" r="9" strokeWidth="1.3" />
          <circle cx="33" cy="24" r="9" strokeWidth="1.3" />
          <circle cx="28.5" cy="31.79" r="9" strokeWidth="1.3" />
          <circle cx="19.5" cy="31.79" r="9" strokeWidth="1.3" />
          <circle cx="15" cy="24" r="9" strokeWidth="1.3" />
          <circle cx="19.5" cy="16.21" r="9" strokeWidth="1.3" />
          <circle cx="28.5" cy="16.21" r="9" strokeWidth="1.3" />
          {FLOWER_POINTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.85" className={css.markPoint} stroke="none" />
          ))}
        </svg>
      </div>
    </div>
  )
}



/**
 * The sanctum as a stage: the live flower embedded in the blank state.
 *
 * The mark at 96 pixels was a logo. This is the room: a same-origin frame of
 * `/flower?embed=1` (chrome hidden, object fitted to the frame), cropped to a
 * circle so it reads as a portal rather than an embedded page. It is deliberately
 * the largest thing on an empty conversation — the composer is where you type,
 * but this is what the place looks like before you do.
 *
 * On narrow screens the frame is dropped for the SVG mark: a full canvas inside a
 * phone's chat view costs more than it gives, and the small mark still turns.
 * @param props.size - rendered edge length in pixels.
 * @returns the stage element tree.
 */
/**
 * The galaxy as the whole room: a fixed, full-viewport frame behind everything.
 *
 * When the conversation is empty there is nothing more important than the living
 * sphere, so it becomes the backdrop and the composer floats over it. It is
 * mounted through a portal to the document body so no transformed ancestor can
 * trap it, and it stays `pointer-events: none` — presence, never a control.
 * @returns the fixed frame, or null when the viewport cannot carry it.
 */
function GalaxyBackground({ show }: { show: boolean }) {
  if (!show || typeof document === 'undefined') return null
  return createPortal(
    <div className={css.galaxyBg} aria-hidden="true">
      <iframe
        className={css.galaxyFrame}
        src="/flower?embed=1"
        title="The Massai galaxy"
        loading="eager"
        tabIndex={-1}
        scrolling="no"
      />
      <span className={css.galaxyScrim} />
    </div>,
    document.body,
  )
}

/**
 * Whether to mount the live stage at all.
 * @returns true when the viewport can carry the frame.
 */
function stageFits(): boolean {
  return window.innerWidth >= 320
}

/**
 * Render the hero chrome (headline only; no composer, no workspace row).
 * @param props - see {@link HeroShellProps}.
 * @returns the centered hero element tree.
 */
export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? false : stageFits()))
  useEffect(() => {
    const measure = (): void => { setWide(stageFits()) }
    measure()
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('resize', measure) }
  }, [])
  return (
    <div className={css.root}>
      <div className={css.stack}>
        {/* The sanctum sits above the words: the place, before anything is said.
            The small turnable mark is the fallback when the viewport cannot carry
            the full stage comfortably. */}
        {wide && <GalaxyBackground show={wide} />}
        <div className={css.markRow} data-wide={wide ? 'true' : 'false'}>
          {wide
            ? <span className={css.galaxyLabel}>the galaxy, breathing</span>
            : renderSlot('conversation.hero.brand.mark', { size: 96, className: css.mark }, {
                fallback: <FlowerMark size={96} />,
              })}
          <LiveActivity />
        </div>
        <div className={css.headline}>
          <span className={css.titleGroup}>
            {/* Own element: keeps the headline text addressable apart from the badge. */}
            <span>{t('hero.headline')}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
