/**
 * C:\Users\PL2\Documents\write\assets\js\db.js
 * Gestion de la base de données locale via IndexedDB.
 */

export class DBManager {
    constructor() {
        this.dbName = 'WriteOnlineDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
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
            request.onerror = (e) => reject(e);
        });
    }

    async getAllDocs() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['documents'], 'readonly');
            const store = transaction.objectStore('documents');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }

    async saveDoc(doc) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');
            const request = store.put(doc);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async deleteDoc(id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['documents'], 'readwrite');
            const store = transaction.objectStore('documents');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
        });
    }
}
