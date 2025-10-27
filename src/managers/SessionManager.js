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

            console.log("Initializing IndexedDB...");
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject("Error al abrir IndexedDB.");
            }
            
            request.onsuccess = (event) => {
                console.log("IndexedDB initialized successfully.");
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log("Upgrading IndexedDB...");
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
            request.onsuccess = () => {
                console.log("Saved sessions retrieved:", request.result);
                resolve(request.result);
            }
            request.onerror = () => {
                console.error("Error getting saved sessions:", request.error);
                reject("Error al obtener las sesiones.");
            }
        });
    }

    async saveSession(sessionName, sessionData) {
        await this.initDB();
        console.log(`Saving session: ${sessionName}`, sessionData);

        // 1. Guardar los Blobs de audio en IndexedDB
        const blobPromises = sessionData.tracks.map(async (trackData, index) => {
            if (!trackData.audio) return; // Skip tracks without audio
            const blobId = `${sessionName}_track_${index}`;
            console.log(`Saving blob: ${blobId}`);
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
        
        console.log(`Session "${sessionName}" saved successfully.`);
        alert(`¡Sesión "${sessionName}" guardada!`);
    }
    async loadSession(sessionName) {
        await this.initDB();
        console.log(`Loading session: ${sessionName}`);
        
        // 1. Cargar los metadatos de la sesión
        const sessionMeta = await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_SESSIONS, 'readonly');
            const store = transaction.objectStore(STORE_SESSIONS);
            const request = store.get(sessionName);
            request.onsuccess = () => {
                console.log("Session metadata loaded:", request.result);
                resolve(request.result);
            }
            request.onerror = () => {
                console.error("Error loading session metadata:", request.error);
                reject("Error al cargar metadatos.");
            }
        });

        if (!sessionMeta) {
            throw new Error(`No se encontró la sesión "${sessionName}".`);
        }
        
        const sessionData = sessionMeta.data;

        // 2. Cargar los Blobs de audio correspondientes
        const blobPromises = sessionData.tracks.map(trackData => {
            if (!trackData.audioBlobId) return Promise.resolve();
            return new Promise((resolve, reject) => {
                console.log(`Loading blob: ${trackData.audioBlobId}`);
                const transaction = this.db.transaction(STORE_BLOBS, 'readonly');
                const store = transaction.objectStore(STORE_BLOBS);
                const request = store.get(trackData.audioBlobId);
                request.onsuccess = () => {
                    if (request.result) {
                        trackData.audio = request.result.blob; // Re-insertamos el blob
                        console.log(`Blob ${trackData.audioBlobId} loaded successfully.`);
                    } else {
                        console.warn(`Blob ${trackData.audioBlobId} not found.`);
                    }
                    resolve();
                };
                request.onerror = () => {
                    console.error(`Error loading blob ${trackData.audioBlobId}:`, request.error);
                    reject("Error al cargar blob de audio.");
                }
            });
        });

        await Promise.all(blobPromises);
        
        console.log("Session data fully loaded:", sessionData);
        return sessionData;
    }
}

export const sessionManager = new SessionManager();
