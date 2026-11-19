/**
 * Quickstart deep links: `?prompt=<text>` opens a fresh conversation with that
 * request already in the composer, so a guided card is one click from building.
 * The parameter is consumed and stripped so a refresh never queues it twice.
 *
 * @module @deepseek-ai/dsh-client-ui-quickstart/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'

export const inject = ['@deepseek-ai/dsh-client-ui-workspace']

export function apply(ctx: ClientContext): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return
  if (ctx.uiWorkspace === undefined) return
  const params = new URLSearchParams(location.search)
  const prompt = params.get('prompt')?.trim() ?? ''
  if (prompt === '') return
  ctx.uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'append' })
  params.delete('prompt')
  const query = params.toString()
  history.replaceState(null, '', `${location.pathname}${query === '' ? '' : `?${query}`}${location.hash}`)
}
