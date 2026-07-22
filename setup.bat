@echo off
REM ─────────────────────────────────────────────────────────────
REM EV Asset & Supply Chain Intelligence Platform
REM One-command bootstrap for Windows (cmd / PowerShell)
REM ─────────────────────────────────────────────────────────────
setlocal enabledelayedexpansion

set ROOT=%~dp0
cd /d "%ROOT%"

if not defined PYTHON_BIN set PYTHON_BIN=py
set VENV_DIR=.venv
set VENV_PY=%VENV_DIR%\Scripts\python.exe
set VENV_PIP=%VENV_DIR%\Scripts\pip.exe

echo ──^> Backend setup (Python via %PYTHON_BIN%)

if not exist "%VENV_DIR%\Scripts\python.exe" (
    %PYTHON_BIN% -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Failed to create venv. Ensure Python 3.10 is installed. 1>&2
        exit /b 1
    )
)

"%VENV_PIP%" install --upgrade pip wheel setuptools >nul
"%VENV_PIP%" install -r backend\requirements.txt

REM Initialize SQLite database
"%VENV_PY%" -c "import sys; sys.path.insert(0, 'backend'); from database import init_db; init_db()"

echo.
echo ──^> Frontend setup (Node.js)
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Install Node.js 20+ from https://nodejs.org/ 1>&2
    exit /b 1
)

if not exist frontend\node_modules\.package-lock.json (
    cd frontend
    call npm install --include=dev
    cd ..
)

REM ─── .env bootstrap ─────────────────────────────────────────────
if not exist .env (
    copy .env.example .env >nul
    echo ──^> Created .env from .env.example. Fill in the required keys before starting the backend.
) else (
    echo ──^> .env already exists ^(left untouched^).
)

echo.
echo ✓ Setup complete. Next steps:
echo    1. Edit .env and fill in the required API keys (see .env.example for all options)
echo    2. Terminal A: cd backend ^&^& ..\%VENV_DIR%\Scripts\uvicorn.exe main:app --reload --port 8000
echo    3. Terminal B: cd frontend ^&^& npm run dev
echo    4. Open http://localhost:5173 and log in with procurement@demo.com

endlocal
