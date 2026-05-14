# HaptiQ - AI Sound Assistant

HaptiQ is a small project we built to help deaf and hard-of-hearing people stay aware of what's happening around them. It uses a microphone to "listen" to environmental sounds (like sirens, doorbells, or a baby crying) and turns them into visual alerts and vibrations on your screen.

## How it works
The system is split into two parts that talk to each other in real-time:
1. **The Backend (Python/FastAPI)**: This is the "brain." It uses an AI model called YAMNet (by Google) to identify sounds. It listens to a continuous stream of audio coming from the browser.
2. **The Frontend (React/Vite)**: This is the "face." It handles the microphone permissions, shows a cool audio waveform so you know it's working, and pops up notification cards when the AI finds something important.

## Tech we used
* **Backend**: FastAPI, TensorFlow (for the AI), Librosa (for cleaning up audio).
* **Frontend**: React, TailwindCSS (for the styling), Framer Motion (for the animations).
* **Connection**: WebSockets (because standard APIs are too slow for real-time audio).

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

## Next Steps
We're planning to add a database to save alert history and maybe build a mobile app version later so it can vibrate your phone in your pocket.
