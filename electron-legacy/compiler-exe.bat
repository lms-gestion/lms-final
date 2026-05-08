@echo off
title LMS Gestion — Compilation .exe
color 0B
cls

echo.
echo  ================================================
echo   COMPILATION DU .EXE — LMS Gestion v0.0.1
echo  ================================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ERREUR] Node.js manquant. Installez-le sur nodejs.org
    pause
    exit /b
)

if not exist "node_modules\" (
    echo  [INFO] Installation des dependances...
    call npm install
)

echo  [INFO] Compilation en cours... (2-5 minutes)
echo  [INFO] Le .exe sera dans le dossier dist/
echo.

call npm run build

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo  ================================================
    echo   [SUCCES] .exe cree dans le dossier dist/
    echo  ================================================
    echo.
    start dist\
) else (
    color 0C
    echo.
    echo  [ERREUR] La compilation a echoue.
)

pause
