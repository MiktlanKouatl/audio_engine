import { Synth, Player, Channel, PitchShift, Filter, Time, Meter } from 'tone';

export class Track {
    /**
     * @param {string} name El nombre de la pista.
     * @param {RecorderModule} recorderModule Una referencia al módulo de grabación global.
     */
    constructor(id, name, recorderModule, masterOut){
        this.id = id;
        this.name = name;
        this.recorderModule = recorderModule; // Referencia al grabador
        this.state = 'empty'; // empty | armed | recording | has_loop
        this.isArmed = false;

        this.pitchShift = new PitchShift(0);// Efecto de cambio de tono, inicializado a 0 semitonos
        this.filter = new Filter(20000, 'lowpass'); // Un filtro pasa-bajas, abierto por defecto (20000Hz)
        this.meter = new Meter(); // Medidor de nivel para el VU-metro

        this.channel = new Channel({   
                volume: -6,
                pan: 0,
                mute: false
        }).connect(this.meter).connect(masterOut); // Conectamos el canal al medidor y luego al master

        this.player = new Player().chain(this.pitchShift, this.filter, this.channel);
        this.player.loop = true; // Los loops de audio se repiten por defecto.
    }

    getLevel() {
        return this.meter.getValue();
    }

    /**
     * Inicia el proceso de grabación para esta pista.
     * Utiliza el RecorderModule para hacer el trabajo pesado.
     */
    async armRecord() {
        if (this.state !== 'empty' || this.recorderModule.state !== 'idle') {
            console.warn(`No se puede grabar en la pista "${this.name}". Estado actual: ${this.state}`);
            return;
        }

        try {
            this.state = 'armed';
            console.log(`Pista "${this.name}" armada para grabar.`);
            
            const audioUrl = await this.recorderModule.startScheduledRecording();
            console.log(`[DEBUG] Track "${this.name}" recibió la URL del audio.`);
            const response = await fetch(audioUrl);
            this.audioBlob = await response.blob();
            
            await this.player.load(audioUrl);

            const expectedDuration = Time(this.recorderModule.transport.loopEnd).toSeconds();
            const actualDuration = this.player.buffer.duration;
            const latencyCompensation = expectedDuration - actualDuration;

            console.log(`[TRACK] Duración esperada: ${expectedDuration.toFixed(2)}s, Duración real: ${actualDuration.toFixed(2)}s`);
            console.log(`[TRACK] Compensación de latencia calculada: ${latencyCompensation.toFixed(3)}s`);

            this.player.sync().start(0, latencyCompensation);
            console.log(`[TRACK] Player de "${this.name}" sincronizado con compensación.`);

            this.state = 'has_loop';
            console.log(`✅ Loop grabado y listo en la pista "${this.name}".`);

        } catch (error) {
            console.error(`Falló la grabación en la pista "${this.name}":`, error);
            this.state = 'empty';
        }
    }

    serialize() {
        if (this.state !== 'has_loop') return null;
        return {
            name: this.name,
            volume: this.channel.volume.value,
            pan: this.channel.pan.value,
            mute: this.channel.mute,
            audio: this.audioBlob
        };
    }

    async loadData(trackData) {
        this.name = trackData.name;
        this.channel.volume.value = trackData.volume;
        this.channel.pan.value = trackData.pan;
        this.channel.mute = trackData.mute;
        
        if (trackData.audio instanceof Blob) {
            this.audioBlob = trackData.audio;
            const url = URL.createObjectURL(this.audioBlob);
            await this.player.load(url);
            this.player.sync().start(0);
            this.state = 'has_loop';
        }
    }

    setVolume(db) {
        if (this.channel) this.channel.volume.value = db;
    }

    setPan(panValue) {
        if (this.channel) this.channel.pan.value = panValue;
    }

    setPitch(semitones) {
        if (this.pitchShift) {
            this.pitchShift.pitch = semitones;
        }
    }

    setFilterFrequency(freq) {
        if (this.filter) {
            this.filter.frequency.value = freq;
        }
    }

    toggleMute() {
        if (this.channel) {
            this.channel.mute = !this.channel.mute;
            return this.channel.mute;
        }
        return false;
    }

    dispose() {
        if (this.player) this.player.dispose();
        if (this.channel) this.channel.dispose();
        if (this.pitchShift) this.pitchShift.dispose();
        if (this.filter) this.filter.dispose();
        if (this.meter) this.meter.dispose();
    }
}