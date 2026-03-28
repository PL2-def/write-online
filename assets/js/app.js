/**
 * C:\Users\PL2\Documents\write\assets\js\app.js
 * Logique principale de Write Online Revolution.
 */

import { DBManager } from './db.js';
import { showToast, showLoading, hideLoading, showConfirm, showPrompt, showCustomDialog } from './ui.js';

// ---------- INITIALISATION ----------
const dbManager = new DBManager();
let currentDoc = {
    title: 'Nouveau Document',
    content: null,
    updatedAt: Date.now()
};

// Initialisation de Quill
const quill = new Quill('#editor-container', {
    theme: 'snow',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'blockquote', 'code-block'],
            ['clean']
        ]
    },
    placeholder: 'Commencez l\'histoire ici...'
});

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
    docList.innerHTML = '';
    docs.sort((a, b) => b.updatedAt - a.updatedAt).forEach(doc => {
        const item = document.createElement('div');
        item.className = `doc-item ${currentDoc && currentDoc.id === doc.id ? 'active' : ''}`;
        item.innerHTML = `
            <span class="doc-name">${doc.title || 'Sans titre'}</span>
            <i data-lucide="trash-2" class="delete-icon" style="width: 14px; opacity: 0.6"></i>
        `;
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
    lucide.createIcons();
}

async function loadDoc(doc) {
    currentDoc = doc;
    docTitleInput.value = doc.title;
    quill.setContents(doc.content || { ops: [] });
    refreshDocList();
}

async function saveCurrentDoc() {
    if (!currentDoc) return;
    saveIndicator.textContent = "Sauvegarde...";
    currentDoc.title = docTitleInput.value || 'Sans titre';
    currentDoc.content = quill.getContents();
    currentDoc.updatedAt = Date.now();
    const id = await dbManager.saveDoc(currentDoc);
    if (!currentDoc.id) currentDoc.id = id;
    refreshDocList();
    setTimeout(() => {
        saveIndicator.textContent = "Enregistré localement";
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
    const text = quill.getText().trim();
    if (!text) return;

    // Tentative de partage natif (mobile / navigateurs compatibles)
    if (navigator.share) {
        try {
            await navigator.share({
                title: docTitleInput.value || 'Document',
                text: text
            });
            return;
        } catch (e) {
            // L'utilisateur a annulé ou l'API n'est pas supportée
        }
    }

    // Fallback : lien compressé LZString
    const compressed = LZString.compressToEncodedURIComponent(text);
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
    
    if (shareUrl.length > 2000) {
        showToast('Le document est trop long pour être partagé via un lien. Utilisez l\'export à la place.', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Lien de partage copié dans le presse-papier !', 'success');
    } catch {
        // Fallback si clipboard échoue
        const result = await showPrompt('Copiez ce lien :', shareUrl, 'Partage');
    }
}

// ---------- SYSTÈME DE COLLABORATION ----------

let ydoc, provider, binding;

function toggleCollaboration() {
    if (provider) {
        // Déconnexion rapide si déjà actif
        stopCollaboration();
        return;
    }
    
    // Pré-remplir un nom de salle aléatoire
    createRoomInput.value = `write-online-${Math.random().toString(36).substring(7)}`;
    collabModal.classList.add('active');
}

function stopCollaboration() {
    if (provider) provider.destroy();
    if (ydoc) ydoc.destroy();
    if (binding) binding.destroy();
    provider = null;
    collabBtn.style.background = "var(--glass-bg)";
    collabBtn.style.color = "var(--accent)";
    saveIndicator.textContent = "Collaboration arrêtée";
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function startCollaboration(roomName, password = null) {
    if (!roomName) return;
    
    showLoading(`Connexion à ${roomName}...`);
    saveIndicator.textContent = "Connexion Collab...";
    
    try {
        // Chargement dynamique des dépendances P2P via ESM
        const [{ Doc }, { WebrtcProvider }, { QuillBinding }] = await Promise.all([
            import('https://esm.sh/yjs@13.6.8'),
            import('https://esm.sh/y-webrtc@10.3.0?deps=yjs@13.6.8'),
            import('https://esm.sh/y-quill@0.1.5?deps=yjs@13.6.8')
        ]);

        ydoc = new Doc();
        const options = password ? { password: password } : {};
        provider = new WebrtcProvider(roomName, ydoc, options);
        
        provider.on('synced', isSynced => {
            if (isSynced) {
                showToast("Synchronisé avec la salle", "success");
            } else {
                showToast("Perte de synchronisation avec les autres participants.", "error");
            }
        });

        provider.awareness.on('change', () => {
            const peers = Array.from(provider.awareness.getStates().keys()).length;
            if (peers > 1) {
                saveIndicator.textContent = `En direct : ${roomName}${password ? ' (Chiffré)' : ' (Public)'} - ${peers} en ligne`;
            } else {
                saveIndicator.textContent = `En direct : ${roomName}${password ? ' (Chiffré)' : ' (Public)'}`;
            }
        });
        
        const ytext = ydoc.getText('quill');
        binding = new QuillBinding(ytext, quill, null);

        collabBtn.style.background = "var(--accent)";
        collabBtn.style.color = "white";
        saveIndicator.textContent = `En direct : ${roomName}${password ? ' (Chiffré)' : ' (Public)'}`;
        
        collabModal.classList.remove('active');

        // Mettre à jour l'URL (sans mot de passe)
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomName}`;
        window.history.replaceState({}, document.title, newUrl);
        hideLoading();
        return true;
    } catch (e) {
        console.error("Erreur Collab:", e);
        saveIndicator.textContent = "Erreur Collab";
        hideLoading();
        showToast("Impossible de démarrer la collaboration. Vérifiez votre connexion.", 'error');
        return false;
    }
}

// Events pour le modal Collab
closeCollab.onclick = () => collabModal.classList.remove('active');

btnCreateCollab.onclick = async () => {
    const room = createRoomInput.value.trim();
    const pass = createPassInput.value.trim();
    
    if (!room) return showToast("Veuillez donner un nom à la salle.", 'error');
    
    if (!pass) {
        const proceed = await showConfirm("Sans mot de passe, votre session n'est pas chiffrée. Continuer ?", "⚠️ Attention");
        if (!proceed) return;
    }

    const success = await startCollaboration(room, pass);
    if (!success) return; // Ne pas afficher l'alerte si une erreur s'est produite
    
    // Copier le lien
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room}`;
    try {
        await navigator.clipboard.writeText(inviteUrl);
    } catch { } // Fallback quietly
    
    showToast(`Session démarrée ! Lien copié. ${pass ? "Donnez le mot de passe." : ""}`, 'success');
};

btnJoinCollab.onclick = async () => {
    const room = joinRoomInput.value.trim();
    const pass = joinPassInput.value.trim();
    
    if (!room) return showToast("Veuillez entrer le nom de la salle à rejoindre.", 'error');
    
    await startCollaboration(room, pass);
};

// Fermeture des modals en cliquant sur l'overlay
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
    if (e.target === collabModal) collabModal.classList.remove('active');
    const passwordModal = document.getElementById('password-modal');
    if (passwordModal && e.target === passwordModal) passwordModal.classList.remove('active');
});

// ---------- LOGIQUE UI & EVENTS ----------

themeToggle.onclick = () => {
    const current = body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', next);
    themeToggle.innerHTML = `<i data-lucide="${next === 'light' ? 'moon' : 'sun'}"></i>`;
    lucide.createIcons();
    localStorage.setItem('theme', next);
};

toggleSidebar.onclick = () => sidebar.classList.toggle('collapsed');
newDocBtn.onclick = createNewDoc;
saveBtn.onclick = saveCurrentDoc;
shareBtn.onclick = shareDocument;
collabBtn.onclick = toggleCollaboration;

distractionBtn.onclick = () => {
    body.classList.toggle('distraction-free');
    const isDistraction = body.classList.contains('distraction-free');
    distractionBtn.innerHTML = `<i data-lucide="${isDistraction ? 'minimize' : 'maximize'}"></i>`;
    lucide.createIcons();
};

let wordCountTimer;
quill.on('text-change', () => {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1500);

    clearTimeout(wordCountTimer);
    wordCountTimer = setTimeout(() => {
        const text = quill.getText().trim();
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

exportAllBtn.onclick = () => {
    const text = quill.getText();
    downloadFile(text, `${docTitleInput.value || 'export'}.txt`, 'text/plain');
};

exportPdfBtn.onclick = () => {
    const element = document.querySelector('.ql-editor');
    const opt = {
        margin: 1,
        filename: `${docTitleInput.value || 'export'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

exportMdBtn.onclick = () => {
    const turndownService = new TurndownService();
    const html = quill.root.innerHTML;
    const markdown = turndownService.turndown(html);
    downloadFile(markdown, `${docTitleInput.value || 'export'}.md`, 'text/markdown');
};

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

// ---------- PARAMÈTRES ----------

settingsBtn.onclick = () => settingsModal.classList.add('active');
closeSettings.onclick = () => settingsModal.classList.remove('active');

fontSelect.onchange = () => {
    const font = fontSelect.value;
    document.querySelector('.ql-container').style.fontFamily = font;
    localStorage.setItem('pref-font', font);
};

fontSizeRange.oninput = () => {
    const size = fontSizeRange.value + 'px';
    document.querySelector('.ql-container').style.fontSize = size;
    localStorage.setItem('pref-font-size', size);
};

function applyPreferences() {
    const font = localStorage.getItem('pref-font') || "'Inter', sans-serif";
    const size = localStorage.getItem('pref-font-size') || "18px";
    
    fontSelect.value = font;
    fontSizeRange.value = parseInt(size);
    
    const editor = document.querySelector('.ql-container');
    if(editor) {
        editor.style.fontFamily = font;
        editor.style.fontSize = size;
    }
}

// ---------- INITIALISATION APP ----------

async function initApp() {
    await dbManager.init();
    applyPreferences();
    
    const params = new URLSearchParams(window.location.search);
    
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
                startCollaboration(room, pass);
            };

            cancelPass.onclick = () => {
                passwordModal.classList.remove('active');
                // Rejoindre sans mot de passe (session publique)
                startCollaboration(room, null);
            };
        } else {
            // Fallback si le modal n'existe pas
            startCollaboration(room, null);
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
                quill.setText(decompressed);
                saveCurrentDoc();
            }
        }
    }

    const docs = await dbManager.getAllDocs();
    if (docs.length === 0) await createNewDoc();
    else if (!room) loadDoc(docs[0]); // Ne pas charger le doc local si on est en collab

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW enregistré !', reg))
                .catch(err => console.log('Erreur SW', err));
        });
    }

    lucide.createIcons();
}

initApp();
