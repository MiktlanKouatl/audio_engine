// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { SphereManager } from './managers/SphereManager.js';
import { VisualScene } from './modules/VisualScene.js';
import { GestureLibrary } from './modules/GestureLibrary.js';
import { InstrumentTrack } from './modules/InstrumentTrack.js'; // Asegúrate que esta importación esté

function init() {
    console.log("Inicializando aplicación...");

    // Estado de la aplicación
    let appState = {
        isTyping: false,
        isRecordingArmed: false,
        isMetronomeOn: false 
    };

    // Módulos principales
    const audioEngine = new AudioEngine();
    const visualScene = new VisualScene('scene-container');
    const sphereManager = new SphereManager();

    // Conexión central: La escena visual notifica a main.js sobre las interacciones
    visualScene.onInteraction = (data) => {
        if (appState.isTyping) return;

        switch (data.type) {
            case 'ui-click':
                handleUIClick(data.element);
                break;
            case 'disc-drag':
                const activeTrack = audioEngine.activeTrack;
                if (activeTrack && activeTrack instanceof InstrumentTrack) {
                    const timeInBeats = audioEngine.getTransportState().beats; 
                    activeTrack.recordGesture(timeInBeats, data);
                }
                audioEngine.playPreviewNote(data);
                break;
            case 'fx-update':
                break;
        }
    };

    // Función que maneja los clics en los elementos interactivos de la UI 3D
    function handleUIClick(elementName) {

        if (elementName.startsWith('rec-arm-track-')) {
            const trackId = parseInt(elementName.split('-').pop());
            const result = audioEngine.armTrackForRecording(trackId);
            if (result) {
                visualScene.setTrackUIArmedState(trackId, result.state === 'armed');
            }
            return;
        }

        if (elementName.startsWith('track-select-')) {
            const trackId = parseInt(elementName.split('-').pop());
            const trackObject = audioEngine.tracks.find(t => t.id === trackId);
            
            if (trackObject) {
                audioEngine.setActiveTrack(trackObject);
                visualScene.setActiveTrackUI(trackId);
            }
            return;
        }
        
        let currentBPM = audioEngine.getBPM();
        let loopLength = audioEngine.getLoopLength();

        switch (elementName) {
            case 'transport-toggle':
                const transportState = audioEngine.toggleTransport();
                const activeTrack = audioEngine.activeTrack;
                if (transportState === 'stopped' && activeTrack) {
                    audioEngine.gesturePlayer.stopGesture(activeTrack.id);
                }
                break;
            case 'tempo-increment':
                audioEngine.setBPM(currentBPM + 1);
                break;
            case 'tempo-decrement':
                audioEngine.setBPM(currentBPM - 1);
                break;
            case 'measures-increment':
                loopLength++;
                audioEngine.setLoopLength(loopLength);
                visualScene.rebuildVisualizers(loopLength, 4);
                visualScene.updateMeasuresDisplay(loopLength);
                break;
            case 'measures-decrement':
                if (loopLength > 1) {
                    loopLength--;
                    audioEngine.setLoopLength(loopLength);
                    visualScene.rebuildVisualizers(loopLength, 4);
                    visualScene.updateMeasuresDisplay(loopLength);
                }
                break;
            case 'metronome-toggle':
                appState.isMetronomeOn = !appState.isMetronomeOn;
                audioEngine.toggleMetronome(appState.isMetronomeOn);
                visualScene.toggleMetronomeVisuals(appState.isMetronomeOn);
                break;

            case 'create-audio-track': {
                const newAudioTrack = audioEngine.createAudioTrack('Loop Audio');
                const position = sphereManager.addTrack(newAudioTrack.id);

                if (position) {
                    visualScene.createTrackUI({
                        id: newAudioTrack.id,
                        name: newAudioTrack.name,
                        type: 'audio',
                        position: position
                    });
                    audioEngine.setActiveTrack(newAudioTrack);
                    visualScene.setActiveTrackUI(newAudioTrack.id);
                } else {
                    audioEngine.deleteTrack(newAudioTrack);
                    console.log("No se pudo crear la pista: no hay más slots.");
                }
                break;
            }

            case 'create-instrument-track': {
                const newInstrumentTrack = audioEngine.createInstrumentTrack('Instrumento');
                const position = sphereManager.addTrack(newInstrumentTrack.id);

                if (position) {
                    visualScene.createTrackUI({
                        id: newInstrumentTrack.id,
                        name: newInstrumentTrack.name,
                        type: 'instrument',
                        position: position
                    });
                    audioEngine.setActiveTrack(newInstrumentTrack);
                    visualScene.setActiveTrackUI(newInstrumentTrack.id);
                } else {
                    audioEngine.deleteTrack(newInstrumentTrack);
                    console.log("No se pudo crear la pista: no hay más slots.");
                }
                break;
            }
        }
    }

    // Listener para atajos de teclado
    window.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || appState.isTyping) return;
        const key = event.key.toLowerCase();

        if (key === 't') {
            appState.isTyping = true;
            const newBPM = prompt('Nuevo TEMPO (BPM):', audioEngine.getBPM());
            if (newBPM !== null && !isNaN(newBPM)) {
                audioEngine.setBPM(parseFloat(newBPM));
            }
            appState.isTyping = false;
        }

        if (key === 'r') {
            appState.isRecordingArmed = !appState.isRecordingArmed;
            console.log(`Modo de grabación de gesto: ${appState.isRecordingArmed ? 'ARMADO' : 'DESARMADO'}`);
            visualScene.setRecordingState(appState.isRecordingArmed);
        }
    });

    // Bucle principal de actualización
    function uiUpdateLoop() {
        const currentBPM = audioEngine.getBPM();
        visualScene.updateTempoDisplay(currentBPM);

        const currentMeasure = audioEngine.getCurrentMeasure();
        visualScene.setActiveMeasure(currentMeasure);

        const currentBeat = audioEngine.getCurrentBeat();
        visualScene.setActiveBeat(currentBeat);

        const activeTrack = audioEngine.activeTrack;
        
        audioEngine.tracks.forEach(track => {
            if (track instanceof InstrumentTrack) {
                const coord = audioEngine.gesturePlayer.getCurrentCoordinate(track.id);
                let isVisible = activeTrack ? (activeTrack.id === track.id) : true;
                visualScene.updateGhostFinger(track.id, coord, isVisible);
            }
        });

        requestAnimationFrame(uiUpdateLoop);
    }
    
    // Botón de inicio
    const startButton = document.createElement('button');
    startButton.id = 'start-audio-button';
    startButton.textContent = '▶ Iniciar Motor de Audio';
    document.body.appendChild(startButton);
    
    startButton.addEventListener('click', async () => {
        await audioEngine.start();
        console.log("Motor de Audio iniciado por el usuario.");
        uiUpdateLoop();
        startButton.style.display = 'none';
    }, { once: true });
}

window.addEventListener('load', init);