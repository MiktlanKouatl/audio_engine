// interfaces/TweakpaneInterface.js
import { Pane } from 'tweakpane';

export class TweakpaneInterface {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.pane = new Pane({ title: 'Panel de Control' });
        this.params = {
            beat: '● ● ● ●',
            masterProgress: '' // 1. Parámetro para nuestra barra de progreso
        };
    }

    init() {
        this.addTransportControls();
        this.addMasterControls();
        this.addBeatVisualizer();
        
        
        // Creamos controles para TODAS las pistas
        for (let i = 0; i < this.audioEngine.trackCount; i++) {
            this.addTrackControls(i);
        }
    }

    addTransportControls() {
        const transportFolder = this.pane.addFolder({ title: 'Global' });
        
        // Hacemos que la función del evento sea 'async'
        transportFolder.addButton({ title: 'Play/Stop' }).on('click', async () => {
            console.log('[DEBUG] Clic en Play/Stop detectado en Tweakpane.');
            // Y le decimos que 'espere' a que toggleTransport termine.
            await this.audioEngine.toggleTransport();
        });
        
        const bpmParams = { bpm: 120 };
        transportFolder.addBinding(bpmParams, 'bpm', {
            min: 60, max: 180, step: 1, label: 'Tempo (BPM)'
        }).on('change', (ev) => {
            this.audioEngine.setBPM(ev.value);
        });
    }
    addMasterControls() {
        const masterFolder = this.pane.addFolder({ title: 'Ciclo Maestro' });

        masterFolder.addBinding({ length: 16 }, 'length', {
            label: 'Tiempos Totales',
            step: 4, // Solo permitimos múltiplos de 4 (un compás)
            min: 4,
            max: 64,
        }).on('change', ev => {
            this.audioEngine.setMasterLoopLength(ev.value);
        });

        masterFolder.addBinding(this.params, 'masterProgress', {
            readonly: true,
            label: 'Progreso',
            interval: 50,
            multiline: true,
            rows: 2
        });
        
        // Conectamos el notificador del motor a nuestra barra de progreso
        this.audioEngine.onMasterProgressChange = (currentBeat, totalBeats) => {
            const beatsPerLine = 16; // Máximo de tiempos por renglón
            let visual = [];

            for (let i = 0; i < totalBeats; i++) {
                // Añade el caracter del pulso (cursor '|' o punto '·')
                visual.push(i === currentBeat ? '|' : '·');

                // Si hemos llegado al final de un renglón y no es el final del todo,
                // añade un salto de línea.
                if ((i + 1) % beatsPerLine === 0 && i < totalBeats - 1) {
                    visual.push('\n');
                }
            }
            this.params.masterProgress = visual.join('');
        };
    }
    // Renombramos el método para mayor claridad
    addTrackControls(trackId) {
        const trackFolder = this.pane.addFolder({ title: `Pista ${trackId + 1}` });
        const trackParams = { volume: 0, pan: 0 };

        trackFolder.addBinding(trackParams, 'volume', {
            min: -48, max: 6, step: 1, label: 'Volumen (dB)'
        }).on('change', (ev) => {
            this.audioEngine.setTrackVolume(trackId, ev.value);
        });

        trackFolder.addBinding(trackParams, 'pan', {
            min: -1, max: 1, step: 0.01, label: 'Paneo'
        }).on('change', (ev) => {
            this.audioEngine.setTrackPan(trackId, ev.value);
        });

        trackFolder.addButton({ title: 'Mute' }).on('click', () => {
            this.audioEngine.toggleMute(trackId);
        });
    }

    addBeatVisualizer() {
        const visualizerFolder = this.pane.addFolder({ title: 'Metrónomo Visual' });
        visualizerFolder.addBinding(this.params, 'beat', {
            readonly: true, label: 'Compás', interval: 50,
        });
        
        this.audioEngine.onBeatChange = (beat) => {
            const visual = ['○', '○', '○', '○'];
            if (beat >= 0 && beat < 4) { visual[beat] = '●'; }
            this.params.beat = visual.join(' ');
        };
    }
}