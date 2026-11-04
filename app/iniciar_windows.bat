@echo off
setlocal
cd /d "%~dp0"
title Mercado & Financas - Servidor local

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 iniciar_servidor.py
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python iniciar_servidor.py
    goto :end
)

echo Python 3 nao foi encontrado.
echo Instale o Python 3 ou abra a pasta no Visual Studio Code e use a extensao Live Server.
echo IMPORTANTE: nao abra index.html diretamente com duplo clique.
pause

:end
endlocal
