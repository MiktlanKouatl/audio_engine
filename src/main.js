// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { SphereManager } from './managers/SphereManager.js';
import { VisualScene } from './modules/VisualScene.js';
import { GestureLibrary } from './modules/GestureLibrary.js';
import { InstrumentTrack } from './modules/InstrumentTrack.js'; // Asegúrate que esta importación esté
import { sessionManager } from './managers/SessionManager.js';

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
    const sphereManager = new SphereManager();
    const visualScene = new VisualScene('scene-container', sphereManager);

    // Conexión central: La escena visual notifica a main.js sobre las interacciones
    visualScene.onInteraction = async (data) => {
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
            case 'track-param-change':
                const { trackId, param, value } = data.payload;
                const track = audioEngine.tracks.find(t => t.id === trackId);
                if (track) {
                    if (param === 'volume') {
                        track.setVolume(value);
                    }
                    // En el futuro, aquí se manejarían otros parámetros como 'pan'
                }
                break;
            case 'track-delete': {
                const { trackId } = data.payload;
                const trackToDelete = audioEngine.tracks.find(t => t.id === trackId);
                if (trackToDelete) {
                    audioEngine.deleteTrack(trackToDelete);
                    visualScene.deleteTrackUI(trackId);
                    sphereManager.removeTrack(trackId);
                }
                break;
            }
            case 'load-session-by-name': {
                const { sessionName } = data.payload;
                if (sessionName) {
                    try {
                        const sessionData = await sessionManager.loadSession(sessionName);
                        
                        // Clear existing tracks
                        [...audioEngine.tracks].forEach(track => {
                            visualScene.deleteTrackUI(track.id);
                            sphereManager.removeTrack(track.id);
                            audioEngine.deleteTrack(track);
                        });

                        await audioEngine.loadSessionData(sessionData);

                        // Recreate UI for loaded tracks
                        audioEngine.tracks.forEach(track => {
                            const position = sphereManager.addTrack(track.id);
                            if (position) {
                                visualScene.createTrackUI({
                                    id: track.id,
                                    name: track.name,
                                    type: track instanceof InstrumentTrack ? 'instrument' : 'audio',
                                    position: position
                                });
                            }
                        });

                        // Update global controls
                        visualScene.globalControls.updateMeasuresDisplay(audioEngine.getLoopLength());
                        visualScene.rebuildVisualizers(audioEngine.getLoopLength(), 4);

                        alert("Sesión cargada.");
                    } catch (error) {
                        console.error("Error al cargar la sesión:", error);
                        alert("Error al cargar la sesión.");
                    }
                }
                break;
            }
            case 'fx-update':
                break;
        }
    };

    // Función que maneja los clics en los elementos interactivos de la UI 3D
    async function handleUIClick(elementName) {
        console.log(`handleUIClick received: ${elementName}`);

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
                visualScene.globalControls.updateMeasuresDisplay(loopLength);
                break;
            case 'measures-decrement':
                if (loopLength > 1) {
                    loopLength--;
                    audioEngine.setLoopLength(loopLength);
                    visualScene.rebuildVisualizers(loopLength, 4);
                    visualScene.globalControls.updateMeasuresDisplay(loopLength);
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

            case 'save-session': {
                const sessionName = prompt("Nombre de la sesión:");
                if (sessionName) {
                    const sessionData = await audioEngine.serialize();
                    await sessionManager.saveSession(sessionName, sessionData);
                    alert("Sesión guardada.");
                }
                break;
            }

            case 'load-session': {
                const sessions = await sessionManager.getSavedSessions();
                if (sessions.length === 0) {
                    alert("No hay sesiones guardadas.");
                    return;
                }
                visualScene.showSessionList(sessions);
                break;
            }

            case 'bounce-tracks':
                visualScene.enterBounceMode();
                break;

            case 'confirm-bounce': {
                console.log("Confirm bounce clicked");
                const tracksToBounce = visualScene.bounceSelection.map(id => audioEngine.tracks.find(t => t.id === id));
                if (tracksToBounce.length < 2) {
                    alert("Selecciona al menos 2 pistas para unir.");
                    return;
                }
                const newTrack = await audioEngine.bounceTracks(tracksToBounce);
                visualScene.exitBounceMode();
                tracksToBounce.forEach(track => {
                    visualScene.deleteTrackUI(track.id);
                    sphereManager.removeTrack(track.id);
                });
                const position = sphereManager.addTrack(newTrack.id);
                if (position) {
                    visualScene.createTrackUI({
                        id: newTrack.id,
                        name: newTrack.name,
                        type: 'audio', // Bounced tracks are always audio
                        position: position
                    });
                }
                break;
            }

            case 'cancel-bounce':
                visualScene.exitBounceMode();
                break;
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
        visualScene.globalControls.updateTempoDisplay(currentBPM);

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

            // --- Lógica del VU-metro ---
            if (typeof track.getLevel === 'function') {
                const level = track.getLevel();
                visualScene.updateTrackVUMeter(track.id, level);
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