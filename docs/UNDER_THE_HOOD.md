# How HaptiQ actually works (Under the hood)

If you're wondering how the audio gets from your mic to the AI and back, here's the play-by-play.

### 1. Capturing the sound (Frontend)
Inside `App.jsx`, we use the browser's `AudioContext`. We ask for a sample rate of 16,000Hz because the AI model (YAMNet) was specifically trained on 16kHz audio. If we sent 44.1kHz (the usual music quality), the AI would get confused.

We use a `ScriptProcessorNode` to grab the audio in chunks of 4096 samples. These are converted from raw browser data into `Int16` (short integers) and sent over a WebSocket as raw bytes.

### 2. The AI Pipeline (Backend)
The backend (`ws_handler.py`) is constantly waiting for those bytes. 
But there's a catch: The AI model needs about 1 second of audio to make a good guess. Since our chunks are only ~0.25 seconds, the backend uses a "Rolling Buffer" (a list that keeps growing) to collect enough data before it asks the AI: "What is this sound?"

### 3. Classification (YAMNet)
We use Google's YAMNet model. It's a "deep net" that can recognize 521 different sounds. 
* We look at the top predictions.
* If the prediction is something we care about (like a 'Siren') and the AI is more than 25% sure, we send a message back to the frontend.

### 4. Visualizing it
The `Waveform.jsx` component uses a HTML5 Canvas. It doesn't actually "know" what the sound is—it just draws the amplitude of the signal to give the user visual feedback that the mic is alive.

### Troubleshooting tips
* **Mic not working?** Make sure you're on `localhost` or `127.0.0.1`. Browsers block microphones on non-secure connections.
* **No alerts?** Check the backend terminal. If the AI is "hearing" stuff but not alerting, you might need to lower the confidence threshold in `ws_handler.py`.
