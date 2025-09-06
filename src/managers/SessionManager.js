// SessionManager.js

const DB_NAME = "LoopStationDB";
const DB_VERSION = 1;
const STORE_SESSIONS = "sessions_metadata";
const STORE_BLOBS = "audio_blobs";

class SessionManager {
    constructor() {
        this.db = null;
    }
    async initDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                return resolve(this.db);
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject("Error al abrir IndexedDB.");
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                    db.createObjectStore(STORE_SESSIONS, { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                    db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
                }
            };
        });
    }
    async getSavedSessions() {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_SESSIONS, 'readonly');
            const store = transaction.objectStore(STORE_SESSIONS);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Error al obtener las sesiones.");
        });
    }

    async saveSession(sessionName, sessionData) {
        await this.initDB();

        // 1. Guardar los Blobs de audio en IndexedDB
        const blobPromises = sessionData.tracks.map(async (trackData, index) => {
            const blobId = `${sessionName}_track_${index}`;
            const transaction = this.db.transaction(STORE_BLOBS, 'readwrite');
            const store = transaction.objectStore(STORE_BLOBS);
            store.put({ id: blobId, blob: trackData.audio });
            trackData.audioBlobId = blobId; // Guardamos la referencia, no el blob en sí
            delete trackData.audio; // Eliminamos el blob del objeto de metadatos
        });
        await Promise.all(blobPromises);
        
        // 2. Guardar los metadatos (JSON) en IndexedDB
        const transaction = this.db.transaction(STORE_SESSIONS, 'readwrite');
        const store = transaction.objectStore(STORE_SESSIONS);
        store.put({ name: sessionName, data: sessionData });
        
        alert(`¡Sesión "${sessionName}" guardada!`);
    }
    async loadSession(sessionName) {
        await this.initDB();
        
        // 1. Cargar los metadatos de la sesión
        const sessionMeta = await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_SESSIONS, 'readonly');
            const store = transaction.objectStore(STORE_SESSIONS);
            const request = store.get(sessionName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Error al cargar metadatos.");
        });

        if (!sessionMeta) {
            throw new Error(`No se encontró la sesión "${sessionName}".`);
        }
        
        const sessionData = sessionMeta.data;

        // 2. Cargar los Blobs de audio correspondientes
        const blobPromises = sessionData.tracks.map(trackData => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(STORE_BLOBS, 'readonly');
                const store = transaction.objectStore(STORE_BLOBS);
                const request = store.get(trackData.audioBlobId);
                request.onsuccess = () => {
                    trackData.audio = request.result.blob; // Re-insertamos el blob
                    resolve();
                };
                request.onerror = () => reject("Error al cargar blob de audio.");
            });
        });

        await Promise.all(blobPromises);
        
        return sessionData;
    }
}

export const sessionManager = new SessionManager();
