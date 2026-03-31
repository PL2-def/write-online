/**
 * C:\Users\PL2\Documents\write\assets\js\editor.js
 * Logique liée à Quill, l'éditeur de texte, l'export et les préférences.
 */

export class EditorManager {
    constructor(containerId) {
        this.quill = new Quill(containerId, {
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

        this.setupImageDragAndDrop();
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

    // --- Exports ---
    
    exportTxt(title) {
        const text = this.getText();
        this.downloadFile(text, `${title || 'export'}.txt`, 'text/plain');
    }

    exportPdf(title) {
        const element = document.querySelector('.ql-editor');
        const opt = {
            margin: 1,
            filename: `${title || 'export'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }

    exportMd(title) {
        const turndownService = new TurndownService();
        const html = this.quill.root.innerHTML;
        const markdown = turndownService.turndown(html);
        this.downloadFile(markdown, `${title || 'export'}.md`, 'text/markdown');
    }

    downloadFile(content, fileName, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- Drag & Drop Images ---
    
    setupImageDragAndDrop() {
        const editorContainer = document.querySelector('.ql-container');
        if (!editorContainer) return;

        editorContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        editorContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = e.dataTransfer.files;
            if (files && files[0] && files[0].type.startsWith('image/')) {
                this.handleImageUpload(files[0]);
            }
        });
    }

    handleImageUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const range = this.quill.getSelection() || { index: this.quill.getLength() };
                this.quill.insertEmbed(range.index, 'image', dataUrl);
                this.quill.setSelection(range.index + 1);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Préférences ---
    
    applyPreferences(fontSettings, sizeSettings) {
        const font = fontSettings || window.localStorage.getItem('pref-font') || "'Inter', sans-serif";
        const size = sizeSettings || window.localStorage.getItem('pref-font-size') || "18px";
        
        const editor = document.querySelector('.ql-container');
        if(editor) {
            editor.style.fontFamily = font;
            editor.style.fontSize = size;
        }
    }
}
