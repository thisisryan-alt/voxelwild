@echo off
rem Double-click me: gets the latest code, builds everything, runs the tests, takes screenshots and builds the game.
rem Needs Unity 6000.4.11f1 (Unity Hub), Git and Git LFS. The report ends up in Logs\finish-report.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\finish.ps1" -Play %*
echo.
pause
