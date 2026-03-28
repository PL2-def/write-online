/**
 * C:\Users\PL2\Documents\write\assets\js\app.js
 * Logique principale de Write Online Revolution.
 */

import { DBManager } from './db.js';

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
const saveIndicator = document.getElementById('save-indicator');

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
    if (confirm('Supprimer ce document ?')) {
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

// ---------- SYSTÈME DE PARTAGE (Le service qui marche) ----------

async function shareDocument() {
    const text = quill.getText().trim();
    if (!text) return;

    // 1. Essayer l'API Web Share (Natif)
    if (navigator.share) {
        try {
            await navigator.share({
                title: docTitleInput.value,
                text: text,
                url: window.location.href
            });
            return;
        } catch (err) {
            console.log("Web Share annulé ou échoué", err);
        }
    }

    // 2. Fallback : Partage par URL compressée (LZ-String)
    const compressed = LZString.compressToEncodedURIComponent(text);
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
    
    if (url.length > 2048) {
        // 3. Fallback ultime : Proposition de publication Gist (Simulée par un lien externe)
        if (confirm("Le document est trop long pour un lien direct. Voulez-vous créer un Gist GitHub pour le partager ?")) {
            const gistUrl = `https://gist.github.com/?content=${encodeURIComponent(text)}`;
            window.open(gistUrl, '_blank');
        }
    } else {
        navigator.clipboard.writeText(url);
        alert("Lien de partage optimisé copié dans le presse-papier !");
    }
}

// ---------- LOGIQUE UI & EVENTS ----------

// Thème
themeToggle.onclick = () => {
    const current = body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', next);
    themeToggle.innerHTML = `<i data-lucide="${next === 'light' ? 'moon' : 'sun'}"></i>`;
    lucide.createIcons();
    localStorage.setItem('theme', next);
};

// Sidebar
toggleSidebar.onclick = () => sidebar.classList.toggle('collapsed');
newDocBtn.onclick = createNewDoc;
saveBtn.onclick = saveCurrentDoc;
shareBtn.onclick = shareDocument;
collabBtn.onclick = toggleCollaboration;

// Mode Concentration
distractionBtn.onclick = () => {
    body.classList.toggle('distraction-free');
    const isDistraction = body.classList.contains('distraction-free');
    distractionBtn.innerHTML = `<i data-lucide="${isDistraction ? 'minimize' : 'maximize'}"></i>`;
    lucide.createIcons();
};

// Stats & Auto-save
quill.on('text-change', () => {
    const text = quill.getText().trim();
    const words = text.length > 0 ? text.split(/\s+/).length : 0;
    const readTime = Math.ceil(words / 200);
    document.getElementById('word-count').textContent = words;
    document.getElementById('read-time').textContent = readTime;
    
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1500);
});

docTitleInput.oninput = () => {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(saveCurrentDoc, 1000);
};

// Export TXT
exportAllBtn.onclick = () => {
    const text = quill.getText();
    downloadFile(text, `${docTitleInput.value || 'export'}.txt`, 'text/plain');
};

// Export PDF
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

// Export Markdown
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
window.onclick = (e) => { if(e.target === settingsModal) settingsModal.classList.remove('active'); };

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

// Appliquer les préférences
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
    
    // Check URL Params
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    if (data) {
        const decompressed = LZString.decompressFromEncodedURIComponent(data);
        if (decompressed && confirm("Charger le contenu partagé ?")) {
            await createNewDoc();
            quill.setText(decompressed);
            saveCurrentDoc();
        }
    }

    const docs = await dbManager.getAllDocs();
    if (docs.length === 0) await createNewDoc();
    else loadDoc(docs[0]);

    // Register Service Worker
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
