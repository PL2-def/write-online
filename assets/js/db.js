/**
 * C:\Users\PL2\Documents\write\assets\js\db.js
 * Gestion de la base de données locale via IndexedDB.
 */

export class DBManager {
    constructor() {
        this.dbName = 'WriteOnlineDB';
        this.dbVersion = 1;
        this.db = null;
        this._initPromise = null;
    }

    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
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
}
