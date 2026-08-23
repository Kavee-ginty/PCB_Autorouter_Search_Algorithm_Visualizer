@echo off
echo ========================================
echo AI Search Algorithm Visualizer
echo Quick Start Script
echo ========================================
echo.

echo Checking for Python...
python --version 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python not found in PATH!
    echo.
    echo If you're using pyenv, make sure to:
    echo   1. Run: pyenv global X.X.X
    echo   2. Run: pyenv rehash
    echo   3. Restart this terminal/window
    echo.
    echo Or install Python from: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo Python found!
echo.
echo Starting local HTTP server on port 8000...
echo.
echo ========================================
echo Open your browser and go to:
echo   http://localhost:8000
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

python -m http.server 8000

echo.
echo [Server stopped]
pause
