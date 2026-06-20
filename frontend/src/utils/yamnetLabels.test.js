import { describe, it, expect } from 'vitest'
import { YAMNET_LABELS } from './yamnetLabels'

describe('bundled YAMNet labels', () => {
  it('has the full 521-class set', () => {
    expect(YAMNET_LABELS).toHaveLength(521)
  })

  it('preserves multi-word labels that contain commas (the parsing bug)', () => {
    // These indices/labels come from the official AudioSet class map and are
    // exactly the ones the old comma-split parser corrupted.
    expect(YAMNET_LABELS[19]).toBe('Crying, sobbing')
    expect(YAMNET_LABELS[317]).toBe('Police car (siren)')
    expect(YAMNET_LABELS[391]).toBe('Civil defense siren')
  })

  it('has no leftover surrounding quotes', () => {
    expect(YAMNET_LABELS.some((l) => l.startsWith('"') || l.endsWith('"'))).toBe(false)
  })
})
