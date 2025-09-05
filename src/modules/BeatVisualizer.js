// BeatVisualizer.js
import { Transport } from 'tone';

export class BeatVisualizer {
    constructor(audioEngine, containerElement) {
        this.audioEngine = audioEngine;
        this.container = containerElement;
        this.indicators = [];
        this.timeSignature = Transport.timeSignature; // Típicamente 4
        this.currentLoopLengthInBeats = 0;
        this.lastActiveBeat = -1;

        this._startAnimationLoop();
    }

    _renderIndicators() {
        this.container.innerHTML = '';
        this.indicators = [];
        const totalBeats = this.audioEngine.loopLengthInMeasures * this.timeSignature;
        this.currentLoopLengthInBeats = totalBeats;

        for (let i = 0; i < totalBeats; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'beat-indicator';
            // Añadimos una clase especial al primer tiempo de cada compás
            if (i % this.timeSignature === 0) {
                indicator.classList.add('measure-start');
            }
            this.container.appendChild(indicator);
            this.indicators.push(indicator);
        }
    }

    _startAnimationLoop() {
        const animate = () => {
            const { position, state } = this.audioEngine.getTransportState();
            const newTotalBeats = this.audioEngine.loopLengthInMeasures * this.timeSignature;

            if (newTotalBeats !== this.currentLoopLengthInBeats) {
                this._renderIndicators();
                this.lastActiveBeat = -1;
            }

            if (state === "started") {
                const [bar, beat] = position.split(':').map(parseFloat);
                // Calculamos el tiempo actual absoluto dentro del loop
                const currentBeatInLoop = (bar % this.audioEngine.loopLengthInMeasures) * this.timeSignature + Math.floor(beat);

                if (currentBeatInLoop !== this.lastActiveBeat) {
                    this.indicators.forEach((indicator, index) => {
                        indicator.classList.toggle('active', index === currentBeatInLoop);
                    });
                    this.lastActiveBeat = currentBeatInLoop;
                }
            } else {
                if (this.lastActiveBeat !== -1) {
                    this.indicators.forEach(indicator => indicator.classList.remove('active'));
                    this.lastActiveBeat = -1;
                }
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
}