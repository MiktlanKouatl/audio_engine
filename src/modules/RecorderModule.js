// src/modules/RecorderModule.js
import * as Tone from 'tone';

export class RecorderModule {
    constructor(micSource) {
        // La fuente de audio (el micrófono) se le pasa al ser creado.
        this.mic = micSource;
        this.recorder = null;
        this.gain = new Tone.Gain(2); // Ganancia para la grabación
        this.mic.connect(this.gain);
    }

    /**
     * Graba audio. Empieza en el próximo pulso y dura un ciclo maestro.
     * @param {string} duration - La duración de la grabación (ej. "4m").
     * @returns {Promise<Blob>} - Una promesa que se resuelve con el Blob del audio grabado.
     */
    record(duration) {
        // Devuelve una Promesa, permitiendo al AudioEngine esperar a que termine.
        return new Promise(resolve => {
            this.recorder = new Tone.Recorder();
            this.gain.connect(this.recorder);

            // Agenda el inicio para el próximo pulso, para una sensación precisa.
            Tone.getTransport().scheduleOnce(time => {
                this.recorder.start(time);
                console.log(`[RecorderModule] Grabación iniciada. Duración: ${duration}`);
            }, '@4n');

            // Agenda la detención para que ocurra después de la duración especificada.
            Tone.getTransport().scheduleOnce(async (time) => {
                const blob = await this.recorder.stop();
                this.recorder.dispose();
                console.log(`[RecorderModule] Grabación finalizada.`);
                // Cuando termina, resuelve la promesa y entrega el Blob.
                resolve(blob);
            }, `+${duration}`);
        });
    }
}