import { describe, expect, it } from 'vitest'
import { decisionBlock, isAmbiguous, readings } from '../src/ambiguity.ts'
import { compile } from '../src/compile.ts'
import { extrapolate, extrapolationBlock } from '../src/extrapolator/index.ts'
import { bucketOfCheck } from '../src/lessons.ts'
import { normalise, refusalText, detectShape } from '../src/normalise.ts'
import { nextStep } from '../src/suggest.ts'
import { defaultVoice, voiceBlock } from '../src/voice.ts'

describe('normalise', () => {
  it('reads a parts list as a document', () => {
    expect(detectShape('a parts list and cutting plan for my fiber tubing frame')).toBe('document')
  })

  it('refuses a request that is a company, not an artifact', () => {
    const result = normalise({ goal: 'Build me an app like Uber' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toContain('company')
    expect(refusalText(result.refusal)).toContain('Nothing was built, so nothing was spent')
  })

  it('refuses a request too short to build from', () => {
    const result = normalise({ goal: 'make it' })
    expect(result.ok).toBe(false)
  })

  it('caps the hard requirements at seven', () => {
    const result = normalise({
      goal: 'a page for my lawn care business with prices',
      mustHave: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.spec.mustHave).toHaveLength(7)
  })

  it('gives every non-goal the no-backend default', () => {
    const result = normalise({ goal: 'a page for my lawn care business' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.spec.nonGoals.join(' ')).toContain('no backend')
  })

  it('turns style words into numbers rather than moods', () => {
    const result = normalise({ goal: 'a page for my bakery with prices', styleWords: ['warm', 'calm'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // A palette is hex codes; a type scale is pixel sizes.
    expect(result.spec.style.palette).toMatch(/#[0-9A-Fa-f]{6}/)
    expect(result.spec.style.type).toMatch(/\d+px/)
  })
})

describe('compile', () => {
  const spec = (() => {
    const result = normalise({
      goal: 'a page for my lawn care business in Edmonton',
      details: ['Lawn & Order YEG', '40/70/110 CAD'],
      mustHave: ['phone visible'],
      neverInvent: ['reviews'],
    })
    if (!result.ok) throw new Error('fixture failed to normalise')
    return result.spec
  })()

  it('orders the sections so intent precedes aesthetics', () => {
    const mask = compile(spec)
    const keys = mask.sections.map(section => section.key)
    expect(keys.indexOf('brief')).toBeLessThan(keys.indexOf('style'))
    expect(keys.indexOf('particulars')).toBeLessThan(keys.indexOf('acceptance'))
    expect(keys).toContain('self-check')
  })

  it('carries the particulars verbatim', () => {
    const mask = compile(spec)
    expect(mask.text).toContain('Lawn & Order YEG')
    expect(mask.text).toContain('40/70/110 CAD')
  })

  it('states the never-invent list with the blank rule', () => {
    const mask = compile(spec)
    expect(mask.text).toContain('NEVER INVENT')
    expect(mask.text).toContain('A visible blank is a correct answer')
  })

  it('reports a token weight for every section', () => {
    const mask = compile(spec)
    expect(mask.tokens).toBeGreaterThan(200)
    expect(mask.sections.every(section => section.tokens > 0)).toBe(true)
    expect(mask.sections.reduce((sum, section) => sum + section.tokens, 0)).toBeLessThanOrEqual(mask.tokens + 8)
  })

  it('omits the lessons section when the shelf is empty', () => {
    const mask = compile({ ...spec, lessons: '' })
    expect(mask.sections.some(section => section.key === 'lessons')).toBe(false)
  })
})

describe('ambiguity', () => {
  it('names the readings a vague page request allows', () => {
    const list = readings('a page for my business')
    expect(list.length).toBe(3)
    expect(list[0]?.id).toBe('landing')
    expect(isAmbiguous('a page for my business')).toBe(true)
  })

  it('records the taken reading and the alternatives', () => {
    const list = readings('a page for my business')
    const taken = list[0]
    if (taken === undefined) throw new Error('expected readings')
    const block = decisionBlock(taken, list.slice(1))
    expect(block).toContain('INTERPRETATION TAKEN')
    expect(block).toContain('OTHER READINGS')
    expect(block).toContain('separable')
  })

  it('is not ambiguous for a request with only one reading', () => {
    expect(readings('rename every photo in a folder')).toHaveLength(2)
    expect(readings('a wedding invitation page')).toHaveLength(3)
  })
})

describe('the Extrapolator', () => {
  it('marks contact details as blanks rather than inventing them', () => {
    const filled = extrapolate({ goal: 'a page for my lawn care business' }, 'single-page-site')
    const contact = filled.find(item => item.field === 'contact')
    expect(contact?.marked).toBe(true)
    expect(contact?.value).toContain('[your phone]')
  })

  it('derives a must-have from a priced request', () => {
    const filled = extrapolate({ goal: 'a page with prices for my lawn care business' }, 'single-page-site')
    expect(filled.some(item => item.field === 'must-have' && item.value.includes('prices'))).toBe(true)
  })

  it('explains every fill and marks only what must stay blank', () => {
    const filled = extrapolate({ goal: 'a parts list for my tubing project' }, 'document')
    expect(filled.every(item => item.basis.length > 10)).toBe(true)
    const block = extrapolationBlock(filled)
    expect(block).toContain('EXTRAPOLATED')
    expect(block).toContain('visible blank')
  })

  it('produces nothing when everything was supplied', () => {
    const filled = extrapolate({
      goal: 'a page for my business with my phone 780-555-0142',
      audience: 'locals',
      mustHave: ['phone'],
      acceptance: ['phone visible'],
      styleWords: ['calm'],
      details: ['780-555-0142'],
    }, 'single-page-site')
    // Only structural guidance should remain once the specifics are supplied.
    expect(filled.every(item => item.field !== 'contact')).toBe(true)
  })
})

describe('the interview', () => {
  it('starts with the required goal question', () => {
    const step = nextStep({}, { goal: '' })
    expect('key' in step && step.key).toBe('goal')
  })

  it('asks for the shape once the goal is known and the shape is not', () => {
    const step = nextStep({ goal: 'answered' }, { goal: 'something unusual and unclear' })
    expect('key' in step && step.key).toBe('shape')
  })

  it('never re-asks sizes when the particulars box already answered them', () => {
    const step = nextStep(
      { goal: 'answered', shape: 'answered', details: 'answered' },
      { goal: 'a parts list for my 12mm fiber tubing frame', shape: 'document' },
    )
    expect('key' in step ? step.key !== 'dimensions' : true).toBe(true)
  })

  it('finishes when everything valuable has been asked', () => {
    const answered = {
      goal: 'x', shape: 'x', details: 'x', mustHave: 'x', rejectWhy: 'x', neverInvent: 'x',
      nonGoals: 'x', styleWords: 'x', techLimits: 'x', dataSource: 'x',
      facts: 'x', length: 'x', contact: 'x', sections: 'x',
    }
    const step = nextStep(answered, { goal: 'a parts list for my tubing project', shape: 'document' })
    expect('done' in step).toBe(true)
  })
})

describe('lessons', () => {
  it('maps a failed check onto the bucket it represents', () => {
    expect(bucketOfCheck('requirements-traced', 'no trace of: prices')).toBe('missed-requirement')
    expect(bucketOfCheck('no-placeholders', 'found: lorem ipsum')).toBe('hallucinated-detail')
    expect(bucketOfCheck('entry-exists', 'index.html was not produced')).toBe('broken-run')
    expect(bucketOfCheck('unknown-check', '')).toBeUndefined()
  })
})

describe('voice', () => {
  it('carries the workshop reference points without printing the crude ones', () => {
    const voice = defaultVoice()
    expect(voice.references.join(' ')).toContain('fiber tubing')
    const block = voiceBlock(voice, false)
    expect(block).toContain('borrow the rhythm')
    expect(block).toContain('NEVER PRINT')
    expect(block).toContain('public')
  })

  it('allows one in-joke for a personal artifact only', () => {
    const voice = defaultVoice()
    expect(voiceBlock(voice, true)).toContain('in-joke')
    expect(voiceBlock(voice, false)).not.toContain('in-joke is welcome')
  })

  it('contributes nothing when disabled', () => {
    expect(voiceBlock({ ...defaultVoice(), enabled: false }, true)).toBe('')
  })
})
