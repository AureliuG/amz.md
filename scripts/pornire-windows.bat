@echo off
REM Pornire pentru test pe un calculator Windows din oficiu (necesită Node.js 22 LTS de pe nodejs.org).
REM Dublu-click pe acest fișier. Apoi deschideți http://localhost:3000 în Chrome.
REM Parolele se pun în fișierul .env.local (vezi .env.example). Fără ele, aplicația e deschisă în rețeaua locală.
cd /d "%~dp0\.."
where node >nul 2>nul || (echo Instalati Node.js 22 LTS de pe https://nodejs.org si porniti din nou. & pause & exit /b 1)
if not exist node_modules (echo Instalez componentele... & call npm ci || (pause & exit /b 1))
echo Pregatesc aplicatia (1-2 minute)...
call npm run build || (pause & exit /b 1)
echo.
echo Aplicatia porneste la http://localhost:3000  (inchideti fereastra pentru a o opri)
call npm start
pause
