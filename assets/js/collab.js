/**
 * C:\Users\PL2\Documents\write\assets\js\collab.js
 * Gestion de la collaboration P2P avec Yjs et WebRTC.
 */

import { showToast, showLoading, hideLoading } from './ui.js';

export class CollabManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.ydoc = null;
        this.provider = null;
        this.binding = null;
        this.onStateChangeCallback = null;
    }

    onStateChange(callback) {
        this.onStateChangeCallback = callback;
    }

    generateUser() {
        let userName = localStorage.getItem('collab-user-name');
        let userColor = localStorage.getItem('collab-user-color');

        if (!userName) {
            const adjectives = ['Curieux', 'Créatif', 'Inspiré', 'Vif', 'Sage', 'Audacieux'];
            const nouns = ['Écrivain', 'Plume', 'Auteur', 'Poète', 'Liseur', 'Scribe'];
            userName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${Math.floor(Math.random() * 100)}`;
            userColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
            
            localStorage.setItem('collab-user-name', userName);
            localStorage.setItem('collab-user-color', userColor);
        }

        return { userName, userColor };
    }

    stopCollaboration() {
        if (this.provider) this.provider.destroy();
        if (this.ydoc) this.ydoc.destroy();
        if (this.binding) this.binding.destroy();
        
        this.provider = null;
        this.ydoc = null;
        this.binding = null;
        
        if (this.onStateChangeCallback) this.onStateChangeCallback({ active: false });
    }

    async startCollaboration(roomName, password = null) {
        if (!roomName) return false;
        
        showLoading(`Connexion à ${roomName}...`);
        
        try {
            const [{ Doc }, { WebrtcProvider }, { QuillBinding }, { default: QuillCursors }] = await Promise.all([
                import('https://esm.sh/yjs@13.6.8'),
                import('https://esm.sh/y-webrtc@10.3.0?deps=yjs@13.6.8'),
                import('https://esm.sh/y-quill@0.1.5?deps=yjs@13.6.8'),
                import('https://esm.sh/quill-cursors@4.0.2')
            ]);

            // Register Cursors if not already registered
            if (!window.Quill.imports['modules/cursors']) {
                window.Quill.register('modules/cursors', QuillCursors);
            }

            this.ydoc = new Doc();
            const options = password ? { password: password } : {};
            this.provider = new WebrtcProvider(roomName, this.ydoc, options);
            
            const { userName, userColor } = this.generateUser();

            this.provider.awareness.setLocalStateField('user', {
                name: userName,
                color: userColor
            });

            this.provider.on('synced', isSynced => {
                if (isSynced) showToast("Synchronisé avec la salle", "success");
            });

            this.provider.awareness.on('change', () => {
                if (this.onStateChangeCallback) {
                    const states = this.provider.awareness.getStates();
                    this.onStateChangeCallback({ 
                        active: true, 
                        peers: Array.from(states.keys()).length,
                        states: Array.from(states.values()),
                        roomName,
                        password
                    });
                }
            });
            
            const quill = this.editorManager.getQuillInstance();
            const ytext = this.ydoc.getText('quill');
            
            this.binding = new QuillBinding(ytext, quill, this.provider.awareness);

            hideLoading();
            
            if (this.onStateChangeCallback) {
                this.onStateChangeCallback({ 
                    active: true, 
                    peers: 1, 
                    states: Array.from(this.provider.awareness.getStates().values()), 
                    roomName, 
                    password 
                });
            }
            
            return true;
        } catch (e) {
            console.error("Erreur Collab:", e);
            hideLoading();
            showToast("Impossible de démarrer la collaboration.", 'error');
            return false;
        }
    }
}
