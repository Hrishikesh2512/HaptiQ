@echo off
echo ==========================================
echo    HaptiQ : AI Assistive System
echo ==========================================
echo.

:: 1. Launch Backend
echo Launching AI Backend...
start "HaptiQ Backend" cmd /k "cd backend && .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --host 127.0.0.1"

:: 2. Launch Frontend
echo Launching React Frontend...
start "HaptiQ Frontend" cmd /k "cd frontend && set PATH=C:\Program Files\nodejs;%%PATH%% && npm.cmd run dev"

echo.
echo ------------------------------------------
echo SUCCESS: Both servers are starting up.
echo ------------------------------------------
echo.
echo 1. Wait for "Uvicorn running" and "Vite Ready" messages.
echo 2. Open your browser to: http://localhost:5173
echo.
pause
