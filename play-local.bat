@echo off
rem Plays the arcade from a tiny local web server (needs Python).
rem You don't need this: double-clicking index.html works too. The server just
rem makes sure every browser shares your coins between the games.
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo Python isn't installed, so just double-click index.html instead.
  pause
  exit /b
)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000/"
echo Arcade running at http://localhost:8000/  (close this window to stop)
%PY% -m http.server 8000
