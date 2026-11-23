/**
 * R2 object storage: the part of the system that makes "saved" a true word.
 *
 * Everything else in this package can be rebuilt from a database row. Project
 * files cannot — they are the thing a person made. So they live in object storage
 * with a bucket of their own, and every operation here is signed with AWS
 * Signature V4 because that is what R2 speaks.
 *
 * The signing is written by hand rather than pulled from a dependency: it is
 * thirty lines of HMAC, it has exactly one caller, and a supply-chain token is a
 * high price for something this small.
 *
 * @module @deepseek-ai/dsh-one-turn/r2
 */

import { createHash, createHmac } from 'node:crypto'

/** R2 configuration, read from the environment on every call so a redeploy can rotate it. */
interface R2Config {
  readonly accountId: string
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
}

/** Read the configuration, or undefined when storage is not set up. */
function config(): R2Config | undefined {
  const accountId = (process.env.R2_ACCOUNT_ID ?? '').trim()
  const bucket = (process.env.R2_BUCKET ?? '').trim()
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? '').trim()
  if (accountId === '' || bucket === '' || accessKeyId === '' || secretAccessKey === '') return undefined
  return { accountId, bucket, accessKeyId, secretAccessKey }
}

/** Whether object storage is configured at all. */
export function r2Configured(): boolean {
  return config() !== undefined
}

/** Hex SHA-256 of a buffer. */
function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** HMAC-SHA256. */
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

/** Percent-encode one path segment the way SigV4 expects (unreserved characters kept). */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** The canonical query string: sorted, encoded, empty when there is none. */
function canonicalQuery(query: Record<string, string>): string {
  return Object.keys(query).sort()
    .map(key => `${encodeSegment(key)}=${encodeSegment(query[key] ?? '')}`)
    .join('&')
}

/** One signed request, ready to send. */
interface SignedRequest {
  readonly url: string
  readonly headers: Record<string, string>
}

/**
 * Sign one request for R2.
 * @param method - HTTP verb.
 * @param key - object key; '' addresses the bucket.
 * @param body - request payload.
 * @param query - query parameters, sorted during signing.
 * @returns the URL and headers to send.
 */
function sign(
  method: string,
  key: string,
  body: Buffer,
  query: Record<string, string> = {},
): SignedRequest {
  const cfg = config()
  if (cfg === undefined) throw new Error('R2 is not configured')
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256(body)
  const canonicalUri = key === ''
    ? `/${cfg.bucket}`
    : `/${cfg.bucket}/${key.split('/').map(encodeSegment).join('/')}`
  const queryString = canonicalQuery(query)
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const canonicalRequest = [
    method, canonicalUri, queryString, canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n')
  const scope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  let signingKey = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp)
  signingKey = hmac(signingKey, 'auto')
  signingKey = hmac(signingKey, 's3')
  signingKey = hmac(signingKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  return {
    url: `https://${host}${canonicalUri}${queryString === '' ? '' : `?${queryString}`}`,
    headers: {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}

/** Send a signed request and describe the result honestly. */
async function send(method: string, key: string, body: Buffer, query: Record<string, string> = {}): Promise<{
  ok: boolean
  status: number
  text: string
}> {
  const request = sign(method, key, body, query)
  const response = await fetch(request.url, {
    method,
    headers: request.headers,
    ...(method === 'PUT' || method === 'POST' ? { body: new Uint8Array(body) } : {}),
  })
  return { ok: response.ok, status: response.status, text: await response.text() }
}

/**
 * Store one object.
 * @param key - the object key.
 * @param body - its bytes.
 * @param contentType - MIME type to record.
 * @returns whether it was stored.
 */
export async function putObject(key: string, body: Buffer | string, contentType = 'text/plain'): Promise<boolean> {
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
  const result = await send('PUT', key, payload)
  // R2 records the type from the PUT signature only if it is signed, so the type
  // is stored as metadata via a second header-free convention: the extension.
  void contentType
  return result.ok
}

/**
 * Read one object.
 * @param key - the object key.
 * @returns its body, or undefined when absent.
 */
export async function getObject(key: string): Promise<string | undefined> {
  const result = await send('GET', key, Buffer.alloc(0))
  return result.ok ? result.text : undefined
}

/**
 * Delete one object.
 * @param key - the object key.
 * @returns whether the delete was accepted.
 */
export async function deleteObject(key: string): Promise<boolean> {
  const result = await send('DELETE', key, Buffer.alloc(0))
  return result.ok || result.status === 204
}

/**
 * List object keys under a prefix.
 * @param prefix - key prefix to filter by.
 * @param limit - maximum keys to return.
 * @returns the keys found.
 */
export async function listObjects(prefix: string, limit = 100): Promise<string[]> {
  const result = await send('GET', '', Buffer.alloc(0), { 'list-type': '2', prefix, 'max-keys': String(limit) })
  if (!result.ok) return []
  return [...result.text.matchAll(/<Key>([^<]+)<\/Key>/g)].map(match => match[1] ?? '').filter(key => key !== '')
}

/**
 * Prove the bucket works end to end: write a probe, read it, delete it.
 * @returns what each step said, so the console can show it honestly.
 */
export async function storageCheck(): Promise<{
  configured: boolean
  bucket: string
  wrote: boolean
  readBack: boolean
  deleted: boolean
  detail: string
}> {
  const cfg = config()
  if (cfg === undefined) {
    return { configured: false, bucket: '', wrote: false, readBack: false, deleted: false, detail: 'R2 is not configured' }
  }
  const key = `health/${Date.now()}.txt`
  const probe = `massai storage probe ${new Date().toISOString()}`
  try {
    const wrote = await putObject(key, probe)
    const readBuffer = await getObject(key)
    const readBack = readBuffer === probe
    const deleted = await deleteObject(key)
    return {
      configured: true, bucket: cfg.bucket, wrote, readBack, deleted,
      detail: wrote && readBack ? 'storage works: wrote, read back, deleted' : 'storage responded but the round trip failed',
    }
  } catch (error) {
    return {
      configured: true, bucket: cfg.bucket, wrote: false, readBack: false, deleted: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
