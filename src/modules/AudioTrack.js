import { Player, PitchShift, Filter, Time, Meter } from 'tone';
import { BaseTrack } from './BaseTrack.js';

export class AudioTrack extends BaseTrack {
    /**
     * @param {string} name El nombre de la pista.
     * @param {RecorderModule} recorderModule Una referencia al módulo de grabación global.
     */
    constructor(id, name, recorderModule, masterOut){
        super(id, name, masterOut);
        this.recorderModule = recorderModule; // Referencia al grabador
        this.state = 'empty'; // empty | armed | recording | has_loop

        this.pitchShift = new PitchShift(0);
        this.filter = new Filter(20000, 'lowpass');
        this.meter = new Meter();

        // Conectamos el medidor al canal que viene de BaseTrack
        this.channel.connect(this.meter);

        this.player = new Player().chain(this.pitchShift, this.filter, this.channel);
        this.player.loop = true;
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
        const baseData = super.serialize();
        return {
            ...baseData,
            type: 'audio',
            audio: this.audioBlob
        };
    }

    async loadData(trackData) {
        super.loadData(trackData);
        
        if (trackData.audio instanceof Blob) {
            this.audioBlob = trackData.audio;
            const url = URL.createObjectURL(this.audioBlob);
            await this.player.load(url);
            this.player.sync().start(0);
            this.state = 'has_loop';
        }
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

    dispose() {
        if (this.player) this.player.dispose();
        if (this.pitchShift) this.pitchShift.dispose();
        if (this.filter) this.filter.dispose();
        if (this.meter) this.meter.dispose();
        super.dispose(); // Llama al dispose de la clase base al final
    }

    exportToWAV() {
        if (!this.player.loaded) {
            alert("El audio aún no está cargado.");
            return;
        }

        const buffer = this.player.buffer.get();
        const wavBlob = this.audioBufferToWav(buffer);
        const url = URL.createObjectURL(wavBlob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${this.name}.wav`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    audioBufferToWav(buffer) {
        let numOfChan = buffer.numberOfChannels,
            btwLength = buffer.length * numOfChan * 2 + 44,
            btwArrBuff = new ArrayBuffer(btwLength),
            btwView = new DataView(btwArrBuff),
            btwChnls = [],
            btwIndex,
            btwSample,
            btwOffset = 0,
            btwPos = 0;

        function setUint16(data) {
            btwView.setUint16(btwPos, data, true);
            btwPos += 2;
        }

        function setUint32(data) {
            btwView.setUint32(btwPos, data, true);
            btwPos += 4;
        }

        setUint32(0x46464952); // "RIFF"
        setUint32(btwLength - 8);
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1);
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);

        setUint32(0x61746164); // "data"
        setUint32(btwLength - btwPos - 4);

        for (btwIndex = 0; btwIndex < buffer.numberOfChannels; btwIndex++) {
            btwChnls.push(buffer.getChannelData(btwIndex));
        }

        while (btwPos < btwLength) {
            for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
                btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset]));
                btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0;
                btwView.setInt16(btwPos, btwSample, true);
                btwPos += 2;
            }
            btwOffset++;
        }

        return new Blob([btwView], { type: 'audio/wav' });
    }
}