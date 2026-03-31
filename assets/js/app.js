/**
 * C:\Users\PL2\Documents\write\assets\js\app.js
 * Contrôleur principal de Write Online Revolution.
 */

import { DBManager } from './db.js';
import { EditorManager } from './editor.js';
import { CollabManager } from './collab.js';
import { showToast, showLoading, hideLoading, showConfirm, showPrompt, showCustomDialog } from './ui.js';

// ---------- INITIALISATION ----------
const dbManager = new DBManager();
const editorManager = new EditorManager('#editor-container');
const collabManager = new CollabManager(editorManager);

let currentDoc = {
    title: 'Nouveau Document',
    content: null,
    updatedAt: Date.now()
};

// ---------- ELEMENTS UI ----------
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const docList = document.getElementById('doc-list');
const docTitleInput = document.getElementById('doc-title');
const newDocBtn = document.getElementById('new-doc-btn');
const saveBtn = document.getElementById('save-btn');
const shareBtn = document.getElementById('share-btn');
const distractionBtn = document.getElementById('distraction-btn');
const exportAllBtn = document.getElementById('export-all');
const exportPdfBtn = document.getElementById('export-pdf');
const exportMdBtn = document.getElementById('export-md');
const saveIndicator = document.getElementById('save-indicator');
const collabBtn = document.getElementById('collab-btn');
const presenceList = document.getElementById('presence-list');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const fontSelect = document.getElementById('font-select');
const fontSizeRange = document.getElementById('font-size-range');

// Collab Modal Elements
const collabModal = document.getElementById('collab-modal');
const closeCollab = document.getElementById('close-collab');
const createRoomInput = document.getElementById('create-room-name');
const createPassInput = document.getElementById('create-room-pass');
const joinRoomInput = document.getElementById('join-room-name');
const joinPassInput = document.getElementById('join-room-pass');
const btnCreateCollab = document.getElementById('btn-create-collab');
const btnJoinCollab = document.getElementById('btn-join-collab');

// ---------- GESTION DES DOCUMENTS ----------

async function refreshDocList() {
    const docs = await dbManager.getAllDocs();
    docList.innerHTML = ''; // Nettoyage
    
    docs.sort((a, b) => b.updatedAt - a.updatedAt).forEach(doc => {
        const item = document.createElement('div');
        item.className = `doc-item ${currentDoc && currentDoc.id === doc.id ? 'active' : ''}`;
        
        // CORRECTION XSS : Utilisation de textContent
        const span = document.createElement('span');
        span.className = 'doc-name';
        span.textContent = doc.title || 'Sans titre';
        
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'trash-2');
        icon.className = 'delete-icon';
        icon.style.width = '14px';
        icon.style.opacity = '0.6';
        
        item.appendChild(span);
        item.appendChild(icon);
        
        item.onclick = (e) => {
            if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) {
                e.stopPropagation();
                deleteDoc(doc.id);
            } else {
                loadDoc(doc);
            }
        };
        docList.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

async function loadDoc(doc) {
    currentDoc = doc;
    docTitleInput.value = doc.title;
    editorManager.setContents(doc.content);
    refreshDocList();
}

async function saveCurrentDoc() {
    if (!currentDoc) return;
    saveIndicator.textContent = "Sauvegarde...";
    currentDoc.title = docTitleInput.value || 'Sans titre';
    currentDoc.content = editorManager.getContents();
    currentDoc.updatedAt = Date.now();
    const id = await dbManager.saveDoc(currentDoc);
    if (!currentDoc.id) currentDoc.id = id;
    refreshDocList();
    setTimeout(() => {
        if (!collabManager.provider) {
            saveIndicator.textContent = "Enregistré localement";
        }
    }, 500);
}

async function createNewDoc() {
    currentDoc = {
        title: 'Nouveau Document',
        content: { ops: [] },
        updatedAt: Date.now()
    };
    const id = await dbManager.saveDoc(currentDoc);
    currentDoc.id = id;
    loadDoc(currentDoc);
}

async function deleteDoc(id) {
    const confirmed = await showConfirm('Êtes-vous sûr de vouloir supprimer ce document ?', 'Supprimer ce document');
    if (confirmed) {
        await dbManager.deleteDoc(id);
        if (currentDoc && currentDoc.id === id) {
            const docs = await dbManager.getAllDocs();
            if (docs.length > 0) loadDoc(docs[0]);
            else createNewDoc();
        } else {
            refreshDocList();
        }
    }
}

// ---------- SYSTÈME DE PARTAGE ----------

async function shareDocument() {
    const text = editorManager.getText().trim();
    if (!text) return;

    if (navigator.share) {
        try {
            await navigator.share({
                title: docTitleInput.value || 'Document',
                text: text
            });
            return;
        } catch (e) { }
    }

    const compressed = LZString.compressToEncodedURIComponent(text);
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
    
    if (shareUrl.length > 2000) {
        showToast('Le document est trop long pour être partagé. Utilisez l\'export.', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Lien de partage copié dans le presse-papier !', 'success');
    } catch {
        await showPrompt('Copiez ce lien :', shareUrl, 'Partage');
    }
}


// ---------- GESTION DE LA COLLABORATION ----------

collabManager.onStateChange((state) => {
    if (!state.active) {
        presenceList.innerHTML = '';
        collabBtn.style.background = "var(--glass-bg)";
        collabBtn.style.color = "var(--text-main)";
        saveIndicator.textContent = "Collaboration arrêtée";
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    // Mise à jour de la présence UI
    presenceList.innerHTML = '';
    state.states.forEach((s) => {
        if (s.user) {
            const avatar = document.createElement('div');
            avatar.className = 'presence-avatar';
            avatar.style.backgroundColor = s.user.color;
            avatar.textContent = s.user.name.charAt(0).toUpperCase();
            avatar.setAttribute('data-name', s.user.name);
            presenceList.appendChild(avatar);
        }
    });

    const statusBase = `En direct : ${state.roomName}${state.password ? ' (Chiffré)' : ' (Public)'}`;
    saveIndicator.textContent = state.peers > 1 ? `${statusBase} - ${state.peers} en ligne` : statusBase;
    
    collabBtn.style.background = "var(--accent)";
    collabBtn.style.color = "white";
    
    collabModal.classList.remove('active');
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomName}`;
    window.history.replaceState({}, document.title, newUrl);
});

function toggleCollaboration() {
    if (collabManager.provider) {
        collabManager.stopCollaboration();
        return;
    }
    createRoomInput.value = `write-online-${Math.random().toString(36).substring(7)}`;
    collabModal.classList.add('active');
}

closeCollab.onclick = () => collabModal.classList.remove('active');

btnCreateCollab.onclick = async () => {
    const room = createRoomInput.value.trim();
    const pass = createPassInput.value.trim();
    if (!room) return showToast("Veuillez donner un nom à la salle.", 'error');
    if (!pass) {
        const proceed = await showConfirm("Sans mot de passe, votre session n'est pas chiffrée. Continuer ?", "⚠️ Attention");
        if (!proceed) return;
    }
    const success = await collabManager.startCollaboration(room, pass);
    if (!success) return; 
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room}`;
    try { await navigator.clipboard.writeText(inviteUrl); } catch { }
    showToast(`Session démarrée ! Lien copié. ${pass ? "Donnez le mot de passe." : ""}`, 'success');
};

btnJoinCollab.onclick = async () => {
    const room = joinRoomInput.value.trim();
    const pass = joinPassInput.value.trim();
    if (!room) return showToast("Nom de salle manquant.", 'error');
    await collabManager.startCollaboration(room, pass);
};

// ---------- LOGIQUE UI & EVENTS ----------

themeToggle.onclick = () => {
    const current = body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', next);
    themeToggle.innerHTML = `<i data-lucide="${next === 'light' ? 'moon' : 'sun'}"></i>`;
    if (window.lucide) window.lucide.createIcons();
    localStorage.setItem('theme', next);
};

toggleSidebar.onclick = () => {
    sidebar.classList.toggle('collapsed');
    body.classList.toggle('sidebar-collapsed');
};

newDocBtn.onclick = createNewDoc;
saveBtn.onclick = saveCurrentDoc;
shareBtn.onclick = shareDocument;
collabBtn.onclick = toggleCollaboration;

distractionBtn.onclick = () => {
    body.classList.toggle('distraction-free');
    const isDistraction = body.classList.contains('distraction-free');
    distractionBtn.innerHTML = `<i data-lucide="${isDistraction ? 'minimize' : 'maximize'}"></i>`;
    if (window.lucide) window.lucide.createIcons();
};

let wordCountTimer;
editorManager.onTextChange(() => {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1500);

    clearTimeout(wordCountTimer);
    wordCountTimer = setTimeout(() => {
        const text = editorManager.getText().trim();
        const words = text.length > 0 ? text.split(/\s+/).length : 0;
        const readTime = Math.ceil(words / 200);
        document.getElementById('word-count').textContent = words;
        document.getElementById('read-time').textContent = readTime;
    }, 500);
});

docTitleInput.oninput = () => {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1000);
};

exportAllBtn.onclick = () => editorManager.exportTxt(docTitleInput.value);
exportPdfBtn.onclick = () => editorManager.exportPdf(docTitleInput.value);
exportMdBtn.onclick = () => editorManager.exportMd(docTitleInput.value);

// ---------- PARAMÈTRES ----------

settingsBtn.onclick = () => settingsModal.classList.add('active');
closeSettings.onclick = () => settingsModal.classList.remove('active');

fontSelect.onchange = () => {
    const font = fontSelect.value;
    localStorage.setItem('pref-font', font);
    editorManager.applyPreferences();
};

fontSizeRange.oninput = () => {
    const size = fontSizeRange.value + 'px';
    localStorage.setItem('pref-font-size', size);
    editorManager.applyPreferences();
};

window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
    if (e.target === collabModal) collabModal.classList.remove('active');
    const passwordModal = document.getElementById('password-modal');
    if (passwordModal && e.target === passwordModal) passwordModal.classList.remove('active');
});

// ---------- INSTALL PWA (PWA SETUP) ----------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'flex';
        installBtn.onclick = async () => {
            installBtn.style.display = 'none';
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        };
    }
});


// ---------- INITIALISATION APP ----------

async function initApp() {
    showLoading("Démarrage de Write Online...");
    try {
        await dbManager.init();
        editorManager.applyPreferences();
        
        const params = new URLSearchParams(window.location.search);
        
        // Check Action
        if (params.get('action') === 'new') {
            window.history.replaceState({}, document.title, window.location.pathname);
            await createNewDoc();
        }
        
        // Check for Collaboration Room
        const room = params.get('room');
        if (room) {
            const passwordModal = document.getElementById('password-modal');
            const submitPass = document.getElementById('btn-submit-pass');
            const cancelPass = document.getElementById('cancel-pass');
            const inputPass = document.getElementById('input-session-pass');

            if (passwordModal && submitPass && cancelPass && inputPass) {
                passwordModal.classList.add('active');
                submitPass.onclick = () => {
                    const pass = inputPass.value.trim() || null;
                    passwordModal.classList.remove('active');
                    collabManager.startCollaboration(room, pass);
                };
                cancelPass.onclick = () => {
                    passwordModal.classList.remove('active');
                    collabManager.startCollaboration(room, null);
                };
            } else {
                collabManager.startCollaboration(room, null);
            }
        }

        // Check for Shared Content (LZString)
        const data = params.get('data');
        if (data) {
            const decompressed = LZString.decompressFromEncodedURIComponent(data);
            if (decompressed) {
                const confirmed = await showConfirm("Charger le contenu partagé ?", "Document partagé");
                if (confirmed) {
                    await createNewDoc();
                    editorManager.setText(decompressed);
                    saveCurrentDoc();
                }
            }
        }

        const docs = await dbManager.getAllDocs();
        if (docs.length === 0) {
            await createNewDoc();
        } else if (!room && !params.get('action') && !data) {
            // Charger le document le plus récent par défaut
            const latestDoc = docs.sort((a, b) => b.updatedAt - a.updatedAt)[0];
            loadDoc(latestDoc);
        } else {
            // Si on est dans une salle ou une action spécifique, rafraîchir quand même la liste
            refreshDocList();
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('SW enregistré !', reg))
                    .catch(err => console.log('Erreur SW', err));
            });
        }

        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error("Erreur critique au démarrage:", error);
        showToast("Erreur lors du chargement de l'application.", "error");
    } finally {
        hideLoading();
    }
}

// Lier initApp au Window pour y avoir accès (Optionnel mais sécurisé)
window.addEventListener('DOMContentLoaded', initApp);
