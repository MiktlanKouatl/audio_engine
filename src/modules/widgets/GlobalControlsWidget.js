import * as THREE from 'three';
import { Text } from 'troika-three-text';

export class GlobalControlsWidget extends THREE.Group {
    constructor(interactiveControls) {
        super();

        this.interactiveControls = interactiveControls;

        this.audioTrackButton = null;
        this.instrumentTrackButton = null;
        this.buttonMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });

        this._createNewTrackButtons();

        // --- Widget de Tempo ---
        this.tempo = new THREE.Group();
        this.tempoText = new Text();
        this.tempoText.text = 'TEMPO (BPM) < 120 >';
        this.tempoText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        this.tempoText.fontSize = 0.2;
        this.tempoText.color = 0xFFFFFF;
        this.tempoText.anchorX = 'left';
        this.tempo.add(this.tempoText);
        this.add(this.tempo);
        this.tempoText.sync();

        const buttonGeometry = new THREE.PlaneGeometry(0.2, 0.2);
        const tempoDec = new THREE.Mesh(buttonGeometry.clone(), this.buttonMaterial);
        tempoDec.name = 'tempo-decrement';
        tempoDec.position.set(1.5, -0.13, 0);
        this.tempo.add(tempoDec);
        this.interactiveControls.push(tempoDec);

        const tempoInc = new THREE.Mesh(buttonGeometry.clone(), this.buttonMaterial);
        tempoInc.name = 'tempo-increment';
        tempoInc.position.set(2.22, -0.13, 0);
        this.tempo.add(tempoInc);
        this.interactiveControls.push(tempoInc);

        // --- Widget de Compases ---
        this.measures = new THREE.Group();
        this.measuresText = new Text();
        this.measuresText.text = 'COMPASES < 4 >';
        this.measuresText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        this.measuresText.fontSize = 0.2;
        this.measuresText.color = 0xFFFFFF;
        this.measuresText.anchorX = 'left';
        this.measures.add(this.measuresText);
        this.add(this.measures);
        this.measuresText.sync();

        const measuresDec = new THREE.Mesh(buttonGeometry.clone(), this.buttonMaterial);
        measuresDec.name = 'measures-decrement';
        measuresDec.position.set(1.14, -0.13, 0);
        this.measures.add(measuresDec);
        this.interactiveControls.push(measuresDec);

        const measuresInc = new THREE.Mesh(buttonGeometry.clone(), this.buttonMaterial);
        measuresInc.name = 'measures-increment';
        measuresInc.position.set(1.61, -0.13, 0);
        this.measures.add(measuresInc);
        this.interactiveControls.push(measuresInc);

        // --- Botón de Play/Stop ---
        this.playButton = new THREE.Group();
        const playButtonText = new Text();
        playButtonText.text = 'PLAY ▶';
        playButtonText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        playButtonText.fontSize = 0.3;
        playButtonText.color = 0xFFFFFF;
        playButtonText.anchorX = 'left';
        this.playButton.add(playButtonText);
        this.playButton.userData.text = playButtonText;
        playButtonText.sync();

        const playButtonHitbox = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), this.buttonMaterial);
        playButtonHitbox.name = 'transport-toggle';
        playButtonHitbox.position.set(0.63, -0.19, 0);
        this.playButton.add(playButtonHitbox);
        this.interactiveControls.push(playButtonHitbox);
        this.add(this.playButton);

        // --- Metronome Toggle ---
        this.metronome = new THREE.Group();
        const metroButtonGeo = new THREE.CircleGeometry(0.1, 8);
        const metroButtonMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const metronomeButton = new THREE.Mesh(metroButtonGeo, metroButtonMat);
        metronomeButton.name = 'metronome-toggle';
        const metronomeText = new Text();
        metronomeText.text = 'METRONOMO';
        metronomeText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        metronomeText.fontSize = 0.2;
        metronomeText.color = 0xffffff;
        metronomeText.anchorX = 'left';
        this.metronome.add(metronomeText);
        metronomeText.sync();
        metronomeButton.position.set(1.4, -0.13, 0); // Position next to text
        this.metronome.add(metronomeButton);
        this.interactiveControls.push(metronomeButton);
        this.metronome.userData.button = metronomeButton;
        this.add(this.metronome);
    }

    updateLayout(camera) {
        const padding = 0.5;
        const top = camera.top - padding;
        const left = camera.left + padding;
        const right = camera.right - padding;

        // Posiciona los controles existentes a la izquierda
        this.playButton.position.set(left, top, 0);
        this.tempo.position.set(left, top - 0.5, 0);
        this.measures.position.set(left, top - 0.9, 0);
        this.metronome.position.set(left, top - 1.3, 0);

        // Posiciona los nuevos botones a la derecha
        if (this.audioTrackButton) {
            this.audioTrackButton.position.set(right - 1, top, 0);
        }
        if (this.instrumentTrackButton) {
            this.instrumentTrackButton.position.set(right - 1, top - 0.5, 0);
        }
    }

    updateTempoDisplay(bpm) {
        if (this.tempoText) {
            this.tempoText.text = `TEMPO (BPM) < ${bpm.toFixed(0)} >`;
            this.tempoText.sync();
        }
    }

    updateMeasuresDisplay(measures) {
        if (this.measuresText) {
            this.measuresText.text = `COMPASES < ${measures} >`;
            this.measuresText.sync();
        }
    }

    _createNewTrackButtons() {
        this.audioTrackButton = new THREE.Group();
        const audioText = new Text();
        audioText.text = '[+ AUDIO]';
        audioText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        audioText.fontSize = 0.2;
        audioText.color = 0xFFFFFF;
        audioText.anchorX = 'center';
        audioText.anchorY = 'middle';
        this.audioTrackButton.add(audioText);
        this.add(this.audioTrackButton);

        audioText.sync(() => {
            const bbox = audioText.geometry.boundingBox;
            const width = bbox.max.x - bbox.min.x;
            const height = bbox.max.y - bbox.min.y;
            const audioHitbox = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.buttonMaterial);
            audioHitbox.name = 'create-audio-track';
            this.audioTrackButton.add(audioHitbox);
            this.interactiveControls.push(audioHitbox);
        });

        this.instrumentTrackButton = new THREE.Group();
        const instrumentText = new Text();
        instrumentText.text = '[+ INSTR]';
        instrumentText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        instrumentText.fontSize = 0.2;
        instrumentText.color = 0xFFFFFF;
        instrumentText.anchorX = 'center';
        instrumentText.anchorY = 'middle';
        this.instrumentTrackButton.add(instrumentText);
        this.add(this.instrumentTrackButton);

        instrumentText.sync(() => {
            const bbox = instrumentText.geometry.boundingBox;
            const width = bbox.max.x - bbox.min.x;
            const height = bbox.max.y - bbox.min.y;
            const instrumentHitbox = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.buttonMaterial);
            instrumentHitbox.name = 'create-instrument-track';
            this.instrumentTrackButton.add(instrumentHitbox);
            this.interactiveControls.push(instrumentHitbox);
        });
    }
}
