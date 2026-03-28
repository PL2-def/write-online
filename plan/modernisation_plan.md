# Plan de Modernisation : Write Online Revolution 🚀

Ce plan vise à transformer le fichier HTML actuel en une application web progressive (PWA) modulaire, performante et dotée d'un système de partage robuste pour GitHub Pages.

## 🎯 Objectifs
1.  **Modularité** : Séparer HTML, CSS et JavaScript.
2.  **Mode Hors-ligne (PWA)** : Rendre l'application utilisable sans connexion internet.
3.  **Partage Avancé** : Intégrer un service de partage via **GitHub Gists** (pour des URLs permanentes) et l'API **Web Share** native.
4.  **Exportation** : Ajouter le support du PDF et du Markdown.

---

## 🏗️ Phase 1 : Architecture & PWA
### 1.1 Séparation des fichiers
*   `index.html` : Structure épurée.
*   `assets/css/style.css` : Thèmes et styles (Glassmorphism).
*   `assets/js/app.js` : Logique de l'éditeur et d'IndexedDB.
*   `assets/js/db.js` : Gestionnaire de base de données (isolé).

### 1.2 Support Offline
*   Création de `sw.js` (Service Worker) pour la mise en cache des ressources critiques.
*   Enregistrement du Service Worker dans `app.js`.

---

## 🔗 Phase 2 : Le "Working Sharing Service"
Actuellement, le partage via URL est limité par la taille de l'URL (~2000 caractères). Nous allons proposer deux solutions :

### 2.1 Partage Natif (Web Share API)
*   Utiliser `navigator.share()` pour permettre le partage direct vers les applications du mobile/système (WhatsApp, Slack, Mail).

### 2.2 Publication via GitHub Gist (Optionnel/Cloud)
*   Permettre à l'utilisateur de "Publier" son document. 
*   Le texte est envoyé anonymement ou via un token à l'API GitHub Gist.
*   L'utilisateur reçoit une URL Gist propre à partager.

### 2.3 URL Sharing 2.0
*   Remplacer `LZ-String` par `pako` (Gzip) pour gagner ~20% de compression supplémentaire et augmenter la limite de caractères.

---

## 📄 Phase 3 : Export & UX
### 3.1 Nouveaux Formats d'Export
*   **PDF** : Intégration de `html2pdf.js`.
*   **Markdown** : Conversion automatique du contenu Quill vers Markdown (`turndown.js`).

### 3.2 Améliorations UX
*   **Indicateur visuel** de l'état de sauvegarde (Cloud vs Local).
*   **Menu de configuration** pour changer la police (Serif, Sans, Mono).

---

## ✅ Étapes de Vérification
1.  Vérifier que le site fonctionne en mode avion (Service Worker).
2.  Tester le partage d'un document long (via Gist ou Compression).
3.  Valider l'exportation PDF sur différents navigateurs.
