/**
 * Per-user credential service for the Massai hosted link.
 *
 * Each visitor's DeepSeek API key is stored as a per-user record in DSH's own
 * credential vault (`CredentialKey("massai-user", <userId>)`), so a shared host
 * never uses one user's key for another. This is the credential-side foundation;
 * wiring `deepseek-auth` / `llm-deepseek-api-key` to resolve through it (with the
 * session's user id) is the integration step (see docs/HOSTED-AUTH.md).
 *
 * @module @deepseek-ai/dsh-user-credentials
 */

import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import { credentialKey, type CredentialKey } from '@deepseek-ai/dsh-credentials'

const SCOPE = 'massai-user'

export default class UserCredentialsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'userCredentials')
  }

  private key(userId: string): CredentialKey {
    return credentialKey(SCOPE, userId)
  }

  /** Store a visitor's DeepSeek API key (empty value clears it). */
  async signIn(userId: string, apiKey: string): Promise<void> {
    await this.ctx.credentials.modifyRecord(
      this.key(userId),
      async () => ({ kind: 'api-key', key: apiKey }),
    )
  }

  /** Resolve one visitor's stored key, or undefined when they haven't signed in. */
  async resolveFor(userId: string): Promise<string | undefined> {
    const record = await this.ctx.credentials.readRecord(this.key(userId))
    return record?.kind === 'api-key' ? record.key : undefined
  }

  /** Remove a visitor's stored key. */
  async signOut(userId: string): Promise<void> {
    await this.ctx.credentials.deleteRecord(this.key(userId))
  }
}
