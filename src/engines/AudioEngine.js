// AudioEngine.js
// Usamos la importación selectiva para mantener el código limpio.
import { Track } from '../modules/Track.js';
import { getTransport, start as startTone} from 'tone';

export class AudioEngine {
    constructor() {
        // Obtenemos la instancia del transporte principal.
        this.transport = getTransport();
        this.isReady = false;
        this.tracks = [];
        //Definimos la longitud de nuestro loop maestro ---
        this.loopLengthInMeasures = 4; // Un loop de 4 compases
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
        this.transport.bpm.value = 120;
        //Configuramos el transporte para que funcione en un ciclo
        this.transport.loop = true;
        this.transport.loopStart = 0;
        this.transport.loopEnd = `${this.loopLengthInMeasures}m`; // Loop de 4 compases

        console.log("AudioEngine listo. El AudioContext está activo.");
    }

    /**
     * Permite cambiar la longitud del loop dinámicamente.
     * @param {number} measures La nueva longitud del loop en compases.
     */
    setLoopLength(measures) {
        this.loopLengthInMeasures = measures;
        if (this.isReady) {
            this.transport.loopEnd = `${measures}m`;
            console.log(`Nueva longitud del loop: ${measures} compases.`);
        }
    }

    /**
     * Añade una nueva pista al motor.
     * @param {Track} track La instancia de la pista a añadir.
     */
    addTrack(track) {
        this.tracks.push(track);
    }

    /**
     * Crea una nueva pista, la añade al motor y la devuelve.
     * @param {RecorderModule} recorderModule La referencia al módulo de grabación.
     * @returns {Track} La instancia de la nueva pista creada.
     */
    createNewTrack(recorderModule) {
        const newTrackId = this.tracks.length + 1;
        const newTrack = new Track(`Pista ${newTrackId}`, recorderModule);
        this.addTrack(newTrack);
        console.log(`Pista ${newTrackId} creada dinámicamente.`);
        return newTrack;
    }

    /**
     * Elimina una pista del motor de forma segura, asegurando la limpieza de memoria.
     * @param {Track} trackToDelete La instancia de la pista que se va a eliminar.
     */
    deleteTrack(trackToDelete) {
        const trackIndex = this.tracks.indexOf(trackToDelete);
        
        if (trackIndex > -1) {
            // 1. Lo más importante: le decimos a la pista que libere sus recursos.
            trackToDelete.dispose();
            
            // 2. Después, la eliminamos de la lista de pistas activas.
            this.tracks.splice(trackIndex, 1);
            console.log(`Pista "${trackToDelete.name}" eliminada del motor.`);
        }
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
            // Al detener, reiniciamos la posición al principio del loop.
            this.transport.position = 0; 
        } else {
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