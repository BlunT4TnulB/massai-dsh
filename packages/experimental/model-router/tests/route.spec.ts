import { describe, expect, it } from 'vitest'
import { route } from '@deepseek-ai/dsh-model-router'

describe('route', () => {
  it('routes simple tasks to the cheap model', () => {
    expect(route('add a comment').model).toBe('deepseek-flash')
  })

  it('escalates complex tasks to the quality model', () => {
    expect(route('refactor the auth module').model).toBe('deepseek-v4-pro')
  })

  it('escalates long tasks', () => {
    expect(route('x'.repeat(501)).model).toBe('deepseek-v4-pro')
  })

  it('honors custom model overrides', () => {
    expect(route('hello', { cheapModel: 'a', qualityModel: 'b' }).model).toBe('a')
  })
})
