// AudioEngine.js
// Usamos la importación selectiva para mantener el código limpio.
import { Track } from '../modules/Track.js';
import { getTransport, start as startTone, Synth, Loop, Recorder, getDestination, Volume} from 'tone';

export class AudioEngine {
    constructor() {
        // Obtenemos la instancia del transporte principal.
        this.transport = getTransport();
        this.isReady = false;
        this.tracks = [];
        this.trackIdCounter = 0; 
        // Nodo de Volumen Maestro.
        this.masterOut = new Volume(0).toDestination();
        //Definimos la longitud de nuestro loop maestro ---
        this.loopLengthInMeasures = 4; // Un loop de 4 compases
        // ¡NUEVO! Componentes del metrónomo
        this.metronomeSynth = null;
        this.metronomeLoop = null;
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
        // Creamos el sinte del metrónomo aquí se conecta al masterOut
        this.metronomeSynth = new Synth().connect(this.masterOut);

        this.isReady = true;
        this.transport.bpm.value = 120;
        //Configuramos el transporte para que funcione en un ciclo
        this.transport.loop = true;
        this.transport.loopStart = 0;
        this.transport.loopEnd = `${this.loopLengthInMeasures}m`; // Loop de 4 compases

         // Creamos el loop del metrónomo
        this.metronomeLoop = new Loop(time => {
            // Un pulso simple en cada tiempo (negra)
            this.metronomeSynth.triggerAttackRelease("C2", "16n", time);
        }, "4n").start(0);
        
        // Por defecto, el metrónomo está apagado (volumen a -infinito)
        this.metronomeSynth.volume.value = -Infinity;

        console.log("AudioEngine listo. El AudioContext está activo.");
    }
    /**
     *
     * @param {number} db El nuevo volumen en decibelios.
     */
    setMetronomeVolume(db) {
        if (this.metronomeSynth) {
            this.metronomeSynth.volume.value = db;
        }
    }
    /**
     * 
     * @param {*} isOn 
     */
    toggleMetronome(isOn) {
        if (this.metronomeSynth) {
            if (isOn) {
                this.metronomeSynth.volume.value = -12; // Un volumen audible pero no molesto
            } else {
                this.metronomeSynth.volume.value = -Infinity;
            }
        }
    }
    /*
    * Permite ajustar el volumen maestro del motor de audio.
    *
    * @param {number} db El nuevo volumen en decibelios.
    */
    setMasterVolume(db) {
        this.masterOut.volume.value = db;
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
        // Usamos el contador y luego lo incrementamos.
        const newTrackId = ++this.trackIdCounter; 
        const newTrack = new Track(`Pista ${newTrackId}`, recorderModule, this.masterOut);
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

    // Método para serializar la sesión completa.
    serialize() {
        return {
            bpm: this.transport.bpm.value,
            loopLength: this.loopLengthInMeasures,
            // Filtramos las pistas que no tengan datos y las serializamos
            tracks: this.tracks.map(track => track.serialize()).filter(t => t !== null)
        };
    }
    // Método para cargar una sesión completa en el motor.
    async loadSessionData(sessionData) {
        this.transport.bpm.value = sessionData.bpm;
        this.setLoopLength(sessionData.loopLength);
        
        // Limpiamos las pistas existentes
        this.tracks.forEach(t => t.dispose());
        this.tracks = [];
        
        for (const trackData of sessionData.tracks) {
            const newTrack = this.createNewTrack(this.recorderModule); // Asumiendo que recorderModule está disponible
            await newTrack.loadData(trackData);
        }
    }
    /**
     * Une (bounce) varias pistas en una sola pista de audio nueva.
     * @param {Track[]} tracksToBounce Un array con las instancias de las pistas a unir.
     * @returns {Promise<void>}
     */
    async bounceTracks(tracksToBounce) {
        if (tracksToBounce.length < 2) {
            alert("Debes seleccionar al menos dos pistas para unir.");
            return;
        }
        console.log("[BOUNCE] Iniciando proceso de unión...");

        const bounceRecorder = new Recorder();
        const mainDestination = getDestination();

        tracksToBounce.forEach(track => {
            track.channel.disconnect(mainDestination);
            track.channel.connect(bounceRecorder);
        });

        // Usamos una promesa para que el exterior sepa cuándo hemos terminado.
        return new Promise((resolve, reject) => {
            // Agendamos el inicio de la grabación interna, esto es fiable.
            this.transport.scheduleOnce(startTime => {
                bounceRecorder.start();
                console.log(`[BOUNCE] Grabadora interna capturando ciclo en t=${startTime.toFixed(2)}`);

                // ¡AQUÍ VIENE EL OJO BIÓNICO!
                let previousBar = -1;
                let animationFrameId = null;

                const watchForLoopEnd = async () => {
                    const [currentBar] = this.transport.position.split(':').map(parseFloat);

                    if (previousBar === -1) {
                        previousBar = Math.floor(currentBar);
                    }

                    // Si el compás actual es menor que el anterior, el loop ha terminado.
                    if (Math.floor(currentBar) < previousBar) {
                        cancelAnimationFrame(animationFrameId); // Detenemos el observador

                        try {
                            const blob = await bounceRecorder.stop();
                            console.log(`[BOUNCE] Grabación interna finalizada.`);

                            const newTrack = this.createNewTrack(this.recorderModule);
                            await newTrack.loadData({
                                name: `Mezcla (${tracksToBounce.length})`,
                                volume: 0, pan: 0, mute: false, audio: blob
                            });

                            console.log("[BOUNCE] Eliminando pistas originales...");
                            tracksToBounce.forEach(track => this.deleteTrack(track));

                            bounceRecorder.dispose();
                            console.log("[BOUNCE] Proceso completado.");
                            resolve(); // Resolvemos la promesa principal
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        previousBar = Math.floor(currentBar);
                        animationFrameId = requestAnimationFrame(watchForLoopEnd);
                    }
                };
                // Iniciamos el observador
                watchForLoopEnd();

            }, "0");
        });
    }
}