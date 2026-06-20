# HaptiQ - AI Sound Assistant

HaptiQ is a small project we built to help deaf and hard-of-hearing people stay aware of what's happening around them. It uses a microphone to "listen" to environmental sounds (like sirens, doorbells, or a baby crying) and turns them into visual alerts and vibrations on your screen.

## How it works
The app runs Google's **YAMNet** sound-classification model and can do so in two modes:

1. **On-device mode (default)**: When served over HTTPS (e.g. on Vercel) or `localhost`, the frontend loads YAMNet via **TensorFlow.js** and classifies audio entirely in the browser — no server needed, and audio never leaves the device.
2. **Server mode (fallback)**: For plain-HTTP local testing where the browser blocks the in-browser model, the frontend streams 16-bit PCM audio over a WebSocket to the **Python/FastAPI backend**, which runs YAMNet and streams labels back.

In both modes the frontend handles microphone permissions, draws a live audio waveform, vibrates the device, flashes the screen, and logs critical detections (sirens, alarms, doorbells, crying, dog barks, breaking glass, etc.).

## Tech we used
* **Frontend**: React + Vite, TensorFlow.js (on-device AI), TailwindCSS (styling), Framer Motion (animations).
* **Backend** (fallback): FastAPI, TensorFlow + TensorFlow Hub (YAMNet), Librosa (audio handling), SQLAlchemy + SQLite (alert history).
* **Connection**: WebSockets for the real-time server fallback; a small REST API for history.

## Project Structure
* `/backend`: All the Python code and AI logic.
* `/frontend`: The React dashboard and CSS.
* `run_haptiq.bat`: A shortcut script to start everything at once.

## How to get started
If you're running this for the first time:

1. **Setup Backend**:
   - Go into `/backend`
   - Create a virtual environment: `python -m venv venv`
   - Install stuff: `.\venv\Scripts\pip install -r requirements.txt`

2. **Setup Frontend**:
   - Go into `/frontend`
   - Install packages: `npm install`

3. **Run it**:
   - Just double-click the `run_haptiq.bat` file in the root folder.
   - Open `http://localhost:5173` in your browser.

## Running the tests
* **Backend**: from `/backend`, run `.\venv\Scripts\python -m pytest` (covers the critical-sound matcher, PCM decoding/resampling, and config).
* **Frontend**: from `/frontend`, run `npm test` (covers the label→bucket mapping and the bundled YAMNet label list).

## Limitations & safety
HaptiQ is an **experimental aid, not a certified safety device.** It can miss sounds or misidentify them, so it must not be your only alert for emergencies — keep your certified smoke/CO alarms and assistive alerting devices. A few practical notes:
* **iOS has no vibration API**, so on iPhones the on-screen flash replaces haptics.
* Browsers throttle background tabs, so detection works best with the app open and the screen on (HaptiQ requests a screen wake-lock while listening).
* Continuous listening uses the microphone and battery; in on-device mode the audio never leaves your device.

## Next Steps
Alert history is already saved to a local SQLite database. Next we'd like to package this as an installable mobile app (PWA or native) so it can vibrate your phone in your pocket even when the screen is off.
