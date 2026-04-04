/**
 * C:\Users\PL2\Documents\write\assets\js\app.js
 * Contrôleur principal de Write Online Revolution.
 * Support : Dossiers, Recherche, États, Tags.
 */

import { DBManager } from './db.js';
import { EditorManager } from './editor.js';
import { CollabManager } from './collab.js';
import { showToast, showLoading, hideLoading, showConfirm, showPrompt, showCustomDialog } from './ui.js';
import { initEffects, powerMode } from './effects.js';

// ---------- INITIALISATION ----------
const dbManager = new DBManager();
const editorManager = new EditorManager('#editor-container'); // Instanciate, but don't init yet
const collabManager = new CollabManager(editorManager);

let currentDoc = null;
let allDocs = [];
let allFolders = [];
let searchQuery = '';
let lastWordCount = 0;
const WORD_GOAL = 1000;

const QUOTES = [
    "« L'écriture est la peinture de la voix. » — Voltaire",
    "« On n'est pas un écrivain parce qu'on a choisi de dire certaines choses, mais parce qu'on a choisi de les dire d'une certaine façon. » — Jean-Paul Sartre",
    "« Écrire, c'est une façon de parler sans être interrompu. » — Jules Renard",
    "« Un livre est une fenêtre par laquelle on s'évade. » — Julien Green",
    "« L'encre des savants est aussi précieuse que le sang des martyrs. » — Mahomet",
    "« Écrire, c'est aussi ne pas parler. C'est se taire. C'est hurler sans bruit. » — Marguerite Duras"
];

// ---------- ELEMENTS UI ----------
// ---------- ELEMENTS UI ----------
const docListEl = document.getElementById('doc-list');
const newDocBtn = document.getElementById('new-doc-btn');
const newFolderBtn = document.getElementById('new-folder-btn');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');
const exportAllBtn = document.getElementById('export-all');
const exportPdfBtn = document.getElementById('export-pdf');
const exportMdBtn = document.getElementById('export-md');
const settingsBtn = document.getElementById('settings-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const docTitleInput = document.getElementById('doc-title');
const docStatusSelect = document.getElementById('doc-status-select');
const saveIndicator = document.getElementById('save-indicator');
const saveBtn = document.getElementById('save-btn');
const shareBtn = document.getElementById('share-btn');
const distractionBtn = document.getElementById('distraction-btn');
const collabBtn = document.getElementById('collab-btn');
const wordCountEl = document.getElementById('word-count');
const readTimeEl = document.getElementById('read-time');
const progressBar = document.getElementById('reading-progress-bar');
const quoteEl = document.getElementById('sidebar-quote');
const premiumThemeSelect = document.getElementById('theme-select-premium');
const soundToggle = document.getElementById('sound-toggle');

// ---------- INITIALISATION APP ----------

async function initApp() {
    showLoading("Initialisation de l'application...");
    try {
        await dbManager.init();
        await editorManager.init();
        editorManager.applyPreferences();
        
        setupEventListeners();
        await refreshDocList();
        
        // Initialiser les effets visuels (Power Mode, Typewriter)
        initEffects(editorManager.quill);
        
        // Charger le dernier document ouvert ou le plus récent
        const lastId = localStorage.getItem('last-doc-id');
        let initialDoc = allDocs.find(d => d.id == lastId);
        if (!initialDoc && allDocs.length > 0) {
            initialDoc = [...allDocs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        }
        
        if (initialDoc) {
            loadDoc(initialDoc);
        } else {
            createNewDoc();
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('SW enregistré !', reg))
                    .catch(err => console.log('Erreur SW', err));
            });
        }

        if (window.lucide) window.lucide.createIcons();
        
        displayRandomQuote();
        initPremiumFeatures();
    } catch (error) {
        console.error(error);
        showToast("Erreur d'initialisation", "error");
    } finally {
        hideLoading();
    }
}

// ---------- FONCTIONS COEURS ----------

async function refreshDocList() {
    allDocs = await dbManager.getAllDocs();
    allFolders = await dbManager.getAllFolders();
    
    renderDocList();
}

function renderDocList() {
    docListEl.innerHTML = '';
    
    const query = searchQuery.toLowerCase();
    const filteredDocs = allDocs.filter(d => 
        d.title.toLowerCase().includes(query) || 
        (d.tags && d.tags.some(t => t.toLowerCase().includes(query)))
    );

    // Rendre les dossiers
    allFolders.forEach(folder => {
        const folderDocs = filteredDocs.filter(d => d.folderId === folder.id);
        if (folderDocs.length === 0 && query !== '') return; // Cacher dossiers vides si recherche

        const folderEl = document.createElement('div');
        folderEl.className = 'folder-item';
        folderEl.innerHTML = `
            <div class="folder-header" data-id="${folder.id}">
                <i data-lucide="chevron-right" class="chevron-icon"></i>
                <i data-lucide="folder" style="color: var(--accent); fill: rgba(59, 130, 246, 0.1)"></i>
                <span class="folder-name">${folder.name}</span>
                <span class="folder-count">${folderDocs.length}</span>
            </div>
            <div class="folder-content" id="folder-${folder.id}"></div>
        `;
        
        docListEl.appendChild(folderEl);
        
        const contentEl = folderEl.querySelector('.folder-content');
        folderDocs.forEach(doc => {
            contentEl.appendChild(createDocElement(doc, query));
        });
    });

    // Rendre les documents racines (pas de dossier)
    const rootDocs = filteredDocs.filter(d => !d.folderId);
    rootDocs.forEach(doc => {
        docListEl.appendChild(createDocElement(doc, query));
    });

    if (window.lucide) window.lucide.createIcons();
}

function createDocElement(doc, query = '') {
    const el = document.createElement('div');
    el.className = `doc-item ${currentDoc && currentDoc.id === doc.id ? 'active' : ''}`;
    
    let titleHtml = doc.title || 'Sans titre';
    if (query && titleHtml.toLowerCase().includes(query)) {
        const regex = new RegExp(`(${query})`, 'gi');
        titleHtml = titleHtml.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
            <div class="doc-status-dot status-${doc.status || 'draft'}"></div>
            <i data-lucide="file-text" style="width: 14px; opacity: 0.7;"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${titleHtml}</span>
        </div>
        <button class="delete-doc-btn" data-id="${doc.id}" title="Supprimer">
            <i data-lucide="trash-2" style="width: 14px;"></i>
        </button>
    `;
    
    el.onclick = (e) => {
        if (e.target.closest('.delete-doc-btn')) return;
        loadDoc(doc);
    };

    const deleteBtn = el.querySelector('.delete-doc-btn');
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const conf = await showConfirm(`Supprimer "${doc.title}" ?`);
        if (conf) {
            await dbManager.deleteDoc(doc.id);
            if (currentDoc && currentDoc.id === doc.id) {
                currentDoc = null;
                const next = allDocs.find(d => d.id !== doc.id);
                if (next) loadDoc(next);
                else createNewDoc();
            }
            await refreshDocList();
            showToast("Document supprimé");
        }
    };
    
    return el;
}

async function loadDoc(doc) {
    if (currentDoc && currentDoc.id === doc.id) return;
    
    const editorCard = document.querySelector('.editor-card');
    
    // Animation de sortie
    editorCard.classList.add('fade-out');
    
    setTimeout(async () => {
        currentDoc = doc;
        localStorage.setItem('last-doc-id', doc.id);
        
        docTitleInput.value = doc.title || '';
        docStatusSelect.value = doc.status || 'draft';
        editorManager.setContents(doc.content);
        
        updateStats();
        renderDocList();
        
        // Animation d'entrée
        editorCard.classList.remove('fade-out');
        editorCard.classList.add('fade-in');
        
        setTimeout(() => {
            editorCard.classList.remove('fade-in');
        }, 600);
        
        if (window.innerWidth < 768) {
            sidebar.classList.add('collapsed');
        }
    }, 400); // Durée du fade-out
}

async function createNewDoc(folderId = null) {
    const newDoc = {
        title: 'Nouveau Document',
        content: { ops: [] },
        status: 'draft',
        folderId: folderId,
        updatedAt: Date.now(),
        tags: []
    };
    const id = await dbManager.saveDoc(newDoc);
    newDoc.id = id;
    await refreshDocList();
    loadDoc(newDoc);
}

async function createNewFolder() {
    const name = await showPrompt("Nom du nouveau dossier :");
    if (name) {
        const newFolder = { name, createdAt: Date.now() };
        await dbManager.saveFolder(newFolder);
        await refreshDocList();
    }
}

let saveTimeout;
function saveCurrentDoc() {
    if (!currentDoc) return;
    
    saveIndicator.textContent = "Enregistrement...";
    updateFavicon(true);
    clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        currentDoc.title = docTitleInput.value;
        currentDoc.status = docStatusSelect.value;
        currentDoc.content = editorManager.getContents();
        currentDoc.updatedAt = Date.now();
        
        await dbManager.saveDoc(currentDoc);
        saveIndicator.textContent = "Enregistré";
        updateStats();
        updateFavicon(false);
        
        const activeItem = docListEl.querySelector(`.doc-item.active span`);
        if (activeItem) activeItem.textContent = currentDoc.title || 'Sans titre';
    }, 1000);
}

function updateStats() {
    const text = editorManager.getText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const time = Math.ceil(words / 200);
    
    wordCountEl.textContent = words;
    readTimeEl.textContent = time;
    
    // Update Progress Bar
    const progress = Math.min((words / WORD_GOAL) * 100, 100);
    if (progressBar) progressBar.style.width = `${progress}%`;

    // Milestone Celebration
    if (words > 0 && words % 100 === 0 && words !== lastWordCount) {
        triggerCelebration();
    }
    lastWordCount = words;
}

function triggerCelebration() {
    if (window.confetti) {
        window.confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#60a5fa', '#ffffff']
        });
        showToast(`Félicitations ! Cap des ${wordCountEl.textContent} mots atteint !`, "success");
    }
}

function displayRandomQuote() {
    if (quoteEl) {
        const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        quoteEl.textContent = quote;
    }
}

function playClickSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);

        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        console.warn("Audio disabled or blocked");
    }
}

function updateFavicon(hasUnsavedChanges) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0, 32, 32);
        if (hasUnsavedChanges) {
            ctx.beginPath();
            ctx.arc(24, 8, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        const link = document.querySelector('link[rel*="icon"]');
        link.href = canvas.toDataURL('image/x-icon');
    };
    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✍️</text></svg>';
}

function initPremiumFeatures() {
    const typewriterToggle = document.getElementById('typewriter-mode-toggle');
    const powerModeToggle = document.getElementById('power-mode-toggle');
    const spellcheckToggle = document.getElementById('spellcheck-toggle');
    const fontSizeRange = document.getElementById('font-size-range');
    const editorWidthRange = document.getElementById('editor-width-range');
    const lineHeightRange = document.getElementById('line-height-range');
    const focusOpacityRange = document.getElementById('focus-opacity-range');
    const fontSelect = document.getElementById('font-select');

    // --- TAB LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        };
    });

    // --- THEME GRID LOGIC ---
    const themeCards = document.querySelectorAll('.theme-card');
    const currentTheme = localStorage.getItem('theme') || 'light';
    themeCards.forEach(card => {
        if (card.dataset.themeVal === currentTheme) card.classList.add('active');
        card.onclick = () => {
            const next = card.dataset.themeVal;
            themeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            document.body.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        };
    });

    // --- EDITOR SETTINGS ---
    
    // Font Family
    const savedFont = localStorage.getItem('pref-font') || "'Inter', sans-serif";
    fontSelect.value = savedFont;
    document.body.style.setProperty('--font-editor', savedFont);
    fontSelect.onchange = (e) => {
        localStorage.setItem('pref-font', e.target.value);
        document.body.style.setProperty('--font-editor', e.target.value);
    };

    // Font Size
    const savedFontSize = localStorage.getItem('pref-font-size') || '18';
    fontSizeRange.value = savedFontSize;
    document.getElementById('val-font-size').textContent = savedFontSize;
    document.body.style.setProperty('--editor-font-size', savedFontSize + 'px');
    fontSizeRange.oninput = (e) => {
        const val = e.target.value;
        document.getElementById('val-font-size').textContent = val;
        document.body.style.setProperty('--editor-font-size', val + 'px');
        localStorage.setItem('pref-font-size', val);
    };

    // Editor Width
    const savedWidth = localStorage.getItem('pref-editor-width') || '850';
    editorWidthRange.value = savedWidth;
    document.getElementById('val-editor-width').textContent = savedWidth;
    document.body.style.setProperty('--editor-max-width', savedWidth + 'px');
    editorWidthRange.oninput = (e) => {
        const val = e.target.value;
        document.getElementById('val-editor-width').textContent = val;
        document.body.style.setProperty('--editor-max-width', val + 'px');
        localStorage.setItem('pref-editor-width', val);
    };

    // Line Height
    const savedLineHeight = localStorage.getItem('pref-line-height') || '1.8';
    lineHeightRange.value = savedLineHeight;
    document.getElementById('val-line-height').textContent = savedLineHeight;
    document.body.style.setProperty('--editor-line-height', savedLineHeight);
    lineHeightRange.oninput = (e) => {
        const val = e.target.value;
        document.getElementById('val-line-height').textContent = val;
        document.body.style.setProperty('--editor-line-height', val);
        localStorage.setItem('pref-line-height', val);
    };

    // Focus Opacity
    const savedFocusOpacity = localStorage.getItem('pref-focus-opacity') || '0';
    focusOpacityRange.value = savedFocusOpacity;
    document.getElementById('val-focus-opacity').textContent = savedFocusOpacity;
    document.body.style.setProperty('--focus-opacity', savedFocusOpacity / 100);
    focusOpacityRange.oninput = (e) => {
        const val = e.target.value;
        document.getElementById('val-focus-opacity').textContent = val;
        document.body.style.setProperty('--focus-opacity', val / 100);
        localStorage.setItem('pref-focus-opacity', val);
    };

    // Spellcheck
    const spellcheckEnabled = localStorage.getItem('pref-spellcheck') !== 'false';
    spellcheckToggle.checked = spellcheckEnabled;
    const qlEditor = document.querySelector('.ql-editor');
    if (qlEditor) qlEditor.setAttribute('spellcheck', spellcheckEnabled);
    spellcheckToggle.onchange = (e) => {
        const active = e.target.checked;
        localStorage.setItem('pref-spellcheck', active);
        if (qlEditor) qlEditor.setAttribute('spellcheck', active);
    };

    // Typewriter
    const typewriterEnabled = localStorage.getItem('typewriter-mode') === 'true';
    if (typewriterToggle) {
        typewriterToggle.checked = typewriterEnabled;
        if (typewriterEnabled) document.body.classList.add('typewriter-active');
        typewriterToggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem('typewriter-mode', active);
            document.body.classList.toggle('typewriter-active', active);
        };
    }

    // Power Mode
    const powerEnabled = localStorage.getItem('power-mode') === 'true';
    if (powerModeToggle) {
        powerModeToggle.checked = powerEnabled;
        powerModeToggle.onchange = (e) => {
            powerMode.toggle(e.target.checked);
        };
    }
}

function setupEventListeners() {
    newDocBtn.onclick = () => createNewDoc();
    newFolderBtn.onclick = () => createNewFolder();
    
    searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        renderDocList();
    };
    
    docTitleInput.oninput = saveCurrentDoc;
    docStatusSelect.onchange = saveCurrentDoc;
    editorManager.onTextChange(saveCurrentDoc);
    
    toggleSidebarBtn.onclick = () => {
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
    };
    
    themeToggle.onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        
        const oldIcon = themeToggle.querySelector('i, svg');
        if (oldIcon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
            themeToggle.replaceChild(newIcon, oldIcon);
            if (window.lucide) window.lucide.createIcons();
        }
    };
    
    exportAllBtn.onclick = () => editorManager.exportTxt(docTitleInput.value);
    exportPdfBtn.onclick = () => editorManager.exportPdf(docTitleInput.value);
    exportMdBtn.onclick = () => editorManager.exportMd(docTitleInput.value);
    
    const toggleDistractionFree = async () => {
        if (!distractionBtn) return;
        const isFree = document.body.classList.toggle('distraction-free');
        
        if (isFree) {
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) {
                console.warn("Fullscreen API failed", err);
            }
        } else {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.warn("Exit Fullscreen failed", err);
            }
        }
        
        const oldIcon = distractionBtn.querySelector('i, svg');
        if (oldIcon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', isFree ? 'minimize' : 'maximize');
            distractionBtn.replaceChild(newIcon, oldIcon);
            if (window.lucide) window.lucide.createIcons();
        }
    };

    distractionBtn.onclick = toggleDistractionFree;

    // Listen for Escape key to exit distraction-free mode
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('distraction-free')) {
            toggleDistractionFree();
        }
    });

    // Handle browser-initiated fullscreen exit (e.g. Esc key handled by browser)
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && document.body.classList.contains('distraction-free')) {
            document.body.classList.remove('distraction-free');
            const oldIcon = distractionBtn.querySelector('i, svg');
            if (oldIcon) {
                const newIcon = document.createElement('i');
                newIcon.setAttribute('data-lucide', 'maximize');
                distractionBtn.replaceChild(newIcon, oldIcon);
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

    saveBtn.onclick = () => {
        saveCurrentDoc();
        showToast("Enregistré", "success");
    };

    collabBtn.onclick = () => document.getElementById('collab-modal').classList.add('active');
    document.getElementById('close-collab').onclick = () => document.getElementById('collab-modal').classList.remove('active');
    
    settingsBtn.onclick = () => document.getElementById('settings-modal').classList.add('active');
    document.getElementById('close-settings').onclick = () => document.getElementById('settings-modal').classList.remove('active');
    
    // Folder toggling
    docListEl.addEventListener('click', (e) => {
        const header = e.target.closest('.folder-header');
        if (header) {
            const folderId = header.getAttribute('data-id');
            const parent = header.closest('.folder-item');
            parent.classList.toggle('open');
            const content = document.getElementById(`folder-${folderId}`);
            content.classList.toggle('active');
        }
    });

    window.addEventListener('wiki-link-click', async (e) => {
        const title = e.detail;
        let doc = allDocs.find(d => d.title.toLowerCase() === title.toLowerCase());
        if (!doc) {
            const conf = await showConfirm(`Le document "${title}" n'existe pas. Créer ?`);
            if (conf) {
                await createNewDoc();
                docTitleInput.value = title;
                saveCurrentDoc();
            }
        } else {
            loadDoc(doc);
        }
    });
}
window.addEventListener('DOMContentLoaded', initApp);
