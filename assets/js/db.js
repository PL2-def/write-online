/**
 * C:\Users\PL2\Documents\write\assets\js\db.js
 * Gestion de la base de données locale via IndexedDB.
 * Version 2: Support des Dossiers et Tags.
 */

export class DBManager {
    constructor() {
        this.dbName = 'WriteOnlineDB';
        this.dbVersion = 2; // Passage à la version 2
        this.db = null;
        this._initPromise = null;
    }

    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Documents
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
                }
                
                // Dossiers
                if (!db.objectStoreNames.contains('folders')) {
                    db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                }

                // Migration Version 1 -> 2
                const transaction = e.target.transaction;
                if (e.oldVersion < 2) {
                    // Les nouveaux champs seront ajoutés automatiquement lors de la sauvegarde si absents
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onerror = (e) => {
                this._initPromise = null;
                reject(new Error("Erreur d'initialisation IndexedDB: " + e.target.error));
            };
        });

        return this._initPromise;
    }

    async ensureDb() {
        if (!this.db) await this.init();
    }

    // ---------- DOCUMENTS ----------

    async getAllDocs() {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['documents'], 'readonly');
                const store = transaction.objectStore('documents');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async saveDoc(doc) {
        await this.ensureDb();
        // Valeurs par défaut pour les nouveaux champs
        if (!doc.folderId) doc.folderId = null;
        if (!doc.tags) doc.tags = [];
        if (!doc.status) doc.status = 'draft';

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['documents'], 'readwrite');
                const store = transaction.objectStore('documents');
                const request = store.put(doc);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async deleteDoc(id) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['documents'], 'readwrite');
                const store = transaction.objectStore('documents');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    // ---------- DOSSIERS ----------

    async getAllFolders() {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['folders'], 'readonly');
                const store = transaction.objectStore('folders');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async saveFolder(folder) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['folders'], 'readwrite');
                const store = transaction.objectStore('folders');
                const request = store.put(folder);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    async deleteFolder(id) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['folders'], 'readwrite');
                const store = transaction.objectStore('folders');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }
}
