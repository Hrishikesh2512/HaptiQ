import { useState, useEffect, useRef } from 'react'
import { Bell, Mic, MicOff, History, Settings, ShieldAlert, X, Brain } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Waveform from './components/Waveform'
import HistoryLog from './components/HistoryLog'
import axios from 'axios'
import * as tf from '@tensorflow/tfjs'
import * as speechCommands from '@tensorflow-models/speech-commands'

function App() {
  const [isListening, setIsListening] = useState(false);
  const [model, setModel] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [threshold, setThreshold] = useState(0.7);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const getVibrationPattern = (label) => {
    // Standard patterns
    const patterns = {
      'siren': [500, 200, 500, 200, 500], // Urgent
      'alarm': [1000, 500, 1000], // Long
      'doorbell': [200, 100, 200], // Double tap
      'shouting': [300, 100, 300], // Sharp
      'default': [200] // Single pulse
    };
    return patterns[label.toLowerCase()] || patterns['default'];
  };
  const [analyzer, setAnalyzer] = useState(null);
  const [error, setError] = useState(null);
  
  const ws = useRef(null);
  const audioContext = useRef(null);
  const processor = useRef(null);
  const stream = useRef(null);

  useEffect(() => {
    loadModel();
    return () => {
      stopListening();
    };
  }, []);

  const loadModel = async () => {
    try {
      setIsModelLoading(true);
      const recognizer = speechCommands.create("BROWSER_FFT");
      await recognizer.ensureModelLoaded();
      setModel(recognizer);
      setIsModelLoading(false);
      console.log("On-device AI model loaded.");
    } catch (err) {
      console.error("Failed to load AI model:", err);
      setError("Failed to load on-device AI.");
      setIsModelLoading(false);
    }
  };

  const startListening = async () => {
    if (!model) {
      setError("AI Model not loaded yet. Please wait.");
      return;
    }

    try {
      setError(null);
      setIsListening(true);
      setStatus('Active (On-Device)');

      // Start on-device listening
      model.listen(result => {
        const labels = model.wordLabels();
        const scores = result.scores;
        const topIndex = scores.indexOf(Math.max(...scores));
        const label = labels[topIndex];
        const confidence = scores[topIndex];

        // Use the user's sensitivity threshold
        if (label !== '_background_noise_' && confidence > threshold) {
          addAlert(label, confidence);
          
          if (vibrationEnabled) {
            const pattern = getVibrationPattern(label);
            navigator.vibrate(pattern);
          }
          
          syncToBackend(label, confidence);
        }
      }, {
        probabilityThreshold: 0.5, // Keep low here, filter manually above
        overlapFactor: 0.5
      });

      // Setup audio for visualization only
      setupAudio().catch(err => {
        console.error("Visualizer Error:", err);
      });

    } catch (err) {
      console.error("Failed to start listening:", err);
      setError("Failed to start AI listening.");
    }
  };

  const syncToBackend = async (label, confidence) => {
    try {
      await axios.post(`http://${window.location.hostname}:8000/api/log`, {
        label,
        confidence
      });
    } catch (err) {
      // Silently fail if backend is off
      console.log("Backend offline, skipping sync.");
    }
  };

  const stopListening = () => {
    if (model && model.isListening()) model.stopListening();
    if (ws.current) ws.current.close();
    if (processor.current) processor.current.disconnect();
    if (stream.current) stream.current.getTracks().forEach(track => track.stop());
    if (audioContext.current && audioContext.current.state !== 'closed') {
      audioContext.current.close();
    }
    
    setIsListening(false);
    setStatus('Disconnected');
    setAnalyzer(null);
  };

  const setupAudio = async () => {
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.current.createMediaStreamSource(stream.current);
    
    // Create Analyser for visualization
    const analyzerNode = audioContext.current.createAnalyser();
    analyzerNode.fftSize = 2048;
    setAnalyzer(analyzerNode);
    
    // We use a ScriptProcessorNode for simplicity in MVP
    processor.current = audioContext.current.createScriptProcessor(4096, 1, 1);
    
    processor.current.onaudioprocess = (e) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 for the backend
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        ws.current.send(pcmData.buffer);
      }
    };

    source.connect(analyzerNode);
    analyzerNode.connect(processor.current);
    processor.current.connect(audioContext.current.destination);
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`http://${window.location.hostname}:8000/api/history`);
      setHistory(response.data);
      setShowHistory(true);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setError("Could not load history from server.");
    }
  };

  const addAlert = (label, confidence) => {
    const newAlert = {
      id: Date.now(),
      label,
      confidence: (confidence * 100).toFixed(1),
      time: new Date().toLocaleTimeString()
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 5));
  };

  const triggerHaptic = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-12">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <ShieldAlert size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">HaptiQ</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-sm ${status === 'Connected' ? 'text-secondary' : 'text-slate-500'}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-secondary animate-pulse' : 'bg-slate-500'}`} />
            {status}
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Settings Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 relative shadow-2xl"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                <Settings className="text-primary" />
                Settings
              </h2>

              <div className="space-y-8">
                {/* Sensitivity Slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="font-semibold text-slate-300">Sensitivity</label>
                    <span className="text-primary font-mono">{(threshold * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="0.95" 
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Higher sensitivity means the AI will alert you even for quiet or less certain sounds.
                  </p>
                </div>

                {/* Vibration Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                  <div>
                    <h3 className="font-semibold text-slate-200">Vibration Feedback</h3>
                    <p className="text-xs text-slate-500 text-balance">Phone will shake for alerts</p>
                  </div>
                  <button 
                    onClick={() => setVibrationEnabled(!vibrationEnabled)}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${vibrationEnabled ? 'bg-primary' : 'bg-slate-600'}`}
                  >
                    <motion.div 
                      animate={{ x: vibrationEnabled ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Control */}
      <main className="w-full max-w-2xl flex-1 flex flex-col items-center">
        {isModelLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 flex items-center gap-2 text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20"
          >
            <Brain className="animate-pulse" size={20} />
            <span className="text-sm font-medium">Downloading AI Brain...</span>
          </motion.div>
        )}

        <div className="relative mb-12">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isListening ? stopListening : startListening}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 shadow-2xl transition-all duration-500 ${
              isListening ? 'bg-danger/20 border-2 border-danger glow-danger' : 'bg-primary border-2 border-primary glow-primary'
            }`}
          >
            {isListening ? (
              <>
                <MicOff size={48} className="text-danger" />
                <span className="font-semibold text-danger">Stop Listening</span>
              </>
            ) : (
              <>
                <Mic size={48} className="text-white" />
                <span className="font-semibold text-white">Start Listening</span>
              </>
            )}
          </motion.button>
          
          {isListening && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-danger/20 rounded-full -z-10"
            />
          )}
        </div>

        {/* Real-time Waveform */}
        <Waveform analyzer={analyzer} isListening={isListening} />

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 mb-6 bg-danger/10 border border-danger/20 text-danger px-4 py-2 rounded-lg text-sm w-full text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Real-time Alerts */}
        <div className="w-full space-y-4 mt-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell size={20} className="text-warning" />
              Active Alerts
            </h2>
            <button 
              onClick={fetchHistory}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <History size={14} />
              View History
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {/* Existing Alerts */}
              {alerts.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-500 italic"
                >
                  No sounds detected yet. Watching for alerts...
                </motion.div>
              ) : (
                alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    className="glass-card border-l-4 border-warning p-4 rounded-r-xl flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-bold text-lg text-warning capitalize">{alert.label}</h3>
                      <p className="text-xs text-slate-400">{alert.time} • {alert.confidence}% match</p>
                    </div>
                    <div className="bg-warning/10 p-2 rounded-lg">
                      <Bell size={20} className="text-warning" />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* History Modal/Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 relative shadow-2xl"
            >
              <button 
                onClick={() => setShowHistory(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
              <HistoryLog history={history} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Tip */}
      <footer className="mt-12 text-center text-slate-500 text-sm max-w-md">
        <p>Tip: HaptiQ uses your device's vibration motor to alert you. Make sure vibration is enabled in your browser settings.</p>
      </footer>
    </div>
  )
}

export default App
