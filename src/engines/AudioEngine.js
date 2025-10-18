// AudioEngine.js
// Usamos la importación selectiva para mantener el código limpio.
import { Track } from '../modules/Track.js';
import { InstrumentTrack } from '../modules/InstrumentTrack.js';
import { RecorderModule } from '../modules/RecorderModule.js';
import { GesturePlayer } from '../modules/GesturePlayer.js';
import { pointToMusicalData } from '../modules/Notation.js'; // <-- AÑADE ESTA LÍNEA
import { getTransport, start as startTone, Synth, Loop, Recorder, getDestination, Volume, FMSynth} from 'tone';

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
        
        // Componentes
        this.metronomeSynth = null;
        this.metronomeLoop = null;
        this.activeTrack = null;
        this.gesturePlayer = new GesturePlayer();

        // ¡SOLUCIÓN! Creamos la instancia del RecorderModule aquí.
        this.recorderModule = new RecorderModule(this.transport);
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

        // ¡SOLUCIÓN! Inicializamos el micrófono aquí, como parte del gesto del usuario.
        await this.recorderModule.initializeMicrophone();

        // Creamos el sinte de previsualización
        this.previewSynth = new FMSynth({
            harmonicity: 2,
            modulationIndex: 10,
            envelope: { attack: 0.01, decay: 0.2, release: 0.2 }
        }).connect(this.masterOut);
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

        // Bucle de alta frecuencia para el GesturePlayer
        new Loop(time => {
            const currentBeats = this.transport.ticks / this.transport.PPQ;
            this.gesturePlayer.update(currentBeats, time);
        }, "60n").start(0);

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
        if (measures < 1) return; // Evitar valores no válidos
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
     * Crea una nueva pista de AUDIO, la añade al motor y la devuelve.
     * @param {string} name - El nombre para la nueva pista.
     * @returns {Track} La instancia de la nueva pista de audio.
     */
    createAudioTrack(name) {
        const newId = this.trackIdCounter++;
        const newTrack = new Track(newId, name, this.recorderModule, this.masterOut);
        this.tracks.push(newTrack);
        console.log(`Pista de Audio "${name}" (ID: ${newId}) creada.`);
        if (!this.activeTrack) {
            this.setActiveTrack(newTrack);
        }
        return newTrack;
    }

    /**
     * Crea una nueva pista de INSTRUMENTO, la añade al motor y la devuelve.
     * @param {string} name - El nombre para la nueva pista.
     * @returns {InstrumentTrack} La instancia de la nueva pista de instrumento.
     */
    createInstrumentTrack(name) {
        const newId = this.trackIdCounter++; 
        const newTrack = new InstrumentTrack(newId, name, this.masterOut, this.gesturePlayer); // Pasamos el ID al constructor
        this.tracks.push(newTrack);
        console.log(`Pista de Instrumento "${name}" (ID: ${newId}) creada.`);
        if (!this.activeTrack) {
            this.setActiveTrack(newTrack);
        }
        return newTrack;
    }
    /**
     * Busca una pista por su ID y cambia su estado de 'armado' (preparado para grabar).
     * @param {number} trackId El ID de la pista a modificar.
     * @returns {boolean|null} El nuevo estado 'isArmed' de la pista, o null si no se encontró.
     */
    toggleArmTrackById(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            track.isArmed = !track.isArmed;
            if (!track.isArmed && typeof track.clearSequence === 'function') {
                track.clearSequence();
            }
            console.log(`Pista "${track.name}" ${track.isArmed ? 'ARMADA' : 'DESARMADA'}.`);
            return track.isArmed;
        }
        return null;
    }
    
    /**
     * Establece cuál es la pista activa.
     * @param {Track|InstrumentTrack} trackToActivate - La instancia de la pista a activar.
     */
    setActiveTrack(trackToActivate) {
        this.activeTrack = trackToActivate;
        console.log(`Pista activa ahora es: "${this.activeTrack.name}"`);
        // Aquí, en el futuro, notificaremos a la VisualScene para que actualice la UI.
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
        return this.transport.state; 
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
    /**
     * Devuelve el BPM actual del transporte.
     * @returns {number}
     */
    getBPM() {
        if (this.transport) {
            return this.transport.bpm.value;
        }
        return 120; // Devuelve un valor por defecto si el transporte no está listo
    }
    /**
     * Establece un nuevo BPM para el transporte.
     * @param {number} bpm El nuevo tempo en beats por minuto.
     */
    setBPM(bpm) {
        if (this.transport) {
            this.transport.bpm.value = bpm;
        }
    }
    /**
     * Devuelve el compás actual dentro del loop maestro.
     * @returns {number} - El índice del compás actual (0-3) o -1 si está detenido.
     */
    getCurrentMeasure() {
        if (this.transport && this.transport.state === 'started') {
            const [bar] = this.transport.position.split(':');
            // Usamos el operador de módulo para que el número siempre esté dentro del rango de nuestro loop
            return parseInt(bar) % this.loopLengthInMeasures;
        }
        return -1; // No hay compás activo si el transporte está detenido
    }
    /**
     * Devuelve el tiempo (beat) actual dentro del loop maestro.
     * @returns {number} - El índice del tiempo actual (0-15) o -1 si está detenido.
     */
    getCurrentBeat() {
        if (this.transport && this.transport.state === 'started') {
            const timeSignature = this.transport.timeSignature; // Usualmente 4
            const [bar, beat] = this.transport.position.split(':').map(parseFloat);
            
            // Calculamos el beat absoluto dentro del ciclo del loop
            const currentBeatInLoop = (parseInt(bar) % this.loopLengthInMeasures) * timeSignature + Math.floor(beat);
            return currentBeatInLoop;
        }
        return -1; // No hay beat activo si el transporte está detenido
    }
    /**
     * Devuelve la longitud actual del loop en compases.
     * @returns {number}
     */
    getLoopLength() {
        return this.loopLengthInMeasures;
    }

    //crea un getter for getTransportState
    getTransportState() {
        return {
            // ...
            beats: this.transport.ticks / this.transport.PPQ
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
    // Synte
    playPreviewNote({ coords, active }) {
        if (!this.previewSynth) return;

        if (active && coords) {
            // 1. TRADUCIMOS las coordenadas a datos musicales aquí, en el motor de audio.
            const musicalData = pointToMusicalData(coords.x, coords.y);

            // 2. Verificamos que la traducción fue exitosa.
            if (musicalData) {
                console.log(`Preview Note - Freq: ${musicalData.freq}, Velocity: ${musicalData.velocity}, Active: ${active}`);
                
                // 3. Usamos los datos musicales correctos para controlar el sinte.
                const volumeInDb = -30 + musicalData.velocity * 30;
                this.previewSynth.volume.value = volumeInDb;
                this.previewSynth.triggerAttack(musicalData.freq);
            }
        } else {
            this.previewSynth.triggerRelease();
        }
    }

    /**
     * Encuentra una pista y le ordena que inicie su proceso de armado/grabación.
     * Después de grabar, inicia la reproducción automáticamente.
     * @param {number} trackId - El ID de la pista.
     */
    armTrackForRecording(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track && typeof track.armRecord === 'function') {
            // Simplemente le ordenamos a la pista que se arme. Ella se encargará del resto.
            track.armRecord(); 
            return { state: 'armed' }; 
        }
        return null;
    }

    // <-- Synth
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