import {UserMedia, Recorder, Time} from "tone";

export class RecorderModule {
    constructor(transport) {
        if (!transport) {
            throw new Error("RecorderModule requiere una instancia de Tone.Transport.");
        }
        this.transport = transport; // <--- Lo asigna a su propiedad
        this.state = "idle"; // idle | armed | recording
        this.mic = new UserMedia();
        this.recorder = new Recorder();
        // Conectamos la entrada del micrófono a la grabadora.
        this.mic.connect(this.recorder);
    }

    /**
     * Pide permiso al usuario para usar el micrófono y lo abre.
     * Debe ser llamado por una interacción directa del usuario.
     */
    async initializeMicrophone() {
        if (this.mic.state === 'started') {
            console.log("El micrófono ya está inicializado.");
            return;
        }
        try {
            await this.mic.open();
            console.log("🎙️ Micrófono inicializado con éxito.");
        } catch (error) {
            console.error("Error al inicializar el micrófono:", error);
            alert("No se pudo acceder al micrófono. Por favor, revisa los permisos en tu navegador.");
        }
    }
    /**
     * Graba un loop cuantizado al ciclo maestro del transporte.
     * @returns {Promise<string>} Una promesa que se resuelve con la URL del audio grabado.
     */
    startScheduledRecording() {
        return new Promise((resolve, reject) => {
            if (this.state !== 'idle') {
                return reject(new Error(`La grabadora está ocupada. Estado actual: ${this.state}`));
            }
            if (this.mic.state !== 'started') {
                return reject(new Error("El micrófono no está listo."));
            }

            this.state = 'armed';
            const loopLength = this.transport.loopEnd;
            console.log(`Grabación armada. Empezará en el próximo ciclo y durará ${loopLength}.`);

            // Agenda el INICIO de la grabación para que coincida con el inicio del próximo loop.
            this.transport.scheduleOnce(time => {
                this.state = 'recording';
                this.recorder.start();
                console.log(`🔴 Grabación iniciada en t=${time.toFixed(2)}`);
            }, "0"); // "0" en un transporte con loop significa el inicio del próximo ciclo.

            // Agenda el FIN de la grabación justo cuando el loop termina.
            this.transport.scheduleOnce(async (time) => {
                const blob = await this.recorder.stop();
                const url = URL.createObjectURL(blob);
                
                this.state = 'idle';
                console.log(`⏹️ Grabación finalizada en t=${time.toFixed(2)}. URL generada.`);
                resolve(url); // La promesa se resuelve con la URL del audio.
            }, loopLength);

        });
    }
    
}