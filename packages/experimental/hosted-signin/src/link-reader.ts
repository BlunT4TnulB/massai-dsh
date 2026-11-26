/**
 * Read a shared conversation from a link.
 *
 * People paste Gemini share links into a chat expecting the agent to read them. A
 * browser can render those pages; a model cannot — the words live inside the page's
 * own JavaScript payload. So the host fetches the link, pulls the conversation out,
 * and hands the model plain text before the step begins.
 *
 * Everything here treats fetched content as DATA, never as instructions. A shared
 * conversation can contain anything, including text that looks like a command; the
 * note wrapped around it says so explicitly.
 *
 * @module @deepseek-ai/dsh-hosted-signin/link-reader
 */

import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

/** One extracted conversation turn. */
export interface ReadTurn {
  /** Who spoke. */
  readonly role: 'user' | 'assistant' | 'unknown'
  /** What they said, as plain text. */
  readonly text: string
}

/** The result of reading a link. */
export interface ReadLink {
  /** The URL that was fetched (after redirects, when the fetch exposed it). */
  readonly url: string
  /** Page title, when one could be found. */
  readonly title: string
  /** The conversation, when the page held one. */
  readonly turns: ReadTurn[]
  /** Plain text of the page, conversation or not. */
  readonly text: string
  /** True when the extraction found something a model can actually use. */
  readonly readable: boolean
  /** Why it was not readable, when it was not. */
  readonly reason?: string
}

/** Hosts whose share pages are worth parsing as conversations. */
const CONVERSATION_HOSTS = [
  'gemini.google.com',
  'g.co',
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'copilot.microsoft.com',
  'perplexity.ai',
]

/** The most a single link may contribute to one step, in characters. */
export const LINK_TEXT_LIMIT = 8000

/** Fetch budget for a link: a share page is small, so this is generous but bounded. */
const FETCH_TIMEOUT_MS = 12_000

/** Gemini answers with headers far past Node's 16 KB default; give it room. */
const MAX_HEADER_BYTES = 128 * 1024

/** Bytes of HTML we are willing to hold. */
const MAX_BYTES = 4_000_000

/**
 * Whether a host resolves to somewhere a server must not fetch: localhost, link-local,
 * or a private range. The check is on the literal host so it cannot be fooled by DNS,
 * which is the honest limit of a guard like this.
 * @param host - the hostname from the URL.
 * @returns true when the target is off limits.
 */
function isBlockedHost(host: string): boolean {
  const name = host.toLowerCase()
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.internal')) return true
  if (name === '0.0.0.0' || name === '[::1]' || name === '::1') return true
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name)
  if (v4 !== null) {
    const octets = v4.slice(1).map(part => Number(part))
    const [a = 0, b = 0] = octets
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }
  return false
}

/**
 * Whether a host is one whose pages usually hold a shared conversation.
 * @param host - the hostname from the URL.
 * @returns true for a known conversation host.
 */
export function isConversationHost(host: string): boolean {
  const name = host.toLowerCase()
  return CONVERSATION_HOSTS.some(known => name === known || name.endsWith('.' + known))
}

/**
 * Every http(s) URL in a piece of text, in order, without duplicates.
 * @param text - the user's message.
 * @returns the URLs found.
 */
export function urlsIn(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'()]+/g) ?? []
  const cleaned = found.map(url => url.replace(/[.,;:!?)\]]+$/, ''))
  return [...new Set(cleaned)]
}

/**
 * Strip a page down to readable text.
 * @param html - the raw document.
 * @returns visible text with whitespace collapsed.
 */
function visibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Pull conversation turns out of a page's embedded data payloads.
 *
 * Gemini and the others embed their state as JSON inside `AF_initDataCallback({…})`
 * or `window.WIZ_global_data`-style blobs. The exact schema is undocumented and moves,
 * so this walks every embedded JSON array it can find and accepts strings that look
 * like conversation turns, in document order. Imperfect, honest, and far better than
 * nothing when the visible text is empty.
 * @param html - the raw document.
 * @returns the turns found, in order.
 */
function embeddedTurns(html: string): ReadTurn[] {
  const turns: ReadTurn[] = []
  const payloads = [
    ...html.matchAll(/AF_initDataCallback\(\s*\{[\s\S]*?data\s*:\s*(\[[\s\S]*?\])\s*,\s*(?:sideChannel|hash)/g),
    ...html.matchAll(/"conversation"\s*:\s*(\[[\s\S]*?\])\s*[,}]/g),
  ]
  for (const payload of payloads) {
    const raw = payload[1]
    if (raw === undefined) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const walk = (value: unknown, depth: number): void => {
      if (depth > 12 || turns.length > 400) return
      if (typeof value === 'string') {
        const text = value.trim()
        // A turn is prose, not an id, a mime type, or a URL.
        if (text.length >= 24 && /\s/.test(text) && !/^https?:\/\//.test(text) && !/^[a-f0-9-]{20,}$/i.test(text)) {
          turns.push({ role: 'unknown', text })
        }
        return
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1)
        return
      }
      if (typeof value === 'object' && value !== null) {
        for (const item of Object.values(value)) walk(item, depth + 1)
      }
    }
    walk(parsed, 0)
  }
  // De-duplicate consecutive repeats, which the walk above produces in abundance.
  return turns.filter((turn, index) => index === 0 || turn.text !== turns[index - 1]?.text)
}

/**
 * One HTML GET, with the header ceiling raised and redirects followed by hand.
 * @param url - the target.
 * @param redirectsLeft - how many hops remain.
 * @returns status, final URL, and the body text.
 */
async function getPage(url: URL, redirectsLeft = 5): Promise<{ status: number; url: string; body: string }> {
  if (isBlockedHost(url.hostname)) throw new Error('that host is not readable from the server')
  const requester = url.protocol === 'http:' ? httpRequest : httpsRequest
  return await new Promise((resolve, reject) => {
    const request = requester({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port === '' ? undefined : Number(url.port),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      maxHeaderSize: MAX_HEADER_BYTES,
      headers: {
        // A browser-ish identity: share pages answer plain fetchers with a shell.
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en',
        'accept-encoding': 'identity',
      },
    }, response => {
      const status = response.statusCode ?? 0
      const location = response.headers.location
      if (status >= 300 && status < 400 && typeof location === 'string' && redirectsLeft > 0) {
        response.resume()
        let next: URL
        try { next = new URL(location, url) } catch { resolve({ status, url: url.href, body: '' }); return }
        void getPage(next, redirectsLeft - 1).then(resolve, reject)
        return
      }
      const declared = Number(response.headers['content-length'] ?? '0')
      if (declared > MAX_BYTES) {
        response.resume()
        resolve({ status, url: url.href, body: '' })
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) { response.destroy(); return }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({ status, url: url.href, body: Buffer.concat(chunks).toString('utf8') }))
      response.on('error', reject)
    })
    request.setTimeout(FETCH_TIMEOUT_MS, () => { request.destroy(new Error('the page took too long')) })
    request.on('error', reject)
    request.end()
  })
}

/**
 * Fetch a link and read it.
 * @param url - an http(s) URL.
 * @returns what could be read, and whether it is usable.
 */
export async function readLink(url: string): Promise<ReadLink> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { url, title: '', turns: [], text: '', readable: false, reason: 'that is not a URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { url, title: '', turns: [], text: '', readable: false, reason: 'only http and https can be read' }
  }
  if (isBlockedHost(parsed.hostname)) {
    return { url, title: '', turns: [], text: '', readable: false, reason: 'that host is not readable from the server' }
  }
  try {
    const page = await getPage(parsed)
    if (page.status < 200 || page.status >= 300) {
      return { url, title: '', turns: [], text: '', readable: false, reason: `the page answered ${page.status}` }
    }
    const html = page.body.slice(0, MAX_BYTES)
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
    const turns = embeddedTurns(html)
    const text = turns.length > 0
      ? turns.map((turn, index) => `turn ${index + 1}: ${turn.text}`).join('\n\n').slice(0, LINK_TEXT_LIMIT)
      : visibleText(html).slice(0, LINK_TEXT_LIMIT)
    const readable = text.length >= 120
    return {
      url: page.url,
      title,
      turns,
      text,
      readable,
      ...(readable ? {} : { reason: 'the page carried no readable conversation — it may need a sign-in, or the share may be private' }),
    }
  } catch (error) {
    return {
      url,
      title: '',
      turns: [],
      text: '',
      readable: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
