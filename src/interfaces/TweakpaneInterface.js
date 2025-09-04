// src/interfaces/TweakpaneInterface.js
import { Pane } from 'tweakpane';
import * as Tone from 'tone'; // Se importa Tone para que la UI pueda consultar el transporte

export class TweakpaneInterface {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.pane = new Pane({ title: 'Panel de Control' });
        this.params = {
            beat: '○ ○ ○ ○',
            masterProgress: ''
        };
        this.visualizerInterval = null;
    }

    init() {
        this.addTransportControls();
        this.addMasterControls();
        this.addBeatVisualizer();
        
        for (let i = 0; i < this.audioEngine.trackCount; i++) {
            this.addTrackControls(i);
        }

        // Iniciamos un "reloj" que solo se encarga de actualizar los visualizadores
        this.visualizerInterval = setInterval(() => this.updateVisualizers(), 50);
    }

    // Este nuevo método es el corazón de la UI, se actualiza constantemente
    updateVisualizers() {
        // Si el transporte no se ha creado aún, no hacemos nada
        if (!this.audioEngine.transport || this.audioEngine.transport.state !== 'started') {
            return;
        }

        const transport = this.audioEngine.transport;
        const beatsPerMeasure = this.audioEngine.beatsPerMeasure;
        const totalBeats = this.audioEngine.masterLoopLengthInBeats;

        const [bar, beat] = transport.position.split(':').map(Number);
        const currentBeatInMeasure = Math.floor(beat);
        const absoluteBeat = (bar * beatsPerMeasure) + currentBeatInMeasure;
        const currentMasterBeat = absoluteBeat % totalBeats;

        // Actualiza el monitor de compás
        const beatVisual = ['○', '○', '○', '○'];
        if (currentBeatInMeasure >= 0 && currentBeatInMeasure < beatsPerMeasure) {
            beatVisual[currentBeatInMeasure] = '●';
        }
        this.params.beat = beatVisual.join(' ');
        
        // Actualiza el monitor de progreso maestro
        const beatsPerLine = 16;
        let barVisual = [];
        for (let i = 0; i < totalBeats; i++) {
            barVisual.push(i === currentMasterBeat ? '|' : '·');
            if ((i + 1) % beatsPerLine === 0 && i < totalBeats - 1) {
                barVisual.push('\n');
            }
        }
        this.params.masterProgress = barVisual.join('');
    }

    addTransportControls() {
        const folder = this.pane.addFolder({ title: 'Global' });
        folder.addButton({ title: 'Play/Stop' }).on('click', () => {
            this.audioEngine.toggleTransport();
        });
        
        const bpmParams = { bpm: 120 };
        folder.addBinding(bpmParams, 'bpm', { min: 60, max: 180, step: 1, label: 'Tempo (BPM)'})
            .on('change', (ev) => {
                this.audioEngine.setBPM(ev.value);
            });
    }

    addMasterControls() {
        const folder = this.pane.addFolder({ title: 'Ciclo Maestro' });
        folder.addBinding({ length: 16 }, 'length', { label: 'Tiempos Totales', step: 4, min: 4, max: 64})
            .on('change', ev => {
                this.audioEngine.setMasterLoopLength(ev.value);
            });

        folder.addBinding(this.params, 'masterProgress', {
            readonly: true, label: 'Progreso', multiline: true, rows: 4, interval: 50,
        });
    }

    addBeatVisualizer() {
        const folder = this.pane.addFolder({ title: 'Metrónomo Visual' });
        folder.addBinding(this.params, 'beat', {
            readonly: true, label: 'Compás', interval: 50,
        });
    }

    addTrackControls(trackId) {
        const folder = this.pane.addFolder({ title: `Pista ${trackId + 1}` });
        const params = { volume: 0, pan: 0 };

        folder.addBinding(params, 'volume', { min: -48, max: 6, step: 1, label: 'Volumen (dB)'})
            .on('change', (ev) => { this.audioEngine.setTrackVolume(trackId, ev.value); });

        folder.addBinding(params, 'pan', { min: -1, max: 1, step: 0.01, label: 'Paneo'})
            .on('change', (ev) => { this.audioEngine.setTrackPan(trackId, ev.value); });

        folder.addButton({ title: 'Mute' }).on('click', () => {
            this.audioEngine.toggleMute(trackId);
        });
    }
}