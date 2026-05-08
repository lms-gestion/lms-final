@echo off
title LMS Gestion — La Maison des Services
color 0A
cls

echo.
echo  ================================================
echo   LA MAISON DES SERVICES — LMS Gestion v0.0.1
echo  ================================================
echo.

:: Verifier que Node.js est installe
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ERREUR] Node.js n'est pas installe !
    echo.
    echo  Telechargez Node.js sur : https://nodejs.org
    echo  Installez la version LTS puis relancez ce fichier.
    echo.
    pause
    start https://nodejs.org
    exit /b
)

echo  [OK] Node.js detecte
echo.

:: Verifier si node_modules existe
if not exist "node_modules\" (
    echo  [INFO] Premiere installation en cours...
    echo  [INFO] Telechargement d'Electron ~100 Mo - Patience...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  [ERREUR] L'installation a echoue.
        echo  Verifiez votre connexion internet et reessayez.
        echo.
        pause
        exit /b
    )
    echo.
    echo  [OK] Installation terminee !
    echo.
) else (
    echo  [OK] Modules deja installes
    echo.
)

echo  [INFO] Demarrage de LMS Gestion...
echo.
echo  ================================================
echo.

:: Lancer l'application
npm start

:: Si l'app se ferme
echo.
echo  Application fermee. Appuyez sur une touche pour quitter.
pause >nul
