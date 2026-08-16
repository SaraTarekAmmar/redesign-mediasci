@echo off
setlocal enabledelayedexpansion
title MediaSci Operation Hub

REM ============================================================
REM  Runs the split app (FastAPI backend + React frontend).
REM  This .bat lives in the project root and runs from there.
REM ============================================================
cd /d "%~dp0"
set "BACKEND_DIR=%CD%\backend"
set "FRONTEND_DIR=%CD%\frontend"

if not exist "%BACKEND_DIR%\main.py" (
    echo [ERROR] Could not find backend\main.py.
    echo Make sure this launcher is run from the repository root.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Could not find frontend\package.json.
    echo Make sure this launcher is run from the repository root.
    pause
    exit /b 1
)

echo ============================================
echo   MediaSci Operation Hub - starting...
echo ============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found on your PATH.
    echo Install Python 3.11+ or add it to PATH, then run this again.
    pause
    exit /b 1
)

where pip >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip was not found on your PATH.
    echo Install pip, then run this again.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Install Node.js, then run this again.
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\.deps-installed" (
    echo Installing backend Python dependencies...
    pushd "%BACKEND_DIR%"
    call pip install -r requirements.txt
    if errorlevel 1 (
        popd
        echo [ERROR] Backend dependency install failed.
        pause
        exit /b 1
    )
    type nul > ".deps-installed"
    popd
    echo.
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo Installing frontend Node dependencies...
    pushd "%FRONTEND_DIR%"
    call npm install
    popd
    echo.
)

echo Starting backend at http://127.0.0.1:8000 ...
start "MediaSci Operation Hub - Server (keep open)" cmd /k "cd /d ""%BACKEND_DIR%"" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting frontend at http://127.0.0.1:5173/app ...
start "MediaSci Operation Hub - Frontend (keep open)" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

timeout /t 6 /nobreak >nul
start "" "http://127.0.0.1:5173/app"

echo.
echo   Frontend:  http://127.0.0.1:5173/app
echo   Backend:   http://127.0.0.1:8000
echo   Login:     superadmin@taskflow.dev  /  password
echo.
echo   Leave both "Server" and "Frontend" windows open while using the app.
echo   Close them to stop the app.
echo.
endlocal
