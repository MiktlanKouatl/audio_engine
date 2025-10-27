// src/modules/InstrumentTrack.js
import { FMSynth, Volume, getTransport, Time } from 'tone';
import { pointToMusicalData } from './Notation.js';

export class InstrumentTrack {
    constructor(id, name, masterOut, gesturePlayer) {
        this.id = id;
        this.name = name;
        this.state = 'empty'; // 'empty', 'armed', 'recording', 'has_sequence'
        this.transport = getTransport();
        this.gesturePlayer = gesturePlayer;

        this.synth = new FMSynth({
            harmonicity: 2,
            modulationIndex: 10,
            envelope: { attack: 0.01, decay: 0.2, release: 0.2 }
        });
        
        this.channel = new Volume(0).connect(masterOut);
        this.synth.connect(this.channel);

        this.gesture = [];
    }

    playAt(coord, time) {
        if (!this.synth || !coord) return;

        // Traducimos la coordenada a datos musicales
        const musicalData = pointToMusicalData(coord.x, coord.y);
        if (!musicalData) return;

        const volumeInDb = -30 + musicalData.velocity * 30;
        const rampTime = 1 / 60; // Un deslizamiento suave entre frames

        // Simplemente actualizamos los parámetros del sinte.
        // Asumimos que ya está sonando.
        this.synth.frequency.rampTo(musicalData.freq, rampTime, time);
        this.synth.volume.rampTo(volumeInDb, rampTime, time);
    }

    /**
     * Arma la pista y espera activamente el inicio del próximo loop para grabar.
     * Este método ahora imita la lógica robusta de RecorderModule.js.
     */
    async armRecord() {
        if (this.state === 'armed' || this.state === 'recording') {
            console.warn(`La pista "${this.name}" ya está en proceso de grabación.`);
            return;
        }

        this.clearSequence();
        this.state = 'armed';
        console.log(`Pista "${this.name}" armada. Esperando el próximo loop...`);

        return new Promise((resolve) => {
            let animationFrameId = null;

            const waitForNextLoop = () => {
                if (this.transport.state !== 'started' || this.state !== 'armed') {
                    cancelAnimationFrame(animationFrameId);
                    return;
                }

                if (Time(this.transport.position).toSeconds() < 0.1) {
                    cancelAnimationFrame(animationFrameId);
                    this.startRecordingSequence(resolve);
                } else {
                    animationFrameId = requestAnimationFrame(waitForNextLoop);
                }
            };
            waitForNextLoop();
        });
    }

    /**
     * Inicia la grabación y crea un observador para detenerla al final del loop.
     * @param {Function} resolve - La función para resolver la promesa de armRecord.
     */
    startRecordingSequence(resolve) {
        this.state = 'recording';
        console.log(`¡GRABANDO en pista "${this.name}"!`);
        if (this.synth) this.synth.triggerAttack();

        let previousBar = 0;
        let animationFrameId = null;

        const watchForLoopEnd = () => {
            if (this.state !== 'recording') {
                cancelAnimationFrame(animationFrameId);
                return;
            }

            const [currentBar] = this.transport.position.split(':').map(parseFloat);
            const currentBarInt = Math.floor(currentBar);

            if (currentBarInt < previousBar) {
                cancelAnimationFrame(animationFrameId);

                this.state = 'has_sequence';
                //if (this.synth) this.synth.triggerRelease();
                console.log(`Grabación en "${this.name}" FINALIZADA.`);
                //resolve();

                // --- ¡LA LÓGICA DE REPRODUCCIÓN AHORA VIVE AQUÍ! ---
                const newGesture = this.getGesture();
                if (newGesture && newGesture.length > 0 && this.gesturePlayer) {
                    console.log("Iniciando reproducción del gesto recién grabado...");
                    
                    // Normalizamos el gesto para que empiece en t=0
                    const startTime = newGesture[0].t;
                    const normalizedGesture = newGesture.map(p => ({ t: p.t - startTime, c: p.c }));
                    
                    // Le decimos al GesturePlayer que reproduzca este gesto en esta misma pista ('this').
                    this.gesturePlayer.playGesture(this, normalizedGesture, 0);
                }
                // --- FIN DE LA LÓGICA DE REPRODUCCIÓN ---
                
                resolve(); // La grabación ha terminado.
            } else {
                previousBar = currentBarInt;
                animationFrameId = requestAnimationFrame(watchForLoopEnd);
            }
        };
        watchForLoopEnd();
    }
    
    recordGesture(timeInBeats, gesturePoint) {
        if (this.state !== 'recording' || !gesturePoint.coords) return;
        this.gesture.push({
            t: timeInBeats,
            c: gesturePoint.coords
        });
    }

    clearSequence() {
        this.gesture = [];
        this.state = 'empty';
        console.log(`Secuencia de la pista "${this.name}" limpiada.`);
    }

    getGesture() {
        return this.gesture;
    }

    serialize() {
        if (this.state !== 'has_sequence') return null;
        return {
            type: 'instrument',
            name: this.name,
            volume: this.channel.volume.value,
            pan: this.channel.pan.value,
            mute: this.channel.mute,
            gesture: this.gesture
        };
    }

    async loadData(trackData) {
        this.name = trackData.name;
        this.channel.volume.value = trackData.volume;
        this.channel.pan.value = trackData.pan;
        this.channel.mute = trackData.mute;
        this.gesture = trackData.gesture || [];

        if (this.gesture.length > 0) {
            this.state = 'has_sequence';
            const startTime = this.gesture[0].t;
            const normalizedGesture = this.gesture.map(p => ({ t: p.t - startTime, c: p.c }));
            this.gesturePlayer.playGesture(this, normalizedGesture, 0);
        }
    }
}