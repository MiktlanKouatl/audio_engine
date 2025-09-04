// AudioEngine.js
// Usamos la importación selectiva para mantener el código limpio.
import { getTransport, start as startTone, Synth, Loop } from 'tone';

export class AudioEngine {
    constructor() {
        // Obtenemos la instancia del transporte principal.
        this.transport = getTransport();
        this.isReady = false;
        this.tracks = [];
    }

    /**
     * Inicia el AudioContext de Tone.js.
     * Este método DEBE ser llamado por una interacción del usuario.
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isReady) {
            return;
        }
        // startTone es la función que importamos de 'tone'
        await startTone();
        this.isReady = true;
        //Configuramos el transporte una vez que el audio está listo.
        this.transport.bpm.value = 120;
        console.log("AudioEngine listo. El AudioContext está activo.");
    }
    /**
     * Añade una nueva pista al motor.
     * @param {Track} track La instancia de la pista a añadir.
     */
    addTrack(track) {
        this.tracks.push(track);
    }
    /**
     * Inicia o detiene el transporte principal.
     */
    toggleTransport() {
        if (!this.isReady) {
            console.warn("El motor de audio no está listo. Haz clic en 'Iniciar' primero.");
            return;
        }

        if (this.transport.state === 'started') {
            this.transport.stop();
        } else {
            this.tracks.forEach(track => track.start());
            this.transport.start();
        }
    }
    /**
     * Devuelve el estado actual del transporte para que otros módulos lo consulten.
     * @returns {{position: string, state: string, bpm: number}}
     */
    getTransportState() {
        return {
            position: this.transport.position,
            state: this.transport.state,
            bpm: this.transport.bpm.value
        };
    }
}