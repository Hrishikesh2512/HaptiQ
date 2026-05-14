import { useState, useEffect, useRef } from 'react'
import { Bell, Mic, MicOff, History, Settings, ShieldAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Waveform from './components/Waveform'

function App() {
  const [isListening, setIsListening] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('Disconnected');
  const [analyzer, setAnalyzer] = useState(null);
  const [error, setError] = useState(null);
  
  const ws = useRef(null);
  const audioContext = useRef(null);
  const processor = useRef(null);
  const stream = useRef(null);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const startListening = async () => {
    try {
      setError(null);
      // Connect WebSocket
      ws.current = new WebSocket('ws://127.0.0.1:8000/ws/audio');
      
      ws.current.onopen = () => {
        setStatus('Connected');
        setIsListening(true);
        setupAudio().catch(err => {
          console.error("Audio Setup Error:", err);
          setError("Microphone access denied or failed.");
          stopListening();
        });
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'sound_detected' && data.is_critical) {
          addAlert(data.label, data.confidence);
          triggerHaptic();
        }
      };

      ws.current.onclose = () => {
        setStatus('Disconnected');
        setIsListening(false);
      };

      ws.current.onerror = () => {
        setError("WebSocket connection failed. Is the backend running?");
        stopListening();
      };

    } catch (err) {
      console.error("Failed to start listening:", err);
      setError("Failed to connect to the server.");
    }
  };

  const stopListening = () => {
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
          <button className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Control */}
      <main className="w-full max-w-2xl flex-1 flex flex-col items-center">
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
            <button className="text-sm text-primary hover:underline flex items-center gap-1">
              <History size={14} />
              View History
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
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

      {/* Footer / Tip */}
      <footer className="mt-12 text-center text-slate-500 text-sm max-w-md">
        <p>Tip: HaptiQ uses your device's vibration motor to alert you. Make sure vibration is enabled in your browser settings.</p>
      </footer>
    </div>
  )
}

export default App
