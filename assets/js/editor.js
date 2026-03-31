import { showCustomDialog, showToast } from './ui.js';

// --- CUSTOM BLOTS ---

// Wiki-liens
const Inline = window.Quill.import('blots/inline');
class WikiLinkBlot extends Inline {
    static create(value) {
        const node = super.create();
        node.setAttribute('data-wiki-title', value);
        node.textContent = `[[${value}]]`;
        node.onclick = () => {
            window.dispatchEvent(new CustomEvent('wiki-link-click', { detail: value }));
        };
        return node;
    }
    static formats(node) {
        return node.getAttribute('data-wiki-title');
    }
}
WikiLinkBlot.blotName = 'wiki-link';
WikiLinkBlot.className = 'wiki-link';
WikiLinkBlot.tagName = 'span';
window.Quill.register(WikiLinkBlot);

// Image Déplaçable Librement
const BlockEmbed = window.Quill.import('blots/block/embed');
class DraggableImageBlot extends BlockEmbed {
    static create(value) {
        const node = super.create();
        node.setAttribute('src', value.url || value);
        node.setAttribute('class', 'draggable-img');
        if (value.x) node.style.left = value.x;
        if (value.y) node.style.top = value.y;
        if (value.width) node.style.width = value.width;
        if (value.height) node.style.height = value.height;
        if (value.zIndex) node.style.zIndex = value.zIndex;
        return node;
    }
    static value(node) {
        return {
            url: node.getAttribute('src'),
            x: node.style.left,
            y: node.style.top,
            width: node.style.width,
            height: node.style.height,
            zIndex: node.style.zIndex
        };
    }
}
DraggableImageBlot.blotName = 'draggable-image';
DraggableImageBlot.tagName = 'img';
window.Quill.register(DraggableImageBlot);

export class EditorManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.quill = null;
    }

    async init() {
        this.quill = new window.Quill(this.containerId, {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            },
            placeholder: 'Commencez l\'histoire ici...'
        });

        this.setupFileDragAndDrop();
        this.setupWikiLinkAutoFormat();
        this.setupImageDragging(); // Activer le déplacement libre
        return this;
    }

    setupImageDragging() {
        const container = this.quill.container;
        const editor = container.querySelector('.ql-editor');
        let selectedImg = null;
        let transformer = null;

        const createTransformer = (img) => {
            if (transformer) transformer.remove();
            
            transformer = document.createElement('div');
            transformer.className = 'img-transformer';
            
            // Handles
            const handles = ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'];
            handles.forEach(h => {
                const handle = document.createElement('div');
                handle.className = `tf-handle tf-handle-${h}`;
                transformer.appendChild(handle);
            });

            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.className = 'tf-toolbar';
            toolbar.innerHTML = `
                <button class="tf-btn" data-action="center" title="Centrer"><i data-lucide="align-center"></i></button>
                <button class="tf-btn" data-action="front" title="Premier plan"><i data-lucide="layers"></i></button>
                <button class="tf-btn" data-action="back" title="Arrière-plan"><i data-lucide="layers-2"></i></button>
                <button class="tf-btn tf-btn-danger" data-action="delete" title="Supprimer"><i data-lucide="trash-2"></i></button>
            `;
            transformer.appendChild(toolbar);
            
            // Size readout
            const readout = document.createElement('div');
            readout.className = 'tf-readout';
            readout.style.display = 'none';
            transformer.appendChild(readout);

            if (window.lucide) window.lucide.createIcons({ scope: toolbar });

            container.appendChild(transformer);
            updateTransformerPos();

            // Handle actions
            toolbar.onclick = (e) => {
                const btn = e.target.closest('.tf-btn');
                if (!btn) return;
                const action = btn.dataset.action;
                if (action === 'center') {
                    const editorEl = container.querySelector('.ql-editor');
                    const cw = editorEl.scrollWidth;
                    const iw = img.offsetWidth;
                    img.style.left = `${(cw - iw) / 2}px`;
                    updateTransformerPos();
                } else if (action === 'front') {
                    img.style.zIndex = (parseInt(img.style.zIndex) || 100) + 1;
                } else if (action === 'back') {
                    img.style.zIndex = (parseInt(img.style.zIndex) || 100) - 1;
                } else if (action === 'delete') {
                    const blot = window.Quill.find(img);
                    if (blot) blot.remove();
                    deselect();
                }
            };
        };

        const updateReadout = (w, h) => {
            if (!transformer) return;
            const readout = transformer.querySelector('.tf-readout');
            if (readout) {
                readout.textContent = `${Math.round(w)} × ${Math.round(h)}`;
                readout.style.display = 'block';
            }
        };

        const updateTransformerPos = () => {
            if (!selectedImg || !transformer) return;
            const rect = selectedImg.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            transformer.style.left = `${rect.left - containerRect.left + container.scrollLeft}px`;
            transformer.style.top = `${rect.top - containerRect.top + container.scrollTop}px`;
            transformer.style.width = `${rect.width}px`;
            transformer.style.height = `${rect.height}px`;
        };

        const deselect = () => {
            if (selectedImg) selectedImg.classList.remove('selected');
            if (transformer) transformer.remove();
            selectedImg = null;
            transformer = null;
        };

        container.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.tf-handle');
            const img = e.target.closest('.draggable-img');
            
            if (handle || img) {
                const targetImg = img || selectedImg;
                if (!targetImg) return;

                if (selectedImg !== targetImg) {
                    deselect();
                    selectedImg = targetImg;
                    selectedImg.classList.add('selected');
                    createTransformer(selectedImg);
                }
                
                // Dragging logic
                let isResizing = !!handle;
                let handleType = isResizing ? handle.className.split('tf-handle-')[1] : null;

                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = selectedImg.offsetWidth;
                const startHeight = selectedImg.offsetHeight;
                const startLeft = parseInt(selectedImg.style.left) || selectedImg.offsetLeft;
                const startTop = parseInt(selectedImg.style.top) || selectedImg.offsetTop;
                const aspectRatio = startWidth / startHeight;

                const onMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;

                    const containerRect = container.getBoundingClientRect();

                    if (isResizing) {
                        let newW = startWidth;
                        let newH = startHeight;
                        let newL = startLeft;
                        let newT = startTop;

                        if (handleType.includes('r')) newW = startWidth + dx;
                        if (handleType.includes('l')) { newW = startWidth - dx; newL = startLeft + dx; }
                        if (handleType.includes('b')) newH = startHeight + dy;
                        if (handleType.includes('t')) { newH = startHeight - dy; newT = startTop + dy; }

                        // Aspect Ratio Lock for corners
                        if (['tl', 'tr', 'bl', 'br'].includes(handleType)) {
                            if (Math.abs(dx) > Math.abs(dy)) {
                                newH = newW / aspectRatio;
                            } else {
                                newW = newH * aspectRatio;
                            }
                        }

                        // Constraints
                        if (newW > 20 && newH > 20) {
                            selectedImg.style.width = `${newW}px`;
                            selectedImg.style.height = `${newH}px`;
                            selectedImg.style.left = `${newL}px`;
                            selectedImg.style.top = `${newT}px`;
                            updateReadout(newW, newH);
                        }
                    } else {
                        // Regular Drag - we must fix position
                        selectedImg.style.position = 'absolute';
                        selectedImg.style.opacity = '0.7';
                        let nextL = startLeft + dx;
                        let nextT = startTop + dy;
                        
                        // Bounding box (limited by scrollWidth of ql-editor or container)
                        const editorEl = container.querySelector('.ql-editor');
                        const maxL = editorEl.scrollWidth - selectedImg.offsetWidth;
                        const maxT = editorEl.scrollHeight - selectedImg.offsetHeight;
                        
                        nextL = Math.max(0, Math.min(nextL, maxL));
                        nextT = Math.max(0, Math.min(nextT, maxT));

                        selectedImg.style.left = `${nextL}px`;
                        selectedImg.style.top = `${nextT}px`;
                    }
                    updateTransformerPos();
                };

                const onUp = () => {
                    if (selectedImg) {
                        selectedImg.style.opacity = '';
                        const readout = transformer ? transformer.querySelector('.tf-readout') : null;
                        if (readout) readout.style.display = 'none';
                    }
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                e.preventDefault();
            } else if (!e.target.closest('.img-transformer')) {
                deselect();
            }
        });

        container.addEventListener('scroll', updateTransformerPos);
        window.addEventListener('resize', updateTransformerPos);
    }

    setupWikiLinkAutoFormat() {
        this.quill.on('text-change', (delta, oldDelta, source) => {
            if (source !== 'user') return;
            const text = this.quill.getText();
            const regex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;
                const title = match[1];
                
                const [blot] = this.quill.getLeaf(start);
                if (blot && blot.parent.domNode.className !== 'wiki-link') {
                    this.quill.formatText(start, end - start, 'wiki-link', title);
                }
            }
        });
    }

    setupFileDragAndDrop() {
        const container = this.quill.container;
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    await this.handleFile(file);
                }
            }
        });
    }

    async handleFile(file) {
        if (file.type.startsWith('image/')) {
            await this.handleImage(file);
        } else if (file.name.endsWith('.md')) {
            await this.handleMarkdown(file);
        } else {
            showToast(`Fichier non supporté : ${file.name}`, 'info');
        }
    }

    async handleImage(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            
            const html = `
                <div style="text-align: left; margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Taux de compression (Qualité)</label>
                    <input type="range" id="comp-range" min="0.1" max="1.0" step="0.1" value="0.7" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                        <span>Elevée (Gros)</span>
                        <span>Basse (Petit)</span>
                    </div>
                </div>
            `;
            
            const confirmed = await showCustomDialog({
                title: "Optimiser l'image",
                message: html,
                isHtml: true
            });
 
            const range = this.quill.getSelection(true);
            let finalUrl = base64;

            if (confirmed) {
                const rangeInput = document.getElementById('comp-range');
                const quality = rangeInput ? parseFloat(rangeInput.value) : 0.7;
                finalUrl = await this.compressImage(base64, quality);
            }
            
            this.quill.insertEmbed(range.index, 'draggable-image', {
                url: finalUrl,
                x: '50px',
                y: '50px'
            });
        };
        reader.readAsDataURL(file);
    }

    async compressImage(base64, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    }

    async handleMarkdown(file) {
        const text = await file.text();
        showToast(`Importation de ${file.name}...`, 'success');
        const range = this.quill.getSelection(true);
        this.quill.insertText(range.index, text);
    }

    getContents() {
        return this.quill.getContents();
    }

    setContents(content) {
        this.quill.setContents(content || { ops: [] });
    }

    getText() {
        return this.quill.getText();
    }

    setText(text) {
        this.quill.setText(text);
    }

    onTextChange(callback) {
        this.quill.on('text-change', callback);
    }

    getQuillInstance() {
        return this.quill;
    }

    applyPreferences() {
        const font = localStorage.getItem('pref-font') || "'Inter', sans-serif";
        const size = localStorage.getItem('pref-font-size') || "18px";
        const editor = document.querySelector('.ql-editor');
        if (editor) {
            editor.style.fontFamily = font;
            editor.style.fontSize = size;
        }
    }

    exportTxt(filename) {
        const text = this.getText();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename || 'document'}.txt`;
        a.click();
    }

    exportPdf(filename) {
        const element = document.querySelector('.ql-editor');
        if (!window.html2pdf) return;
        const opt = {
            margin: 1,
            filename: `${filename || 'document'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        window.html2pdf().from(element).set(opt).save();
    }

    exportMd(filename) {
        const html = document.querySelector('.ql-editor').innerHTML;
        const Turndown = window.TurndownService || window.Turndown;
        if (!Turndown) return;
        const turndownService = new Turndown();
        const markdown = turndownService.turndown(html);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename || 'document'}.md`;
        a.click();
    }
}
