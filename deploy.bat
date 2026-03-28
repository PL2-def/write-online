@echo off
SETLOCAL EnableDelayedExpansion
title 🚀 Write Online Revolution - Déploiement Intelligent

:: --- CONFIGURATION ---
set REPO_URL=https://github.com/PL2-def/write-online.git
set BRANCH=main

echo.
echo  [1/4] 🔍 Vérification de l'environnement...
echo ------------------------------------------

:: Vérifier si Git est installé
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Git n'est pas installé sur ce système.
    pause
    exit /b
)

:: Vérifier les fichiers critiques
set MISSING_FILES=0
if not exist "index.html" set MISSING_FILES=1
if not exist "sw.js" set MISSING_FILES=1
if not exist "assets\js\app.js" set MISSING_FILES=1

if %MISSING_FILES% equ 1 (
    echo [ERREUR] Fichiers critiques manquants. Vérifiez votre structure.
    pause
    exit /b
)

echo [OK] Structure de fichiers valide.

echo.
echo  [2/4] 🛠️ Préparation de Git...
echo ------------------------------------------

:: Initialisation si nécessaire
if not exist ".git" (
    echo Initialisation du dépôt Git...
    git init -q
    git remote add origin %REPO_URL%
)

:: Vérifier le remote
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    git remote add origin %REPO_URL%
)

echo.
echo  [3/4] 📦 Indexation et Commit...
echo ------------------------------------------

:: Ajouter les fichiers
git add .

:: Créer le message de commit avec la date
set timestamp=%DATE% %TIME%
echo Création du commit : Mise à jour du !timestamp!
git commit -m "🚀 Update Auto (!timestamp!) - Write Online Revolution" -q

echo.
echo  [4/4] ☁️ Envoi vers GitHub...
echo ------------------------------------------

:: Tenter le push
git push origin %BRANCH% --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo  ✅ DEPLOIEMENT REUSSI !
    echo  🌍 URL : https://pl2-def.github.io/write-online/
    echo ======================================================
) else (
    echo.
    echo [ERREUR] Le push a échoué. Vérifiez votre connexion ou vos accès.
)

echo.
echo Appuyez sur une touche pour quitter...
pause >nul
