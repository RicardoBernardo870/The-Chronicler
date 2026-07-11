import { describe, expect, it } from 'vitest'
import { checkPageSave } from '@/utils/pageSave'

describe('checkPageSave', () => {
  it('accepts a changed page within range', () => {
    expect(checkPageSave(42, 19, 292)).toEqual({ ok: true, reason: null })
  })

  it('accepts going backwards (corrections)', () => {
    expect(checkPageSave(10, 19, 292)).toEqual({ ok: true, reason: null })
  })

  it('accepts finishing the book (page = total)', () => {
    expect(checkPageSave(292, 19, 292)).toEqual({ ok: true, reason: null })
  })

  it('blocks an unchanged page', () => {
    expect(checkPageSave(19, 19, 292)).toEqual({ ok: false, reason: 'unchanged' })
  })

  it('blocks pages beyond the book', () => {
    expect(checkPageSave(293, 19, 292)).toEqual({ ok: false, reason: 'out-of-range' })
  })

  it('blocks negatives, null, undefined and NaN', () => {
    expect(checkPageSave(-1, 19, 292).reason).toBe('out-of-range')
    expect(checkPageSave(null, 19, 292).reason).toBe('out-of-range')
    expect(checkPageSave(undefined, 19, 292).reason).toBe('out-of-range')
    expect(checkPageSave(Number.NaN, 19, 292).reason).toBe('out-of-range')
  })
})
