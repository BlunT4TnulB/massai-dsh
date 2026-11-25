import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace'
import type { ConversationContentProps, ConversationViewsProps, InputZone } from '../contract/slots.ts'
import { HeroShell, WorkspaceChip, workspaceLabel } from './EmptyHero.tsx'
import css from './ConversationRoot.module.css'

function ConversationSessionView({ renderSlot }: ConversationViewsProps) {
  return renderSlot('conversation.session', {})
}

function NoConversationWidthControls() {
  return null
}

/**
 * Render the shared Conversation body and its occurrence-selected local Components.
 * @param props - Factory input, standard Session sources, and Conversation seats.
 * @returns the Conversation view, Composer, and optional width controls.
 */

/**
 * The corner: one small mark in the top-left that opens everything.
 *
 * The immersion hides the chrome, which is right, but it must never hide the
 * exits. This is the single guaranteed way in: a slide-out with every surface the
 * deployment has, so no state of the mind can strand anybody.
 * @returns the corner button and its drawer.
 */
function CornerMenu() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const close = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close) }
  }, [open])
  // Categorised, because a drawer is only useful if a person can find the door
  // they meant without reading all of them.
  const groups: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
    ['Make', [['New conversation', '/'], ['The workshop', '/access'], ['Projects', '/projects']]],
    ['Wander', [['The mind', '/flower'], ['The welcome page', '/welcome'], ['Map', '/map'], ['Library', '/library']]],
    ['Understand', [['Limits', '/limits'], ['Guide', '/guide'], ['Support', '/support']]],
    ['Yours', [['You', '/me'], ['Settings', '/settings'], ['Operator', '/admin']]],
  ]
  return (
    <>
      <button
        type="button"
        className={css.corner}
        aria-label="Open the menu"
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value) }}
      >
        <span className={css.cornerDot} />
      </button>
      {open && (
        <div className={css.drawerWrap}>
          <button type="button" className={css.drawerBackdrop} aria-label="Close the menu" onClick={() => { setOpen(false) }} />
          <nav className={css.drawer} aria-label="Everything">
            <p className={css.drawerTitle}>Massai</p>
            {groups.map(([group, items]) => (
              <div key={group} className={css.drawerGroup}>
                <p className={css.drawerGroupTitle}>{group}</p>
                {items.map(([label, href]) => (
                  <a key={href} className={css.drawerLink} href={href}>{label}</a>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}

export function ConversationContent(props: ConversationContentProps) {
  const {
    sessionId, phase, hero, useSession, useSessions, useSessionStatus,
    useWorkspaces, useInput, useComposerBlock, renderSlot, renderSlotChain,
    selectWorkspace, t, useFactorySlot,
  } = props
  const session = useSession(snapshot => snapshot)
  const Views = useFactorySlot('views', ConversationSessionView)
  const WidthControls = useFactorySlot('widthControls', NoConversationWidthControls)
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  const pendingInteraction = useSessionStatus(snapshot =>
    sessionId === undefined ? undefined : snapshot.get(sessionId)?.pendingInteraction)
  const inputState = useInput(s => s)
  const cwd = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.cwd)
  const workspaces = useWorkspaces(s => s)
  // A plugin this package cannot import (ui-model-selection) says this session cannot
  // send; its reason is already localized by whoever raised it.
  const composerBlock = useComposerBlock(block => block)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<WorkspaceId | undefined>()
  const pickerAnchor = useRef<HTMLButtonElement>(null)

  // Publishes the two live measurements floating View chrome reads off the
  // scroll body: the seat's height as --dsh-composer-height, so controls clear
  // the composer as it grows, and the scrollport's own height as
  // --dsh-conversation-viewport-height, so a control can sit in the band the
  // seat leaves visible. Callback ref, not an effect; stable identity prevents
  // observer churn while the first blank session fills the resident body
  // outlet.
  const seatObserver = useRef<ResizeObserver | null>(null)
  const seatResizeRef = useCallback((seat: HTMLDivElement | null): void => {
    seatObserver.current?.disconnect()
    seatObserver.current = null
    const scroller = seat?.parentElement ?? null
    if (seat === null || scroller === null) return
    seatObserver.current = new ResizeObserver(() => {
      scroller.style.setProperty('--dsh-composer-height', `${seat.offsetHeight}px`)
      scroller.style.setProperty(
        '--dsh-conversation-viewport-height',
        `${scroller.clientHeight}px`,
      )
    })
    seatObserver.current.observe(seat)
    seatObserver.current.observe(scroller)
  }, [])

  const sessionWorkspace = sessionId === undefined
    ? undefined
    : workspaces.items.find(workspace => workspace.sessionIds.includes(sessionId))
  const pendingWorkspace = workspaces.items.find(
    workspace => workspace.workspaceId === pendingWorkspaceId,
  )

  // Clear the pending pick once the session lands in it, or when the picked
  // workspace disappears from a ready list (deleted from the sidebar).
  useEffect(() => {
    if (pendingWorkspaceId === undefined) return
    if (sessionWorkspace?.workspaceId === pendingWorkspaceId
      || (workspaces.phase === 'ready' && pendingWorkspace === undefined)) {
      setPendingWorkspaceId(undefined)
    }
  }, [pendingWorkspaceId, sessionWorkspace?.workspaceId, workspaces.phase, pendingWorkspace])

  const zone: InputZone | undefined =
    session === undefined || inputState === undefined ? undefined : { session, input: inputState }

  // The chip is a selector; label resolution walks the flow top-down:
  //   1. a just-picked workspace (pending) → its title;
  //   2. cold start, no session yet → placeholder ("Choose workspace");
  //   3. the blank session's workspace is in the list → its title;
  //   4. list still loading → cwd folder name bridges so the title does not
  //      flash on refresh (empty cwd → placeholder);
  //   5. list ready but no owning workspace (deleted from the sidebar) →
  //      placeholder, never the deleted folder's name via cwd.
  // A title still automatic reads in the reader's language, matching the
  // sidebar row the same Workspace has there.
  const storedChipTitle = pendingWorkspace?.title
    ?? (sessionId === undefined
      ? undefined
      : sessionWorkspace?.title
        ?? (workspaces.phase === 'ready' || cwd === undefined || cwd === ''
          ? undefined
          : workspaceLabel(cwd)))
  const chipTitle = storedChipTitle === undefined
    ? undefined
    : workspaceDisplayTitle(storedChipTitle, t('workspace.defaultName'))

  const heroWorkspaceRow = (
    <div className={css.heroWorkspaceRow}>
      <WorkspaceChip
        buttonRef={pickerAnchor}
        label={chipTitle}
        menuOpen={pickerOpen}
        onClick={() => { setPickerOpen(open => !open) }}
        t={t}
      />
      {renderSlot('conversation.hero.workspace', {
        open: pickerOpen,
        anchorRef: pickerAnchor,
        selectedId: pendingWorkspaceId ?? sessionWorkspace?.workspaceId,
        onPick: (workspaceId) => {
          setPickerOpen(false)
          setPendingWorkspaceId(workspaceId)
          void selectWorkspace(workspaceId).catch(() => {
            setPendingWorkspaceId(current => current === workspaceId ? undefined : current)
          })
        },
        onClose: () => { setPickerOpen(false) },
      })}
      {renderSlot('conversation.hero.agentPreset', {})}
      {sessionId === undefined ? null : <div className={css.heroOptions}>{renderSlot('conversation.hero.options', {})}</div>}
    </div>
  )

  // The placeholder chip ("Choose workspace") and the Workspace-trigger input travel
  // together: no workspace picked yet (cold start, no session at all), or a
  // blank session whose workspace vanished (deleted from the sidebar). The
  // bar is ONE session-maybe slot rendered unconditionally — inert is a prop,
  // not a different tree, so the textarea DOM survives the transition.
  const inert = sessionId === undefined || (hero && chipTitle === undefined)
  // A raised block is the same inert posture with the blocker's own reason:
  // one disabled textarea, never a second tree. The no-workspace state wins
  // when both hold — picking a workspace is the earlier prerequisite.
  const blocked = !inert && composerBlock !== undefined
  const inputBar = renderSlot('conversation.composer.bar', {
    variant: hero ? 'hero' : 'composer',
    occurrence: props.variant,
    ...(inert
      ? {
        disabled: true,
        placeholder: t('placeholder.workspace'),
        workspacePickerOpen: pickerOpen,
        onRequestWorkspace: () => { setPickerOpen(true) },
      }
      : blocked
        // `blocked`, not `disabled`: the bar refuses input either way, but a
        // block keeps the model seat live because choosing a model is how the
        // user clears it.
        ? { blocked: composerBlock, placeholder: composerBlock.reason }
        : hero ? { placeholder: t('placeholder.hero') } : {}),
  })

  // The galaxy hides one door among its stars. When it is found, the frame posts
  // one message and the composer appears — before that, the mind IS the screen.
  const [entered, setEntered] = useState(false)
  // Nobody is ever trapped in the mind: after a while a quiet way in appears,
  // and Enter always works. The door is an invitation, not a lock.
  const [nudged, setNudged] = useState(false)
  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      const data = event.data as { type?: unknown } | null
      if (data !== null && typeof data === 'object' && data.type === 'massai:enter') setEntered(true)
    }
    window.addEventListener('message', receive)
    return () => { window.removeEventListener('message', receive) }
  }, [])
  useEffect(() => {
    if (!hero || entered) return undefined
    const timer = window.setTimeout(() => { setNudged(true) }, 22000)
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) setEntered(true)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey) }
  }, [hero, entered])

  const wayIn = hero && !entered && nudged ? (
    <button type="button" className={css.wayIn} onClick={() => { setEntered(true) }}>
      the ring is the door — or open the workshop
    </button>
  ) : null

  const composerBar = (
    <div
      className={clsx(css.composerStack, hero && css.composerHero)}
      data-enter-gate={hero && !entered ? 'closed' : 'open'}
    >
      {hero && <HeroShell t={t} renderSlot={renderSlot} />}
      {hero && heroWorkspaceRow}
      {zone !== undefined && renderSlot('conversation.input.dock', zone)}
      {inputBar}
    </div>
  )

  const composer = renderSlotChain(
    'conversation.composer',
    { sessionId, session, pendingInteraction },
    { fallback: composerBar, fallbackOnly: sessionId === undefined, overlay: true },
  )

  // Sticky wraps the whole chain output (fallback + elected overlay), not
  // only `.composerStack`: overlay:true renders those as siblings, and sticky
  // on the fallback alone would leave a business-owned takeover at the content
  // end off-screen when the user is not pinned to the floor.
  const composerSeat = (
    <div ref={seatResizeRef} className={css.composerSeat} data-composer-seat="" data-conversation-region="composer">
      {composer}
    </div>
  )

  return (
    <div
      ref={setBody}
      className={clsx(css.body, props.variant === 'embedded' && css.embeddedBody)}
      data-conversation-content=""
      data-conversation-session={sessionId}
      data-conversation-region="chat"
      data-content-phase={phase}
    >
      {/* The frame wraps the scroll body in every phase, so leaving the home keeps the composer mounted. */}
      <CornerMenu />
      {wayIn}
      {renderSlot('conversation.hero.frame', { hero: hero && props.variant !== 'embedded' }, {
        children: (
          <div className={css.scrollBody} data-conversation-scroll="">
            {sessionId === undefined ? null : <Views />}
            {composerSeat}
          </div>
        ),
      })}
      <WidthControls container={body} phase={phase} />
    </div>
  )
}
