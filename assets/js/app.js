/**
 * C:\Users\PL2\Documents\write\assets\js\app.js
 * Contrôleur principal de Write Online Revolution.
 * Support : Dossiers, Recherche, États, Tags.
 */

import { DBManager } from './db.js';
import { EditorManager } from './editor.js';
import { CollabManager } from './collab.js';
import { showToast, showLoading, hideLoading, showConfirm, showPrompt, showCustomDialog } from './ui.js';

// ---------- INITIALISATION ----------
const dbManager = new DBManager();
const editorManager = new EditorManager('#editor-container');
const collabManager = new CollabManager(editorManager);

let currentDoc = null;
let allDocs = [];
let allFolders = [];
let searchQuery = '';

// ---------- ELEMENTS UI ----------
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const docList = document.getElementById('doc-list');
const docTitleInput = document.getElementById('doc-title');
const statusSelect = document.getElementById('doc-status-select');
const newDocBtn = document.getElementById('new-doc-btn');
const newFolderBtn = document.getElementById('new-folder-btn');
const searchInput = document.getElementById('search-input');
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

// ---------- GESTION DES DOCUMENTS ET DOSSIERS ----------

async function refreshDocList() {
    allDocs = await dbManager.getAllDocs();
    allFolders = await dbManager.getAllFolders();
    
    docList.innerHTML = '';
    
    const filteredDocs = allDocs.filter(doc => {
        const titleMatch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const contentMatch = doc.content && JSON.stringify(doc.content).toLowerCase().includes(searchQuery.toLowerCase());
        return titleMatch || contentMatch;
    });

    // Afficher les dossiers
    allFolders.forEach(folder => {
        const folderEl = createFolderUI(folder, filteredDocs.filter(d => d.folderId === folder.id));
        docList.appendChild(folderEl);
    });

    // Afficher les documents sans dossier (ou tous si recherche active)
    const orphans = searchQuery 
        ? filteredDocs 
        : filteredDocs.filter(d => !d.folderId);

    if (orphans.length > 0) {
        if (searchQuery) {
            const label = document.createElement('div');
            label.style = 'font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); margin: 1rem 0 0.5rem 0.5rem;';
            label.textContent = 'Résultats de recherche';
            docList.appendChild(label);
        }
        orphans.forEach(doc => {
            docList.appendChild(createDocUI(doc));
        });
    }

    if (window.lucide) window.lucide.createIcons();
}

function createFolderUI(folder, docs) {
    const container = document.createElement('div');
    container.className = 'folder-item';
    container.id = `folder-${folder.id}`;

    const header = document.createElement('div');
    header.className = 'folder-header';
    header.innerHTML = `
        <i data-lucide="chevron-right" class="chevron-icon"></i>
        <i data-lucide="folder" style="width: 16px; color: var(--accent)"></i>
        <span style="flex: 1">${folder.name}</span>
        <i data-lucide="more-vertical" class="folder-menu-icon" style="width: 14px; opacity: 0.5"></i>
    `;

    const content = document.createElement('div');
    content.className = 'folder-content';
    
    docs.forEach(doc => {
        content.appendChild(createDocUI(doc));
    });

    header.onclick = (e) => {
        if (e.target.closest('.folder-menu-icon')) {
            e.stopPropagation();
            showFolderOptions(folder);
            return;
        }
        container.classList.toggle('open');
        const icon = header.querySelector('.chevron-icon');
        icon.style.transform = container.classList.contains('open') ? 'rotate(90deg)' : 'rotate(0deg)';
    };

    container.appendChild(header);
    container.appendChild(content);
    return container;
}

function createDocUI(doc) {
    const item = document.createElement('div');
    item.className = `doc-item ${currentDoc && currentDoc.id === doc.id ? 'active' : ''}`;
    
    const statusColors = { draft: '#94a3b8', review: '#f59e0b', final: '#10b981' };
    const color = statusColors[doc.status] || '#94a3b8';

    item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
            <span class="doc-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.title || 'Sans titre'}</span>
        </div>
        <i data-lucide="trash-2" class="delete-icon" style="width: 14px; opacity: 0.6;"></i>
    `;

    item.onclick = (e) => {
        if (e.target.closest('.delete-icon')) {
            e.stopPropagation();
            deleteDoc(doc.id);
        } else {
            loadDoc(doc);
        }
    };

    return item;
}

async function loadDoc(doc) {
    currentDoc = doc;
    docTitleInput.value = doc.title;
    statusSelect.value = doc.status || 'draft';
    editorManager.setContents(doc.content);
    refreshDocList();
}

async function saveCurrentDoc() {
    if (!currentDoc) return;
    saveIndicator.textContent = "Sauvegarde...";
    currentDoc.title = docTitleInput.value || 'Sans titre';
    currentDoc.status = statusSelect.value;
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

async function createNewDoc(folderId = null) {
    currentDoc = {
        title: 'Nouveau Document',
        content: { ops: [] },
        folderId: folderId,
        status: 'draft',
        tags: [],
        updatedAt: Date.now()
    };
    const id = await dbManager.saveDoc(currentDoc);
    currentDoc.id = id;
    loadDoc(currentDoc);
}

async function createNewFolder() {
    const name = await showPrompt("Nom du nouveau dossier :", "Mon Dossier", "Nouveau Dossier");
    if (name) {
        await dbManager.saveFolder({ name, createdAt: Date.now() });
        refreshDocList();
        showToast("Dossier créé", "success");
    }
}

async function showFolderOptions(folder) {
    const action = await showCustomDialog({
        title: folder.name,
        message: "Que voulez-vous faire ?",
        isPrompt: false
    });
    // Simplifié pour cet exemple : Suppression
    if (action) {
        const confirm = await showConfirm(`Supprimer le dossier "${folder.name}" ? (Les documents ne seront pas supprimés)`);
        if (confirm) {
            // Détacher les docs
            const docsInFolder = allDocs.filter(d => d.folderId === folder.id);
            for (const doc of docsInFolder) {
                doc.folderId = null;
                await dbManager.saveDoc(doc);
            }
            await dbManager.deleteFolder(folder.id);
            refreshDocList();
        }
    }
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

// ---------- COLLABORATION ----------

collabManager.onStateChange((state) => {
    if (!state.active) {
        presenceList.innerHTML = '';
        collabBtn.style.background = "var(--glass-bg)";
        collabBtn.style.color = "var(--text-main)";
        saveIndicator.textContent = "Collaboration arrêtée";
        return;
    }

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

    const statusBase = `En direct : ${state.roomName}`;
    saveIndicator.textContent = state.peers > 1 ? `${statusBase} - ${state.peers} en ligne` : statusBase;
    
    collabBtn.style.background = "var(--accent)";
    collabBtn.style.color = "white";
    document.getElementById('collab-modal').classList.remove('active');
});

// ---------- LOGIQUE UI & EVENTS ----------

newDocBtn.onclick = () => createNewDoc();
newFolderBtn.onclick = createNewFolder;
saveBtn.onclick = saveCurrentDoc;
collabBtn.onclick = () => document.getElementById('collab-modal').classList.add('active');

searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    refreshDocList();
};

statusSelect.onchange = saveCurrentDoc;
docTitleInput.oninput = () => {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1000);
};

// ... Autres événements (theme, distraction, etc.) inchangés ou à adapter ...

async function initApp() {
    showLoading("Initialisation du Librarian...");
    try {
        await dbManager.init();
        editorManager.applyPreferences();
        
        await refreshDocList();
        
        if (allDocs.length === 0) {
            await createNewDoc();
        } else {
            loadDoc(allDocs[0]);
        }

        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error(error);
        showToast("Erreur d'initialisation", "error");
    } finally {
        hideLoading();
    }
}

window.addEventListener('DOMContentLoaded', initApp);
