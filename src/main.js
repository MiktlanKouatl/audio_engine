// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { VisualScene } from './modules/VisualScene.js';
import { GestureLibrary } from './modules/GestureLibrary.js';
import { InstrumentTrack } from './modules/InstrumentTrack.js'; // Asegúrate que esta importación esté

function init() {
    console.log("Inicializando aplicación...");

    // Estado de la aplicación para gestionar interacciones complejas
    let appState = {
        isTyping: false,
        isRecordingArmed: false,
        isMetronomeOn: false 
    };

    // Almacenamiento de las pistas creadas en la sesión actual
    const createdTracks = {
        'audio-slot-1': null,
        'instrument-slot-1': null
    };

    // Módulos principales
    const audioEngine = new AudioEngine();
    const visualScene = new VisualScene('scene-container');

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
                 // Dejamos esto preparado para cuando implementemos los FX
                // audioEngine.updateActiveTrackFX(data.x, data.y);
                break;
        }
    };

    // Función que maneja los clics en los elementos interactivos de la UI 3D
    function handleUIClick(elementName) {

        // --- LÓGICA DE ARMADO --->
        if (elementName.startsWith('rec-arm-track-')) {
            const trackId = parseInt(elementName.split('-').pop());
            
            // ANTES: const result = audioEngine.armTrackForQuantizedRecording(trackId);
            // AHORA:
            const result = audioEngine.armTrackForRecording(trackId);
            
            if (result) {
                // La UI mostrará 'armed' (botón verde). El cambio a 'recording' (ej. rojo parpadeante)
                // lo manejaremos en el futuro escuchando los cambios de estado de la pista.
                visualScene.setTrackUIArmedState(trackId, result.state === 'armed');
            }
            return;
        }
        // <--- LÓGICA DE ARMADO ---
        // --- LÓGICA DE SELECCIÓN DE PISTA! --->
        if (elementName.startsWith('track-select-')) {
            const trackId = parseInt(elementName.split('-').pop());
            
            // Buscamos el objeto de la pista en nuestro registro
            const trackObject = Object.values(createdTracks).find(t => t && t.id === trackId);
            
            if (trackObject) {
                // 1. Le decimos al AudioEngine cuál es la nueva pista activa
                audioEngine.setActiveTrack(trackObject);
                // 2. Le decimos a la VisualScene que actualice el contorno
                visualScene.setActiveTrackUI(trackId);
            }
            return;
        }
        // <--- LÓGICA DE SELECCIÓN DE PISTA ---
        
        let currentBPM = audioEngine.getBPM();
        let loopLength = audioEngine.getLoopLength(); // ¡Ahora podemos obtener el valor!

        switch (elementName) {
            case 'transport-toggle':
            const transportState = audioEngine.toggleTransport();
            const activeTrack = audioEngine.activeTrack;

            // Si detenemos el transporte, también detenemos la reproducción del gesto.
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
                visualScene.rebuildVisualizers(loopLength, 4); // Asumiendo 4/4
                visualScene.updateMeasuresDisplay(loopLength);
                break;
            case 'measures-decrement':
                if (loopLength > 1) { // Evitar ir a 0 o menos compases
                    loopLength--;
                    audioEngine.setLoopLength(loopLength);
                    visualScene.rebuildVisualizers(loopLength, 4); // Asumiendo 4/4
                    visualScene.updateMeasuresDisplay(loopLength);
                }
                break;
            case 'metronome-toggle':
                // 1. Invertimos el estado
                appState.isMetronomeOn = !appState.isMetronomeOn;
                // 2. Le decimos al AudioEngine qué hacer
                audioEngine.toggleMetronome(appState.isMetronomeOn);
                // 3. Le decimos a la VisualScene que actualice el color del botón
                visualScene.toggleMetronomeVisuals(appState.isMetronomeOn);
                break;
            case 'create-audio-track':
                // Por ahora, solo permitimos crear una pista de cada tipo para simplificar
                if (!createdTracks['audio-slot-1']) {
                    const newAudioTrack = audioEngine.createAudioTrack('Loop Audio');
                    createdTracks['audio-slot-1'] = newAudioTrack;
                    
                    // ¡CONEXIÓN CLAVE! Le pedimos a la escena que dibuje la UI para esta nueva pista.
                    visualScene.createTrackUI({
                        id: newAudioTrack.id,
                        name: newAudioTrack.name,
                        type: 'audio'
                    });
                }
                audioEngine.setActiveTrack(createdTracks['audio-slot-1']);
                // visualScene.setActiveSlot(elementName); // Esta línea ya no es necesaria
                break;

            case 'create-instrument-track':
                if (!createdTracks['instrument-slot-1']) {
                    const newInstrumentTrack = audioEngine.createInstrumentTrack('Instrumento');
                    createdTracks['instrument-slot-1'] = newInstrumentTrack;

                    // ¡CONEXIÓN CLAVE! Le pedimos a la escena que dibuje la UI para esta nueva pista.
                    visualScene.createTrackUI({
                        id: newInstrumentTrack.id,
                        name: newInstrumentTrack.name,
                        type: 'instrument'
                    });
                }
                audioEngine.setActiveTrack(createdTracks['instrument-slot-1']);
                // visualScene.setActiveSlot(elementName); // Esta línea ya no es necesaria
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

    // Bucle principal para mantener la UI 3D sincronizada con el estado del AudioEngine
    function uiUpdateLoop() {
        const currentBPM = audioEngine.getBPM();
        visualScene.updateTempoDisplay(currentBPM);

        const currentMeasure = audioEngine.getCurrentMeasure();
        visualScene.setActiveMeasure(currentMeasure);

        const currentBeat = audioEngine.getCurrentBeat();
        visualScene.setActiveBeat(currentBeat);

        requestAnimationFrame(uiUpdateLoop);
    }
    
    // Iniciar todo
    // Necesitamos un botón de "Start" para que el usuario inicie el AudioContext
    const startButton = document.createElement('button');
    startButton.id = 'start-audio-button';
    startButton.textContent = '▶ Iniciar Motor de Audio';
    document.body.appendChild(startButton);
    
    startButton.addEventListener('click', async () => {
        await audioEngine.start();
        console.log("Motor de Audio iniciado por el usuario.");
        uiUpdateLoop(); // Inicia el bucle de actualización solo después de que el motor arranque
        startButton.style.display = 'none'; // Oculta el botón después de usarlo
    }, { once: true });
}

window.addEventListener('load', init);