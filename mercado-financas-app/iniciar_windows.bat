@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start "Mercado & Finanças" http://localhost:8000
  py -3 -m http.server 8000
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "Mercado & Finanças" http://localhost:8000
  python -m http.server 8000
  goto :end
)

echo Python 3 nao foi encontrado.
echo Instale Python 3 ou abra esta pasta no VS Code e use a extensao Live Server.
pause

:end
endlocal
