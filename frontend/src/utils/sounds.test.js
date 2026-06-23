import { describe, it, expect } from 'vitest'
import { getMeta, isCritical, SOUND_META } from './sounds'

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

describe('isCritical', () => {
  it('is true for sounds that map to a specific bucket', () => {
    expect(isCritical('Civil defense siren')).toBe(true)
    expect(isCritical('Fire alarm')).toBe(true)
    expect(isCritical('Dog')).toBe(true)
    expect(isCritical('Baby cry, infant cry')).toBe(true)
    expect(isCritical('Glass breaking')).toBe(true)
  })

  it('is false for everyday sounds that fall through to default', () => {
    expect(isCritical('Speech')).toBe(false)
    expect(isCritical('Music')).toBe(false)
    expect(isCritical('Piano')).toBe(false)
    expect(isCritical('Typing')).toBe(false)
    expect(isCritical()).toBe(false)
  })
})
