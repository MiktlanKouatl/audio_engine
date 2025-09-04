// src/engines/AudioEngine.js
import * as Tone from 'tone';
import { Sequencer } from '../modules/Sequencer.js';
import { RecorderModule } from '../modules/RecorderModule.js';

export class AudioEngine {
    constructor(trackCount = 4) {
        this.trackCount = trackCount;
        this.tracks = [];
        this.activeTrackId = null;
        this.sequencer = null;
        this.recorderModule = null;
        this.transport = null;
        this.masterChannel = null;
        this.mic = null;
        
        // Estados y configuraciones
        this.state = 'idle';
        this.isPlaying = false;
        this.isSetup = false;
        this.beatsPerMeasure = 4;
        this.masterLoopLengthInBeats = 16;

        // Callbacks para la UI
        this.onStateChange = null;
        this.onClipReady = null;
    }

    /**
     * Inicializa todos los componentes de Tone.js.
     * Se llama automáticamente en la primera interacción del usuario.
     */
    async _setup() {
        if (this.isSetup) return;
        await Tone.start();
        
        this.transport = Tone.getTransport();
        this.masterChannel = new Tone.Channel(0).toDestination();
        this.transport.bpm.value = 120;
        this.transport.loop = true;
        this.transport.loopEnd = `${this.masterLoopLengthInBeats / this.beatsPerMeasure}m`;

        for (let i = 0; i < this.trackCount; i++) {
            const channel = new Tone.Channel().connect(this.masterChannel);
            const player = new Tone.Player().connect(channel);
            this.tracks.push({ id: i, player, channel, state: 'empty' });
        }
        
        this.sequencer = new Sequencer(this.tracks, this.transport);
        this.sequencer.init();
        
        // Creamos el micrófono y el módulo de grabación
        this.mic = new Tone.UserMedia();
        await this.mic.open();
        this.recorderModule = new RecorderModule(this.mic);

        this.isSetup = true;
    }

    /**
     * Comunica los cambios de estado a la UI.
     */
    setState(newState) {
        this.state = newState;
        if (this.onStateChange) {
            this.onStateChange(this.state, this.activeTrackId);
        }
        console.log(`Nuevo estado del motor: ${newState}`);
    }

    /**
     * Inicia o detiene el transporte principal y la reproducción.
     */
    async toggleTransport() {
        if (!this.isSetup) await this._setup();
        
        if (this.isPlaying) {
            this.transport.stop();
            this.transport.position = 0;
            this.isPlaying = false;
        } else {
            this.tracks.forEach(track => {
                if (track.state === 'has_loop' && track.player.loaded && !track.channel.mute) {
                    track.player.sync().start(0);
                }
            });
            this.transport.start("+0.1");
            this.isPlaying = true;
        }
        console.log(`Transporte sonando: ${this.isPlaying}`);
    }

    /**
     * Inicia el ciclo de grabación en una pista específica.
     */
    async toggleRecording(trackId) {
        if (!this.isSetup) await this._setup();
        if (!this.isPlaying || this.state !== 'idle') {
            console.warn("El motor está ocupado o el transporte está detenido.");
            return;
        }
        const track = this.tracks[trackId];
        if (!track) return;
        if (track.state === 'has_loop') {
             this.toggleMute(trackId);
             return;
        }

        // 1. Notificamos a la UI que estamos ocupados "grabando".
        this.activeTrackId = trackId;
        this.setState('recording'); // El botón se pondrá rojo.

        // 2. Le pedimos a nuestra herramienta que nos dé un clip de audio.
        const duration = `${this.masterLoopLengthInBeats / this.beatsPerMeasure}m`;
        const audioBlob = await this.recorderModule.record(duration);
        
        // 3. Cuando la grabación termina, cargamos el Blob en el player.
        const url = URL.createObjectURL(audioBlob);
        await track.player.load(url);
        track.player.loop = true;
        track.state = 'has_loop';
        
        console.log(`Audio grabado y cargado en Pista ${trackId}.`);

        // 4. El motor vuelve a estar libre.
        this.setState('idle');
    }
    
    // --- Métodos de Control para la UI ---

    setMasterLoopLength(beats) {
        if (!this.transport) return;
        this.masterLoopLengthInBeats = beats;
        this.transport.loopEnd = `${beats / this.beatsPerMeasure}m`;
        if (this.sequencer && this.sequencer.part) {
            this.sequencer.part.loopEnd = this.transport.loopEnd;
        }
    }

    setBPM(bpm) {
        if (this.transport) this.transport.bpm.value = bpm;
    }

    toggleMute(trackId) {
        if (this.tracks[trackId]) {
            const track = this.tracks[trackId];
            track.channel.mute = !track.channel.mute;
            if (this.onStateChange) this.onStateChange(this.state, null);
        }
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
}