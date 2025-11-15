import { getTransport, Time } from 'tone';
import { SOUND_BANK } from './SoundBank.js';
import { pointToMusicalData } from './Notation.js';
import { BaseTrack } from './BaseTrack.js';

export class InstrumentTrack extends BaseTrack {
    constructor(id, name, masterOut, gesturePlayer, initialMode = 'melodic') {
        super(id, name, masterOut);
        this.state = 'empty'; // 'empty', 'armed', 'recording', 'has_sequence'
        this.transport = getTransport();
        this.gesturePlayer = gesturePlayer;

        this.mode = null;
        this.synth = null;
        this.synthMapFunction = null;
        this.synthTriggerAttackFunction = null;
        this.synthTriggerReleaseFunction = null;
        this.synthPlayPreviewFunction = null;

        this.gesture = [];

        this.setMode(initialMode);
    }

    setMode(newMode) {
        if (!SOUND_BANK[newMode]) {
            console.error(`Mode ${newMode} not found in SOUND_BANK.`);
            return;
        }

        if (this.synth) {
            this.synth.disconnect();
            this.synth.dispose();
        }

        const modeConfig = SOUND_BANK[newMode];
        // El this.channel es heredado de BaseTrack
        this.synth = modeConfig.synth(this.channel); 
        this.synthMapFunction = modeConfig.map;
        this.synthTriggerAttackFunction = modeConfig.triggerAttack;
        this.synthTriggerReleaseFunction = modeConfig.triggerRelease;
        this.synthPlayPreviewFunction = modeConfig.playPreview;
        this.mode = newMode;
        console.log(`Instrument mode for ${this.name} set to ${newMode}`);
    }

    // ... (el resto de los métodos como handleInteraction, armRecord, etc. se mantienen igual)
    handleInteraction(data) {
        const { type, coords } = data;
        if (!this.synth) return;

        switch (type) {
            case 'disc-start-interaction':
                if (this.synthMapFunction) {
                    this.synthMapFunction(this.synth, coords.x, coords.y);
                }
                if (this.synthPlayPreviewFunction) {
                    this.synthPlayPreviewFunction(this.synth, coords.x, coords.y);
                } else if (this.synthTriggerAttackFunction) {
                    this.synthTriggerAttackFunction(this.synth);
                }
                break;
            case 'disc-update-interaction':
                if (this.synthMapFunction) {
                    this.synthMapFunction(this.synth, coords.x, coords.y);
                }
                break;
            case 'disc-end-interaction':
                if (this.synthTriggerReleaseFunction) {
                    this.synthTriggerReleaseFunction(this.synth);
                }
                break;
        }
    }

    playAt(coord, time) {
        if (!this.synth || !coord || !this.synthMapFunction) return;
        this.synthMapFunction(this.synth, coord.x, coord.y, time);
    }

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

    startRecordingSequence(resolve) {
        this.state = 'recording';
        console.log(`¡GRABANDO en pista "${this.name}"!`);
        if (this.synth && this.synthTriggerAttackFunction) {
            this.synthTriggerAttackFunction(this.synth);
        }

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
                if (this.synth && this.synthTriggerReleaseFunction) {
                    this.synthTriggerReleaseFunction(this.synth);
                }
                console.log(`Grabación en "${this.name}" FINALIZADA.`);
                
                const newGesture = this.getGesture();
                if (newGesture && newGesture.length > 0 && this.gesturePlayer) {
                    console.log("Iniciando reproducción del gesto recién grabado...");
                    
                    const startTime = newGesture[0].t;
                    const normalizedGesture = newGesture.map(p => ({ t: p.t - startTime, c: p.c }));
                    
                    this.gesturePlayer.playGesture(this, normalizedGesture, 0);
                }
                resolve();
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
        const baseData = super.serialize();
        return {
            ...baseData,
            type: 'instrument',
            mode: this.mode,
            // Nota: La 'gesture' no se está serializando aún.
        };
    }

    loadData(data) {
        super.loadData(data);
        this.setMode(data.mode || 'melodic');
        // Nota: La 'gesture' no se está cargando aún.
    }

    dispose() {
        if (this.synth) this.synth.dispose();
        super.dispose();
    }
}