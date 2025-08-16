// src/engines/AudioEngine.js
import * as Tone from 'tone';

export class AudioEngine {
    constructor(trackCount = 4) {
        this.trackCount = trackCount;
        this.tracks = [];
        this.activeTrackId = null;
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
        
        // El transporte ahora loopea según nuestro ciclo maestro
        this.transport.loop = true;
        this.transport.loopEnd = `${this.masterLoopLengthInBeats / this.beatsPerMeasure}m`;

        this.mic = new Tone.UserMedia();
        this.recorderGain = new Tone.Gain(2);

        for (let i = 0; i < this.trackCount; i++) {
            const channel = new Tone.Channel().connect(this.masterChannel);
            const player = new Tone.Player().connect(channel);
            this.tracks.push({ id: i, player, channel, state: 'empty' });
        }
        
        await this.mic.open();
        this.mic.connect(this.recorderGain);

        this.beatLoop = new Tone.Loop(time => this.onBeatTick(time), '4n').start(0);

        this.isSetup = true;
        console.log(`AudioEngine listo. Ciclo maestro de ${this.masterLoopLengthInBeats} tiempos.`);
    }

    onBeatTick(time) {
        // Esta función ahora solo se encarga de los visualizadores
        const [bar, beat] = this.transport.position.split(':').map(Number);
        const currentBeatInMeasure = Math.floor(beat);
        const absoluteBeat = (bar * this.beatsPerMeasure) + currentBeatInMeasure;
        const currentMasterBeat = absoluteBeat % this.masterLoopLengthInBeats;
        
        if (this.onBeatChange) this.onBeatChange(currentBeatInMeasure);
        if (this.onMasterProgressChange) this.onMasterProgressChange(currentMasterBeat, this.masterLoopLengthInBeats);
    }

    setState(newState) {
        this.state = newState;
        if (this.onStateChange) this.onStateChange(this.state, this.activeTrackId);
    }
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
        console.log(`Transporte debería estar sonando: ${this.isPlaying}`);
    }

    setMasterLoopLength(beats) {
        if (!this.transport) return;
        this.masterLoopLengthInBeats = beats;
        this.transport.loopEnd = `${beats / this.beatsPerMeasure}m`;
        console.log(`Nueva longitud del ciclo maestro: ${beats} tiempos.`);
    }

    async toggleRecording(trackId) {
        if (!this.isPlaying || this.state !== 'idle') {
            console.warn("Solo se puede armar una pista cuando el transporte está sonando y el motor está inactivo.");
            return;
        }

        this.activeTrackId = trackId;
        this.recorder = new Tone.Recorder();
        this.recorderGain.connect(this.recorder);
        
        // Agendamos el inicio y el final de la grabación de forma precisa
        this.transport.scheduleOnce(time => {
            this.recorder.start(time);
            this.setState('recording');
            console.log(`Grabación iniciada en Pista ${trackId} en t=${time}`);
        }, "0"); // Inicia en el próximo inicio de ciclo (tiempo 0)

        this.transport.scheduleOnce(async (time) => {
            const blob = await this.recorder.stop();
            this.recorder.dispose();

            const url = URL.createObjectURL(blob);
            const track = this.tracks[this.activeTrackId];
            await track.player.load(url);
            track.player.loop = true;
            track.player.sync().start(0); // Sincroniza el player para que siempre inicie en el tiempo 0 del transporte
            track.state = 'has_loop';
            this.setState('idle');
            console.log(`Grabación finalizada y loopeando en Pista ${trackId}.`);
        }, `@${this.masterLoopLengthInBeats}n`); // Detiene justo al final del ciclo

        this.setState('armed');
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