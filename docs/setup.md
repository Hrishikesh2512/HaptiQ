# Setup Guide

This guide will help you get HaptiQ running on your local machine from scratch.

## 1. Prerequisites
You'll need these installed before you start:
* **Python 3.10+**: Download from [python.org](https://www.python.org/)
* **Node.js**: Download from [nodejs.org](https://nodejs.org/) (Use the LTS version)
* **Git**: To clone the project.

---

## 2. Setting up the Backend
Open your terminal in the `backend` folder and run these:

```powershell
# Create the virtual environment
python -m venv venv

# Activate it (Windows)
.\venv\Scripts\activate

# Install the AI libraries
pip install -r requirements.txt
```

*Note: The first time you run the backend, it will download the YAMNet AI model (about 15MB) from Google's servers. Make sure you have an internet connection.*

---

## 3. Setting up the Frontend
Open a new terminal in the `frontend` folder and run:

```powershell
# Install React and other UI packages
npm install
```

---

## 4. Running the App
The easiest way is to use the shortcut in the root folder:
1. Double-click `run_haptiq.bat`.
2. Wait for the terminals to show they are ready.
3. Open your browser to `http://localhost:5173`.

### Common Issues
* **"Scripts are disabled" error**: If Windows blocks the startup, try running `npm.cmd run dev` or using the `run_haptiq.bat` script, which is designed to bypass this.
* **Mic not working**: Ensure you are using `localhost` or `127.0.0.1` in your browser URL. Chrome and Firefox block microphones on "insecure" sites.
