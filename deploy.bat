@echo off
SETLOCAL EnableDelayedExpansion
title 🚀 Write Online Revolution - Déploiement Intelligent

:: --- CONFIGURATION ---
set REPO_URL=https://github.com/PL2-def/write-online.git
set BRANCH=main
set VERSION_FILE=.version
set TARGET_FILE=index.html

echo.
echo  [1/5] 🔍 Vérification de l'environnement...
echo ------------------------------------------

:: Vérifier si Git est installé
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Git n'est pas installe. Impossible de continuer.
    goto :error_exit
)

:: Vérifier s'il y a des changements à commit
git diff --quiet && git diff --cached --quiet
if %errorlevel% equ 0 (
    echo [INFO] Aucun changement detecte. Le projet est deja a jour.
    goto :end_script
)

:: Calcul du poids du dossier (en Mo)
for /f "usebackq" %%a in (`powershell -NoProfile -Command "(Get-ChildItem -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB"`) do set FOLDER_SIZE=%%a
:: Arrondir à 2 décimales
for /f "delims=," %%i in ("%FOLDER_SIZE%") do set FOLDER_SIZE=%%i

echo [OK] Modifications detectees.
echo [DATA] Taille totale du projet : ~%FOLDER_SIZE% Mo

echo.
echo  [2/5] 🔢 Mise à jour de la Version...
echo ------------------------------------------

if not exist %VERSION_FILE% (
    echo 1 > %VERSION_FILE%
    set CURRENT_VERSION=1
) else (
    set /p CURRENT_VERSION=<%VERSION_FILE%
    set /a CURRENT_VERSION=!CURRENT_VERSION! + 1
    echo !CURRENT_VERSION! > %VERSION_FILE%
)

:: Injection de la version dans le HTML
powershell -Command "(Get-Content %TARGET_FILE%) -replace 'v\d+\.\d+\.\d+|v\d+', 'v!CURRENT_VERSION!' | Set-Content %TARGET_FILE%"
echo [OK] Passage a la version : !CURRENT_VERSION!

echo.
echo  [3/5] 📊 Rapport de modifications...
echo ------------------------------------------

echo Fichiers impactes :
git diff --stat
echo.
for /f "tokens=1-6" %%a in ('git diff --shortstat') do (
    echo [RESUME] %%a fichiers modifies, %%c insertions, %%e suppressions.
)

echo.
echo  [4/5] 📦 Indexation et Commit...
echo ------------------------------------------

git add .
set timestamp=%DATE% %TIME%
git commit -m "🚀 v!CURRENT_VERSION! - Update Auto (!timestamp!)" -q
if %errorlevel% neq 0 (
    echo [ERREUR] Echec du commit.
    goto :error_exit
)
echo [OK] Commit effectue.

echo.
echo  [5/5] ☁️ Envoi vers GitHub...
echo ------------------------------------------

git push origin %BRANCH% --force
if %errorlevel% neq 0 (
    echo [ERREUR] Le push a echoue (verifiez votre connexion ou vos droits).
    goto :error_exit
)

echo.
echo ======================================================
echo  ✅ DEPLOIEMENT REUSSI ! (Version !CURRENT_VERSION!)
echo  🌍 URL : https://pl2-def.github.io/write-online/
echo  📦 Taille : ~%FOLDER_SIZE% Mo
echo ======================================================

:end_script
echo.
echo Appuyez sur une touche pour quitter...
pause >nul
exit /b

:error_exit
echo.
echo ******************************************************
echo  ❌ UNE ERREUR EST SURVENUE DURANT LE PROCESSUS.
echo  Consultez les messages ci-dessus pour debugger.
echo ******************************************************
echo.
echo Le script est en pause pour vous permettre de lire l'erreur.
pause
exit /b