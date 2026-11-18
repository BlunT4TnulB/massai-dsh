/** Per-user DeepSeek key resolution: each user's key is used for them, never another user's. */
import { afterEach, describe, expect, it } from 'vitest'
import { disposeMounted, mount, request } from './harness.ts'

afterEach(disposeMounted)

const key = request({ billing: 'api-key' })

describe('per-user API key resolution (hosted link)', () => {
  it('resolves the key for the request user id, ignoring the global default', async () => {
    const ctx = await mount({ stored: { DEEPSEEK_API_KEY: 'sk-global' } })
    ctx.provide('userCredentials', {
      resolveFor: async (userId: string) => (userId === 'userA' ? 'sk-a' : userId === 'userB' ? 'sk-b' : undefined),
    })
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userA' }))?.headers).toEqual({ authorization: 'Bearer sk-a' })
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userB' }))?.headers).toEqual({ authorization: 'Bearer sk-b' })
  })

  it('isolates two users across repeated reads (no bleed)', async () => {
    const ctx = await mount({})
    const store = new Map<string, string>([['userA', 'sk-a'], ['userB', 'sk-b']])
    ctx.provide('userCredentials', {
      resolveFor: async (userId: string) => store.get(userId),
    })
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userA' }))?.headers.authorization).toBe('Bearer sk-a')
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userB' }))?.headers.authorization).toBe('Bearer sk-b')
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userA' }))?.headers.authorization).toBe('Bearer sk-a')
  })

  it('falls back to the global reference when no per-user key is stored', async () => {
    const ctx = await mount({ stored: { DEEPSEEK_API_KEY: 'sk-global' } })
    ctx.provide('userCredentials', { resolveFor: async () => undefined })
    expect((await ctx.deepseekAuth.authorize({ ...key, userId: 'userA' }))?.headers).toEqual({ authorization: 'Bearer sk-global' })
  })

  it('uses the global reference when no user id is supplied (unchanged local behavior)', async () => {
    const ctx = await mount({ stored: { DEEPSEEK_API_KEY: 'sk-global' } })
    expect((await ctx.deepseekAuth.authorize(key))?.headers).toEqual({ authorization: 'Bearer sk-global' })
  })
})
