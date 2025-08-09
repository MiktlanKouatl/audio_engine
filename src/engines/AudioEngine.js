// AudioEngine.js
import * as Tone from 'tone';

export class AudioEngine {
    constructor(trackCount = 4) {
        this.trackCount = trackCount;
        this.tracks = []; // Array para nuestras pistas
        this.activeTrackId = null; // ID de la pista que se está grabando

        // El resto de las propiedades se mantienen
        this.masterLoop = null;
        this.beatLoop = null;
        this.transport = null;
        this.masterChannel = null;
        this.mic = null;
        this.recorder = null;
        this.recorderGain = null;
        this.state = 'idle'; // Estado general del motor (idle, armed, recording...)
        this.isSetup = false;
        this.onClipReady = null;
        this.onStateChange = null;
        this.onBeatChange = null; // Callback para el pulso
        this.isPlaying = false;

        this.beatsPerMeasure = 4;
        this.masterLoopLengthInBeats = 16; // 1. Longitud por defecto: 4 compases (16 tiempos)
        
        this.onBeatChange = null;
        this.onMasterProgressChange = null; // 2. Nuevo notificador para el progreso maestro
    }

    async _setup() {
        if (this.isSetup) return;
        await Tone.start();
        this.transport = Tone.getTransport();
        this.masterChannel = new Tone.Channel(0).toDestination();
        this.masterChannel.mute = false;
        this.transport.bpm.value = 120;
        this.transport.loop = false;
        this.mic = new Tone.UserMedia();
        this.recorderGain = new Tone.Gain(2);
        
        // Creamos cada una de las pistas
        for (let i = 0; i < this.trackCount; i++) {
            const channel = new Tone.Channel().connect(this.masterChannel);
            const player = new Tone.Player().connect(channel);
            this.tracks.push({
                id: i,
                player: player,
                channel: channel,
                state: 'empty' // 'empty' o 'has_loop'
            });
        }
        
        await this.mic.open();
        this.mic.connect(this.recorderGain);

        // 3. El masterLoop ahora usa nuestra longitud de ciclo configurable
        const loopInterval = `${this.masterLoopLengthInBeats / this.beatsPerMeasure}m`;
        this.masterLoop = new Tone.Loop(time => {
            this.onMasterLoopTick(time);
        }, loopInterval).start(0);

        this.beatLoop = new Tone.Loop(time => {
            const [bar, beat] = this.transport.position.split(':').map(Number);
            const currentBeatInMeasure = Math.floor(beat);
            
            // Notificador para el metrónomo visual de 4 tiempos
            if (this.onBeatChange) {
                this.onBeatChange(currentBeatInMeasure);
            }

            // Calculamos el pulso absoluto como antes.
            const absoluteBeat = (bar * this.beatsPerMeasure) + currentBeatInMeasure;
            // Usamos el módulo para obtener la posición DENTRO del ciclo maestro.
            const currentMasterBeat = absoluteBeat % this.masterLoopLengthInBeats;

            if (this.onMasterProgressChange) {
                this.onMasterProgressChange(currentMasterBeat, this.masterLoopLengthInBeats);
            }
        }, '4n').start(0);

        this.isSetup = true;
        console.log(`AudioEngine listo. Ciclo maestro de ${this.masterLoopLengthInBeats} tiempos.`);
    }
// método para cambiar la longitud del ciclo desde la UI
    setMasterLoopLength(beats) {
        this.masterLoopLengthInBeats = beats;
        const newInterval = `${beats / this.beatsPerMeasure}m`;
        this.masterLoop.interval = newInterval; // Actualizamos el intervalo del loop en tiempo real
        console.log(`Nueva longitud del ciclo maestro: ${beats} tiempos (${newInterval}).`);
    }
     async onMasterLoopTick(time) {
        if (this.state === 'armed') {
            this.recorder.start();
            this.setState('recording');
            console.log(`%c[Loop] Grabando en Pista ${this.activeTrackId}...`, 'color: #ff4136; font-weight: bold;');
        } else if (this.state === 'stopping') {
            const blob = await this.recorder.stop();
            this.recorderGain.disconnect(this.recorder);
            this.recorder.dispose();
            console.log("[Loop] Grabación detenida.");

            const url = URL.createObjectURL(blob);
            if (this.onClipReady) this.onClipReady(this.activeTrackId, url);
            
            const activeTrack = this.tracks[this.activeTrackId];
            await activeTrack.player.load(url);
            activeTrack.player.loop = true;
            activeTrack.player.sync().start(time);
            activeTrack.state = 'has_loop';

            this.setState('idle');
            console.log(`%c[Loop] Pista ${this.activeTrackId} iniciada.`, 'color: #2ecc40; font-weight: bold;');
        }
    }

    setState(newState) {
        this.state = newState;
        if (this.onStateChange) {
            this.onStateChange(this.state, this.activeTrackId);
        }
        console.log(`Nuevo estado del motor: ${newState}`);
    }


    async toggleTransport() {
        if (!this.isSetup) {
            await this._setup();
        }

        if (this.isPlaying) {
            // 1. Simplemente detenemos y rebobinamos.
            this.transport.stop();
            this.transport.position = 0;
            this.isPlaying = false;
        } else {
            // 2. Antes de arrancar, nos aseguramos de que todos los loops
            //    que tienen contenido estén listos para sonar.
            this.tracks.forEach(track => {
                if (track.state === 'has_loop' && track.player.loaded) {
                    // Volvemos a sincronizar y arrancar cada player.
                    // Tone.js es lo suficientemente inteligente para no superponer sonidos.
                    track.player.sync().start(0);
                }
            });

            // 3. Arrancamos el transporte.
            this.transport.start("+0.1");
            this.isPlaying = true;
        }
        
        console.log(`Transporte debería estar sonando: ${this.isPlaying}`);
    }

    setBPM(bpm) {
        if (!this.isSetup) return;
        this.transport.bpm.value = bpm;
        console.log(`BPM establecido en: ${bpm}`);
    }
    
    setTrackVolume(trackId, volumeInDb) {
        if (this.tracks[trackId]) {
            this.tracks[trackId].channel.volume.value = volumeInDb;
        }
    }

    setTrackPan(trackId, panValue) {
        if (this.tracks[trackId]) {
            this.tracks[trackId].channel.pan.value = panValue;
        }
    }

    toggleMute(trackId) {
        if (this.tracks[trackId]) {
            const track = this.tracks[trackId];
            track.channel.mute = !track.channel.mute;
            console.log(`Pista ${trackId} muteada: ${track.channel.mute}`);
            // Notificamos a la UI para que se actualice si es necesario
            if (this.onStateChange) this.onStateChange(this.state, this.activeTrackId);
        }
    }


    setTrackVolume(trackId, volumeInDb) {
        if (this.tracks[trackId]) {
            this.tracks[trackId].channel.volume.value = volumeInDb;
        }
    }

    // El método principal ahora necesita saber en qué pista actuar
    async toggleRecording(trackId) {
        // --- Bloque 1: Verificaciones iniciales ---
        if (!this.isSetup) await this._setup();
        if (this.transport.state !== 'started') this.transport.start("+0.1");

        const track = this.tracks[trackId];
        // Si por alguna razón el ID de la pista no es válido, no hacemos nada.
        if (!track) {
            console.error(`Error: La pista con ID ${trackId} no existe.`);
            return;
        }

        // --- Bloque 2: Lógica de Mute/Unmute (la nueva funcionalidad) ---
        // Si el motor está inactivo ('idle') Y la pista en la que hicimos clic
        // ya tiene un loop ('has_loop'), entonces la acción es MUTE/UNMUTE.
        if (track.state === 'has_loop' && this.state === 'idle') {
            this.toggleMute(trackId);
            // Salimos de la función aquí para no continuar a la lógica de grabación.
            return; 
        }

        // --- Bloque 3: Lógica de Grabación (el flujo que ya conoces) ---
        // Si estamos en medio de una grabación, la acción es DETENER.
        if (this.state === 'recording') {
            // No necesitamos saber en qué pista se hizo clic, solo que hay que parar.
            this.setState('stopping');

        // Si el motor está inactivo ('idle') y la pista está vacía, la acción es ARMAR PARA GRABAR.
        } else if (this.state === 'idle') {
            this.activeTrackId = trackId;
            this.recorder = new Tone.Recorder();
            this.recorderGain.connect(this.recorder);
            this.setState('armed'); // Levanta la bandera "armed"
        
        // Si el estado es 'armed' o 'stopping', ignoramos los clics para evitar errores.
        } else {
            console.log("El motor está ocupado, por favor espera.");
        }
    }
}