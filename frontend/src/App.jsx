import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Settings, X, Clock, Wifi, WifiOff, Zap, Volume2, Brain } from 'lucide-react'
import Waveform from './components/Waveform'
import { YamnetClassifier } from './utils/yamnet'
import axios from 'axios'

const SOUND_META = {
  siren:    { icon: '🚨', color: '#ef4444', vibrate: [400,150,400,150,400] },
  alarm:    { icon: '🔔', color: '#f97316', vibrate: [600,200,600] },
  doorbell: { icon: '🔔', color: '#a855f7', vibrate: [200,100,200] },
  dog:      { icon: '🐕', color: '#eab308', vibrate: [300,100,100,100,300] },
  crying:   { icon: '😢', color: '#3b82f6', vibrate: [500,200,300] },
  shout:    { icon: '📢', color: '#f97316', vibrate: [300,100,300] },
  glass:    { icon: '🪟', color: '#06b6d4', vibrate: [100,50,100,50,100] },
  default:  { icon: '🔊', color: '#6366f1', vibrate: [200] },
}

const getMeta = (label = '') => {
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

const BACKEND = `http://${window.location.hostname}:8000`
const WS_URL  = `ws://${window.location.hostname}:8000/ws/audio`

export default function App() {
  const [isListening, setIsListening]   = useState(false)
  const [mode, setMode]                  = useState('idle') // 'idle'|'loading'|'ondevice'|'server'|'error'
  const [loadMsg, setLoadMsg]            = useState('')
  const [alerts, setAlerts]              = useState([])
  const [liveLabel, setLiveLabel]        = useState(null)
  const [liveConf, setLiveConf]          = useState(0)
  const [audioLevel, setAudioLevel]      = useState(0)
  const [analyzer, setAnalyzer]          = useState(null)
  const [error, setError]                = useState(null)
  const [showSettings, setShowSettings]  = useState(false)
  const [showHistory, setShowHistory]    = useState(false)
  const [history, setHistory]            = useState([])
  const [threshold, setThreshold]        = useState(0.35)
  const [hapticOn, setHapticOn]          = useState(true)

  const classifierRef   = useRef(null)
  const wsRef           = useRef(null)
  const audioCtxRef     = useRef(null)
  const processorRef    = useRef(null)
  const streamRef       = useRef(null)
  const isListeningRef  = useRef(false)
  const thresholdRef    = useRef(threshold)
  const hapticRef       = useRef(hapticOn)
  const audioBuffer     = useRef(new Float32Array(0))
  const labelTimer      = useRef(null)

  useEffect(() => { thresholdRef.current = threshold }, [threshold])
  useEffect(() => { hapticRef.current = hapticOn }, [hapticOn])

  // Load YAMNet on mount (works on HTTPS, skipped on HTTP)
  useEffect(() => {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
    if (!isSecure) return // Skip on HTTP local — will use server fallback
    ;(async () => {
      try {
        setMode('loading')
        const clf = new YamnetClassifier()
        await clf.load(msg => setLoadMsg(msg))
        classifierRef.current = clf
        setMode('idle')
      } catch (e) {
        console.warn('On-device AI failed:', e.message)
        setMode('idle')
      }
    })()
  }, [])

  const addAlert = useCallback((label, confidence) => {
    const meta = getMeta(label)
    setAlerts(prev => [{ id: Date.now(), label, confidence, meta, time: new Date() }, ...prev].slice(0, 20))
    if (hapticRef.current && navigator.vibrate) navigator.vibrate(meta.vibrate)
    clearTimeout(labelTimer.current)
    labelTimer.current = setTimeout(() => setLiveLabel(null), 4000)
  }, [])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)
    setMode('idle')
    setLiveLabel(null)
    setAudioLevel(0)
    wsRef.current?.close()
    processorRef.current?.disconnect()
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close()
    setAnalyzer(null)
    audioBuffer.current = new Float32Array(0)
  }, [])

  const setupAudioEngine = async () => {
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 16000 }
    })
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()

    const source  = audioCtxRef.current.createMediaStreamSource(streamRef.current)
    const analyser = audioCtxRef.current.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    setAnalyzer(analyser)

    processorRef.current = audioCtxRef.current.createScriptProcessor(4096, 1, 1)
    analyser.connect(processorRef.current)
    processorRef.current.connect(audioCtxRef.current.destination)
    return processorRef.current
  }

  const startListening = async () => {
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(`🔒 Mic blocked (HTTP). On phone: chrome://flags → "insecure origins" → add http://${location.hostname}:5173 → Relaunch.`)
      return
    }

    try {
      const processor = await setupAudioEngine()
      isListeningRef.current = true
      setIsListening(true)

      const useOnDevice = !!classifierRef.current
      setMode(useOnDevice ? 'ondevice' : 'server')

      if (useOnDevice) {
        // ── ON-DEVICE MODE (HTTPS / Vercel) ──────────────────────────
        audioBuffer.current = new Float32Array(0)
        processor.onaudioprocess = async (e) => {
          if (!isListeningRef.current) return
          const raw = e.inputBuffer.getChannelData(0)
          let s = 0; for (let i = 0; i < raw.length; i++) s += raw[i] * raw[i]
          setAudioLevel(Math.sqrt(s / raw.length))

          const nb = new Float32Array(audioBuffer.current.length + raw.length)
          nb.set(audioBuffer.current); nb.set(raw, audioBuffer.current.length)
          audioBuffer.current = nb

          if (audioBuffer.current.length >= 15600) {
            const buf = audioBuffer.current.slice(0, 15600)
            audioBuffer.current = audioBuffer.current.slice(4096)
            const result = classifierRef.current?.predict(buf)
            if (result) {
              setLiveLabel(result.label)
              setLiveConf(result.confidence)
              if (result.confidence >= thresholdRef.current) addAlert(result.label, result.confidence)
            }
          }
        }
      } else {
        // ── SERVER MODE (HTTP local) ──────────────────────────────────
        // GUARD: Browsers block ws:// on https:// pages
        if (location.protocol === 'https:') {
          setError('⚠️ On-Device AI failed to load. Browser blocks Laptop Brain on HTTPS for security. Try refreshing or use the local IP link.')
          stopListening()
          return
        }

        const ws = new WebSocket(WS_URL)
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws

        processor.onaudioprocess = (e) => {
          if (!isListeningRef.current) return
          const raw = e.inputBuffer.getChannelData(0)
          let s = 0; for (let i = 0; i < raw.length; i++) s += raw[i] * raw[i]
          setAudioLevel(Math.sqrt(s / raw.length))
          if (ws.readyState !== WebSocket.OPEN) return
          const pcm = new Int16Array(raw.length)
          for (let i = 0; i < raw.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, raw[i] * 32768))
          ws.send(pcm.buffer)
        }

        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data)
            if (d.label) { setLiveLabel(d.label); setLiveConf(d.confidence || 0) }
            if (d.is_critical && (d.confidence || 0) >= thresholdRef.current) {
              addAlert(d.label, d.confidence)
              axios.post(`${BACKEND}/api/log`, { label: d.label, confidence: d.confidence }).catch(() => {})
            }
          } catch {}
        }
        ws.onerror = () => setError('Cannot reach laptop backend. Is it running?')
        ws.onclose = () => { if (isListeningRef.current) stopListening() }
      }
    } catch (err) {
      setError(err.message.includes('ermission') ? 'Microphone permission denied.' : err.message)
      stopListening()
    }
  }

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${BACKEND}/api/history`)
      setHistory(res.data); setShowHistory(true)
    } catch { setError('Backend offline — history unavailable.') }
  }

  const liveMeta = liveLabel ? getMeta(liveLabel) : null
  const volPct   = Math.min(100, audioLevel * 800)
  const modeLabel = { idle: '', loading: 'Loading AI…', ondevice: 'On-Device AI', server: 'Laptop AI' }

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg">👂</div>
          <div>
            <h1 className="font-semibold text-[15px] leading-tight">HaptiQ</h1>
            <p className="text-[11px] text-white/30">{modeLabel[mode] || 'Sound Assistant'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
            mode === 'ondevice' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
            mode === 'server'   ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            mode === 'loading'  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
            'bg-white/5 border-white/10 text-white/30'}`}>
            {mode === 'server' ? <Wifi size={10} /> : mode === 'ondevice' ? <Brain size={10} /> : <WifiOff size={10} />}
            {mode === 'ondevice' ? 'On-Device' : mode === 'server' ? 'Server' : mode === 'loading' ? 'Loading…' : 'Ready'}
          </div>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-xl glass flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 pb-6 gap-4">

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start justify-between gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="shrink-0 mt-0.5"><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Loading bar */}
        {mode === 'loading' && (
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 text-[13px] text-indigo-300">
            <Brain size={16} className="animate-pulse shrink-0" />
            <span>{loadMsg || 'Downloading AI model…'}</span>
          </div>
        )}

        {/* Big button */}
        <div className="flex flex-col items-center py-6">
          <div className="relative flex items-center justify-center w-48 h-48">
            {isListening && <>
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 pulse-ring" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/5 pulse-ring-2" />
            </>}
            <motion.button whileTap={{ scale: 0.93 }} onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-500 ${
                isListening ? 'bg-red-500/15 border-2 border-red-500/50 glow-red' : 'bg-indigo-500/15 border-2 border-indigo-500/50 glow-indigo'
              }`}>
              <motion.div animate={{ scale: isListening && audioLevel > 0.01 ? 1 + audioLevel * 4 : 1 }} transition={{ duration: 0.08 }}>
                {isListening ? <MicOff size={40} className="text-red-400" /> : <Mic size={40} className="text-indigo-400" />}
              </motion.div>
              <span className={`text-[11px] font-semibold tracking-widest ${isListening ? 'text-red-400' : 'text-indigo-400'}`}>
                {isListening ? 'STOP' : 'START'}
              </span>
            </motion.button>
          </div>
        </div>

        {/* Waveform */}
        <div className="w-full glass rounded-3xl overflow-hidden" style={{ height: 88 }}>
          <Waveform analyzer={analyzer} isListening={isListening} />
        </div>

        {/* Live strip */}
        <AnimatePresence>
          {isListening && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[11px] text-white/40 uppercase tracking-wider">Detecting</span>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 size={11} className="text-white/30" />
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div animate={{ width: `${volPct}%` }} transition={{ duration: 0.08 }}
                      className="h-full rounded-full bg-indigo-400" />
                  </div>
                </div>
              </div>
              {liveLabel ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{liveMeta?.icon}</span>
                    <span className="font-semibold text-[15px]">{liveLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div animate={{ width: `${liveConf * 100}%` }} transition={{ duration: 0.2 }}
                        className="h-full rounded-full" style={{ background: liveMeta?.color }} />
                    </div>
                    <span className="text-[12px] font-mono text-white/50">{(liveConf * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ) : <p className="text-[13px] text-white/30">Listening for sounds…</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">Recent Alerts</h2>
            <button onClick={loadHistory} className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors">
              <Clock size={12} /> History
            </button>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {alerts.length === 0 ? (
                <div className="glass rounded-2xl px-5 py-8 text-center">
                  <p className="text-white/25 text-sm">{isListening ? 'Make a sound to test…' : 'Start listening to detect sounds'}</p>
                </div>
              ) : alerts.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{ borderLeft: `2px solid ${a.meta.color}40` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                    style={{ background: `${a.meta.color}15` }}>{a.meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate" style={{ color: a.meta.color }}>{a.label}</p>
                    <p className="text-[11px] text-white/30">{a.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  </div>
                  <span className="font-mono text-[13px] shrink-0" style={{ color: a.meta.color }}>{(a.confidence * 100).toFixed(0)}%</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Settings bottom sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-full glass-strong rounded-t-3xl p-6 space-y-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[17px]">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/50"><X size={16} /></button>
              </div>
              <div>
                <div className="flex justify-between mb-3">
                  <div><p className="font-medium text-[14px]">Alert Sensitivity</p><p className="text-[11px] text-white/40 mt-0.5">Lower = more alerts</p></div>
                  <span className="text-indigo-400 font-mono font-semibold">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.1" max="0.9" step="0.05" value={threshold} onChange={e => setThreshold(+e.target.value)} />
                <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>More sensitive</span><span>Strict</span></div>
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-[14px]">Vibration Feedback</p><p className="text-[11px] text-white/40 mt-0.5">Different patterns per sound</p></div>
                <button onClick={() => setHapticOn(!hapticOn)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${hapticOn ? 'bg-indigo-500' : 'bg-white/10'}`}>
                  <motion.div animate={{ x: hapticOn ? 22 : 4 }} className="absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <button onClick={() => navigator.vibrate?.([200, 100, 200, 100, 400])}
                className="w-full py-3 rounded-2xl glass text-[14px] font-medium text-indigo-400 border border-indigo-500/20">
                <Zap size={14} className="inline mr-2" />Test Vibration
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History sheet */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" onClick={() => setShowHistory(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-full glass-strong rounded-t-3xl p-6 flex flex-col" style={{ maxHeight: '75dvh', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[17px]">History</h2>
                <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/50"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {history.length === 0 ? <p className="text-center py-10 text-white/30 text-sm">No history yet.</p>
                  : history.map((item, i) => {
                    const m = getMeta(item.label)
                    return (
                      <div key={item.id || i} className="flex items-center gap-3 glass rounded-2xl px-4 py-3">
                        <span className="text-xl">{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[13px] truncate">{item.label}</p>
                          <p className="text-[10px] text-white/30">{new Date(item.timestamp).toLocaleString()}</p>
                        </div>
                        <span className="text-[12px] font-mono text-white/40">{(item.confidence * 100).toFixed(0)}%</span>
                      </div>
                    )
                  })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
