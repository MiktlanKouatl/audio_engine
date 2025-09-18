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
            if (this.state !== 'idle' || !this.transport) {
                return reject(new Error(`La grabadora no está lista.`));
            }
            if (this.mic.state !== 'started') {
                return reject(new Error("El micrófono no está listo."));
            }

            this.state = 'armed';
            const loopDuration = Time(this.transport.loopEnd).toSeconds();
            const loopSeconds = Time(loopDuration).toSeconds();
            //console.log(`Grabación armada. Empezará en el próximo ciclo y durará ${loopDuration.toFixed(2)} segundos.`);
            console.log(`[RECORDER] Armado. Duración: ${loopSeconds.toFixed(2)}s. Transporte en: ${this.transport.position}`);


            // 1. Agendamos el INICIO de la grabación, esto sigue siendo preciso y fiable.
            this.transport.scheduleOnce(startTime => {
                this.state = 'recording';
                this.recorder.start();
                //console.log(`🔴 Grabación iniciada en t=${startTime.toFixed(2)}`);
                console.log(`🔴 GRABACIÓN INICIADA en t=${startTime.toFixed(2)}s (Transporte en: ${this.transport.position})`);


                // 2. ¡EL NUEVO ENFOQUE! Iniciamos nuestro observador manual.
                let previousBar = -1; // Empezamos con un valor imposible.
                let animationFrameId = null;

                const watchForLoopEnd = async () => {
                    const [currentBar] = this.transport.position.split(':').map(parseFloat);

                    // La primera vez, solo guardamos la posición inicial.
                    if (previousBar === -1) {
                        previousBar = currentBar;
                    }

                    // La condición de parada: si el compás actual es MENOR que el anterior,
                    // significa que el transporte ha loopeado.
                    if (currentBar < previousBar) {
                        // ¡Hemos detectado el final del loop!
                        cancelAnimationFrame(animationFrameId); // Detenemos el observador.

                        try {
                            if (this.state !== 'recording') return;

                            const blob = await this.recorder.stop();
                            console.log(`[DEBUG] Blob de audio creado. Duración estimada: ${blob.size / 44100 / 2}s`); // Estimación simple

                            const url = URL.createObjectURL(blob);
                            
                            this.state = 'idle';
                            console.log(`⏹️ Grabación finalizada por OBSERVADOR en t=${this.transport.seconds.toFixed(2)}. URL generada.`);

                            resolve(url);
                        } catch (e) {
                            console.error("Error al detener y procesar la grabación:", e);
                            this.state = 'idle';
                            reject(e);
                        }
                    } else {
                        // Si no hemos llegado al final, seguimos observando.
                        previousBar = currentBar;
                        animationFrameId = requestAnimationFrame(watchForLoopEnd);
                    }
                };
                
                // Arrancamos el observador.
                watchForLoopEnd();

            }, "0");
        });
    }
    
}