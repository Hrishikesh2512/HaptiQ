import { describe, it, expect } from 'vitest'
import { getMeta, SOUND_META } from './sounds'

describe('getMeta', () => {
  it('maps siren-family labels to the siren bucket', () => {
    expect(getMeta('Civil defense siren')).toBe(SOUND_META.siren)
    expect(getMeta('Police car (siren)')).toBe(SOUND_META.siren)
    expect(getMeta('Ambulance (siren)')).toBe(SOUND_META.siren)
  })

  it('maps crying/baby labels to the crying bucket', () => {
    expect(getMeta('Crying, sobbing')).toBe(SOUND_META.crying)
    expect(getMeta('Baby cry, infant cry')).toBe(SOUND_META.crying)
  })

  it('maps alarms and dogs correctly', () => {
    expect(getMeta('Fire alarm')).toBe(SOUND_META.alarm)
    expect(getMeta('Dog')).toBe(SOUND_META.dog)
    expect(getMeta('Bark')).toBe(SOUND_META.dog)
  })

  it('falls back to default for unknown / empty labels', () => {
    expect(getMeta('Piano')).toBe(SOUND_META.default)
    expect(getMeta()).toBe(SOUND_META.default)
  })
})
