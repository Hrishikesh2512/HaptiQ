// Visual + haptic metadata for detected sounds, and the mapping from a raw
// YAMNet label to the right bucket. Kept separate from the UI so it can be
// unit-tested.

export const SOUND_META = {
  siren:    { icon: '🚨', color: '#ef4444', vibrate: [400, 150, 400, 150, 400] },
  alarm:    { icon: '🔔', color: '#f97316', vibrate: [600, 200, 600] },
  doorbell: { icon: '🔔', color: '#a855f7', vibrate: [200, 100, 200] },
  dog:      { icon: '🐕', color: '#eab308', vibrate: [300, 100, 100, 100, 300] },
  crying:   { icon: '😢', color: '#3b82f6', vibrate: [500, 200, 300] },
  shout:    { icon: '📢', color: '#f97316', vibrate: [300, 100, 300] },
  glass:    { icon: '🪟', color: '#06b6d4', vibrate: [100, 50, 100, 50, 100] },
  default:  { icon: '🔊', color: '#6366f1', vibrate: [200] },
}

export const getMeta = (label = '') => {
  const l = label.toLowerCase()
  if (l.includes('siren') || l.includes('ambulance') || l.includes('police')) return SOUND_META.siren
  if (l.includes('alarm') || l.includes('smoke') || l.includes('fire')) return SOUND_META.alarm
  if (l.includes('doorbell') || l.includes('door bell')) return SOUND_META.doorbell
  if (l.includes('dog') || l.includes('bark')) return SOUND_META.dog
  if (l.includes('cry') || l.includes('infant') || l.includes('baby')) return SOUND_META.crying
  if (l.includes('shout') || l.includes('scream') || l.includes('yell')) return SOUND_META.shout
  if (l.includes('glass') || l.includes('shatter')) return SOUND_META.glass
  return SOUND_META.default
}

// A detection is only worth a vibration/flash/alert if it maps to one of the
// specific buckets above. Anything that falls through to `default` is an
// everyday sound (speech, music, typing…) we deliberately stay quiet for — this
// mirrors the backend's is_critical() gate so on-device mode doesn't buzz on
// every sound.
export const isCritical = (label = '') => getMeta(label) !== SOUND_META.default
