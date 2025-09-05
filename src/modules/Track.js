import { Synth, Sequence, Player } from 'tone';

export class Track {
    /**
     * @param {string} name El nombre de la pista.
     * @param {RecorderModule} recorderModule Una referencia al módulo de grabación global.
     */
    constructor(name, recorderModule){
        this.name = name;
        this.recorderModule = recorderModule; // Referencia al grabador
        this.state = 'empty'; // empty | armed | recording | has_loop

        // Cada pista ahora tiene un Player para el audio grabado.
        this.player = new Player().toDestination();
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
    /**
     * Limpia y libera todos los recursos de audio utilizados por esta pista.
     * Esencial para evitar fugas de memoria.
     */
    dispose() {
        if (this.player) {
            this.player.dispose();
            console.log(`Player de la pista "${this.name}" liberado.`);
        }
        // Si en el futuro añadimos efectos, también los liberaríamos aquí.
        // ej: this.reverb.dispose();
    }
}