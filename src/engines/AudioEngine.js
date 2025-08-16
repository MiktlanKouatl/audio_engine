// src/engines/AudioEngine.js
import * as Tone from 'tone';

export class AudioEngine {
    constructor(trackCount = 4) {
        this.trackCount = trackCount;
        this.tracks = [];
        this.activeTrackId = null;
        //this.masterLoop = null; // Se ha eliminado, ya no es necesario
        this.beatLoop = null;
        this.transport = null;
        this.masterChannel = null;
        this.mic = null;
        this.recorder = null;
        this.recorderGain = null;
        this.state = 'idle';
        this.isPlaying = false;
        this.isSetup = false;
        this.beatsPerMeasure = 4;
        this.masterLoopLengthInBeats = 16;
        this.onClipReady = null;
        this.onStateChange = null;
        this.onBeatChange = null;
        this.onMasterProgressChange = null;
    }

    async _setup() {
        if (this.isSetup) return;
        await Tone.start();
        this.transport = Tone.getTransport();
        this.masterChannel = new Tone.Channel(0).toDestination();
        this.transport.bpm.value = 120;
        this.mic = new Tone.UserMedia();
        this.recorderGain = new Tone.Gain(2);

        for (let i = 0; i < this.trackCount; i++) {
            const channel = new Tone.Channel().connect(this.masterChannel);
            const player = new Tone.Player().connect(channel);
            this.tracks.push({
                id: i,
                player: player,
                channel: channel,
                state: 'empty',
                quantize: 'float'
            });
        }
        
        await this.mic.open();
        this.mic.connect(this.recorderGain);

        this.beatLoop = new Tone.Loop(time => {
            this.onBeatTick(time);
        }, '4n').start(0);

        this.isSetup = true;
        console.log(`AudioEngine listo. Ciclo maestro de ${this.masterLoopLengthInBeats} tiempos.`);
    }

    async onBeatTick(time) {
        if (this.state === 'armed') {
            this.recorder.start();
            this.setState('recording');
            console.log(`%c[Loop] ¡GRABANDO en Pista ${this.activeTrackId}!`, 'color: #ff4136; font-weight: bold;');
        }
        else if (this.state === 'stopping') {
            const blob = await this.recorder.stop();
            this.recorderGain.disconnect(this.recorder);
            this.recorder.dispose();

            const url = URL.createObjectURL(blob);
            if (this.onClipReady) this.onClipReady(this.activeTrackId, url);
            
            const activeTrack = this.tracks[this.activeTrackId];
            await activeTrack.player.load(url);
            
            if (activeTrack.quantize === 'strict') {
                activeTrack.player.loopEnd = `${this.masterLoopLengthInBeats}n`;
            }
            
            activeTrack.player.loop = true;
            
            // --- CORRECCIÓN DEL "PULSO FANTASMA" ---
            // Se añade el offset para compensar la latencia de grabación.
            activeTrack.player.sync().start(time, "0.05");

            activeTrack.state = 'has_loop';
            this.setState('idle');
            console.log(`%c[Loop] Pista ${this.activeTrackId} iniciada.`, 'color: #2ecc40; font-weight: bold;');
        }
        
        const [bar, beat] = this.transport.position.split(':').map(Number);
        const currentBeatInMeasure = Math.floor(beat);
        const absoluteBeat = (bar * this.beatsPerMeasure) + currentBeatInMeasure;
        const currentMasterBeat = absoluteBeat % this.masterLoopLengthInBeats;
        
        if (this.onBeatChange) this.onBeatChange(currentBeatInMeasure);
        if (this.onMasterProgressChange) this.onMasterProgressChange(currentMasterBeat, this.masterLoopLengthInBeats);
    }

    setState(newState) {
        this.state = newState;
        if (this.onStateChange) {
            this.onStateChange(this.state, this.activeTrackId);
        }
    }

    async toggleTransport() {
        if (!this.isSetup) {
            await this._setup();
        }

        if (this.isPlaying) {
            this.transport.stop();
            this.transport.position = 0;
            this.isPlaying = false;
        } else {
            // --- CORRECCIÓN DEL REINICIO DE LOOPS ---
            // "Despertamos" a todos los loops activos antes de arrancar.
            this.tracks.forEach(track => {
                if (track.state === 'has_loop' && track.player.loaded && !track.channel.mute) {
                    track.player.sync().start(0);
                }
            });
            this.transport.start("+0.1");
            this.isPlaying = true;
        }
        
        console.log(`Transporte debería estar sonando: ${this.isPlaying}`);
    }

    setMasterLoopLength(beats) {
        this.masterLoopLengthInBeats = beats;
        console.log(`Nueva longitud del ciclo maestro: ${beats} tiempos.`);
    }

    async toggleRecording(trackId) {
        if (!this.isSetup) await this._setup();

        if (!this.isPlaying) {
            console.warn("El transporte está detenido. Presiona Play para grabar.");
            return;
        }

        const track = this.tracks[trackId];
        if (!track) return;

        if (track.state === 'has_loop' && this.state === 'idle') {
            this.toggleMute(trackId);
            return;
        }

        if (this.state === 'recording' && this.activeTrackId === trackId) {
            this.setState('stopping');
        } else if (this.state === 'idle') {
            this.activeTrackId = trackId;
            this.recorder = new Tone.Recorder();
            this.recorderGain.connect(this.recorder);
            this.setState('armed');
        }
    }

    // El resto de los métodos como setBPM, setTrackVolume, etc., no necesitan cambios...
    setTrackVolume(trackId, volumeInDb) {
        if (this.tracks[trackId]) this.tracks[trackId].channel.volume.value = volumeInDb;
    }
    setTrackPan(trackId, panValue) {
        if (this.tracks[trackId]) this.tracks[trackId].channel.pan.value = panValue;
    }
    toggleMute(trackId) {
        if (this.tracks[trackId]) {
            const track = this.tracks[trackId];
            track.channel.mute = !track.channel.mute;
            if (this.onStateChange) this.onStateChange(this.state, this.activeTrackId);
        }
    }
    setTrackQuantizeMode(trackId, mode) {
        if (this.tracks[trackId]) this.tracks[trackId].quantize = mode;
    }
}