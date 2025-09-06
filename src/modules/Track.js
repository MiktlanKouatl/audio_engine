import { Synth, Player, Channel, PitchShift } from 'tone';

export class Track {
    /**
     * @param {string} name El nombre de la pista.
     * @param {RecorderModule} recorderModule Una referencia al módulo de grabación global.
     */
    constructor(name, recorderModule){
        this.name = name;
        this.recorderModule = recorderModule; // Referencia al grabador
        this.state = 'empty'; // empty | armed | recording | has_loop

        this.pitchShift = new PitchShift(0);// Efecto de cambio de tono, inicializado a 0 semitonos

        this.channel = new Channel({   
                volume: -6,
                pan: 0,
                mute: false
        }).toDestination(); // Canal para controlar el volumen y panning de la pista

        // Cada pista ahora tiene un Player para el audio grabado.
        // Creamos el Player y construimos la cadena de señal.
        // .chain() es una forma elegante de conectar varios nodos en orden.
        this.player = new Player().chain(this.pitchShift, this.channel);
        this.player.loop = true; // Los loops de audio se repiten por defecto.
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
            
            // Le pedimos al grabador que inicie una grabación agendada.
            // 'await' pausa la ejecución aquí hasta que la grabación termine.
            const audioUrl = await this.recorderModule.startScheduledRecording();
            const response = await fetch(audioUrl); // Obtenemos el Blob desde la URL
            this.audioBlob = await response.blob(); // Guardamos el Blob original
            
            // Una vez que la grabación termina, cargamos el resultado.
            await this.player.load(audioUrl);
            
            // Sincronizamos el inicio del player con el transporte para que siempre
            // comience en el inicio del ciclo maestro.
            this.player.sync().start(0);

            this.state = 'has_loop';
            console.log(`✅ Loop grabado y listo en la pista "${this.name}".`);

        } catch (error) {
            console.error(`Falló la grabación en la pista "${this.name}":`, error);
            this.state = 'empty'; // Revertimos al estado inicial si hay un error.
        }
    }
    // Método para serializar el estado de la pista.
    serialize() {
        if (this.state !== 'has_loop') return null;
        return {
            name: this.name,
            volume: this.channel.volume.value,
            pan: this.channel.pan.value,
            mute: this.channel.mute,
            audio: this.audioBlob // Entregamos el Blob para que el SessionManager lo guarde
        };
    }
    // Método para cargar datos en una pista existente.
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
    toggleMute() {
        if (this.channel) {
            this.channel.mute = !this.channel.mute;
            return this.channel.mute;
        }
        return false;
    }
    /**
     * Limpia y libera todos los recursos de audio utilizados por esta pista.
     * Esencial para evitar fugas de memoria.
     */
    dispose() {
        if (this.player) {
            this.player.dispose();
            console.log(`Player de la pista "${this.name}" liberado.`);
        }
        if (this.channel) {
            this.channel.dispose();
            console.log(`Canal de la pista "${this.name}" liberado.`);
        }
        if (this.pitchShift) {
            this.pitchShift.dispose();
            console.log(`PitchShift de la pista "${this.name}" liberado.`);
        }
        // Si en el futuro añadimos efectos, también los liberaríamos aquí.
        // ej: this.reverb.dispose();
    }
}