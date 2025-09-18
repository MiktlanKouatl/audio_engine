// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { Track } from './modules/Track.js';
import { LoopVisualizer } from './modules/LoopVisualizer.js';
import { BeatVisualizer } from './modules/BeatVisualizer.js';
import { RecorderModule } from './modules/RecorderModule.js';
import { sessionManager } from './managers/SessionManager.js';

// Envolvemos toda la lógica en una función 'init' para asegurar
// que el DOM esté completamente cargado antes de ejecutar el código.
function init() {
    console.log("Inicializando aplicación...");

    //  Obtenemos las referencias a los elementos del DOM que necesitamos.
    const startButton = document.getElementById('start-button');
    const playStopButton = document.getElementById('play-stop-button');
    const statusDisplay = document.getElementById('status-display');
    const loopLengthInput = document.getElementById('loop-length-input');
    const loopVisualizerContainer = document.getElementById('loop-visualizer');
    const beatVisualizerContainer = document.getElementById('beat-visualizer');
    const enableMicButton = document.getElementById('enable-mic-button');
    const tracksContainer = document.getElementById('tracks-container');
    const recordNewTrackButton = document.getElementById('record-new-track-button');
    const saveSessionButton = document.getElementById('save-session-button');
    const loadMenuContainer = document.getElementById('load-menu-container');
    const metronomeToggle = document.getElementById('metronome-toggle');



    //  Creamos una instancia de nuestro motor de audio.
    const audioEngine = new AudioEngine();
    const recorderModule = new RecorderModule(audioEngine.transport);
    audioEngine.recorderModule = recorderModule;
    const loopVisualizer = new LoopVisualizer(audioEngine, loopVisualizerContainer);
    const beatVisualizer = new BeatVisualizer(audioEngine, beatVisualizerContainer);

    /* const trackCount = 2; // Vamos a crear 2 pistas vacías para grabar
    for (let i = 0; i < trackCount; i++) {
        // ¡Inyectamos el recorderModule en cada pista!
        const track = new Track(`Pista ${i + 1}`, recorderModule);
        audioEngine.addTrack(track);
    } */

    // --- Lógica de UI ---
    function renderTracks() {
        tracksContainer.innerHTML = '';
        audioEngine.tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-ui-container';

            const mainButton = document.createElement('button');
            mainButton.className = 'track-button';
            mainButton.textContent = track.name;
            mainButton.classList.add(track.state);
            trackElement.appendChild(mainButton);

            // Si la pista tiene un loop, añadimos controles y botón de borrar
            if (track.state === 'has_loop') {
                // Botón Mute (modifica el botón principal)
                mainButton.textContent = track.channel.mute ? `${track.name} (Muted)` : track.name;
                mainButton.style.opacity = track.channel.mute ? 0.5 : 1;
                mainButton.onclick = () => {
                    track.toggleMute();
                    renderTracks(); // Redibujar para actualizar el texto
                };

                // Contenedor para los controles de mezcla
                const mixerControls = document.createElement('div');
                mixerControls.className = 'mixer-controls';

                // Control de Volumen
                const volGroup = document.createElement('div');
                volGroup.className = 'slider-group';
                volGroup.innerHTML = `<label>Vol</label><input type="range" min="-48" max="6" value="${track.channel.volume.value}" step="1">`;
                volGroup.querySelector('input').addEventListener('input', e => track.setVolume(parseFloat(e.target.value)));
                mixerControls.appendChild(volGroup);

                // Control de Paneo
                const panGroup = document.createElement('div');
                panGroup.className = 'slider-group';
                panGroup.innerHTML = `<label>Pan</label><input type="range" min="-1" max="1" value="${track.channel.pan.value}" step="0.01">`;
                panGroup.querySelector('input').addEventListener('input', e => track.setPan(parseFloat(e.target.value)));
                mixerControls.appendChild(panGroup);

                trackElement.appendChild(mixerControls);

                // Control de Tono (Pitch)
                const pitchGroup = document.createElement('div');
                pitchGroup.className = 'slider-group';
                // El valor 'pitch' en el PitchShift es en semitonos.
                pitchGroup.innerHTML = `<label>Tono</label><input type="range" min="-12" max="12" value="${track.pitchShift.pitch}" step="1">`;
                pitchGroup.querySelector('input').addEventListener('input', e => track.setPitch(parseFloat(e.target.value)));
                mixerControls.appendChild(pitchGroup);

                trackElement.appendChild(mixerControls);


                // Botón de Borrar
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-button';
                deleteButton.textContent = '✖';
                deleteButton.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Seguro que quieres borrar "${track.name}"?`)) {
                        audioEngine.deleteTrack(track);
                        renderTracks();
                    }
                };
                trackElement.appendChild(deleteButton);
            }
            tracksContainer.appendChild(trackElement);
        });
    }
    

    // Listener para el botón de Grabar Nuevo Loop
    recordNewTrackButton.addEventListener('click', async () => {
        if (audioEngine.getTransportState().state !== 'started') {
            alert("¡Presiona 'Play' primero para establecer el ritmo!");
            return;
        }
        if (recorderModule.state !== 'idle') {
            alert("La grabadora ya está en uso.");
            return;
        }

        // 1. Creamos la nueva pista a través del motor
        const newTrack = audioEngine.createNewTrack(recorderModule);
        
        // 2. Redibujamos la UI para que aparezca el botón de la nueva pista
        renderTracks();

        // 3. Invocamos la grabación en la nueva pista
        //    'await' asegura que la UI se actualice después de que todo termine.
        await newTrack.armRecord();

        // 4. Volvemos a dibujar para reflejar el estado final ('has_loop')
        renderTracks();
    });

    // --- Lógica del input de Loop Length ---
    loopLengthInput.addEventListener('input', (event) => {
        const measures = parseInt(event.target.value, 10);
        if (!isNaN(measures) && measures >= 1 && measures <= 32) { // Asegurarse de tener límites
            audioEngine.setLoopLength(measures);
            // El visualizador se redibuja solo al detectar el cambio en el bucle de animación.
        }
    });
    // Asegurarse de que el input tenga el valor inicial del AudioEngine
    loopLengthInput.value = audioEngine.loopLengthInMeasures;


    // --- Event listener para el control del loop ---
    loopLengthInput.addEventListener('input', (event) => {
        const measures = parseInt(event.target.value, 10);
        
        // Validamos que sea un número válido y positivo
        if (!isNaN(measures) && measures > 0) {
            audioEngine.setLoopLength(measures);
        }
    });

    //  Añadimos el Event Listener al botón.
    // La función del evento debe ser 'async' para poder usar 'await'.
    startButton.addEventListener('click', async () => {
        try {
            // Llamamos al método start() de nuestro motor y esperamos a que termine.
            await audioEngine.start();
            renderTracks();
            // Si todo va bien, actualizamos la UI para dar feedback al usuario.
            statusDisplay.textContent = "Motor de Audio: LISTO";
            startButton.style.display = 'none'; // Ocultamos el botón de inicio
            playStopButton.style.display = 'inline-block'; // ¡Mostramos el de Play/Stop!
            enableMicButton.style.display = 'inline-block'; // Mostramos el botón de micrófono
            saveSessionButton.style.display = 'inline-block'; // Mostramos el botón de guardar

            //startButton.textContent = "Motor Iniciado";
            //startButton.disabled = true; // Deshabilitamos el botón una vez usado.
            //startButton.style.backgroundColor = '#01FF70'; // Un verde brillante
            //startButton.style.color = '#111';

        } catch (error) {
            console.error("No se pudo iniciar el motor de audio:", error);
            statusDisplay.textContent = "Error al iniciar el motor.";
        }
    });
    //Conectamos el botón para habilitar el micrófono
    enableMicButton.addEventListener('click', async () => {
        await recorderModule.initializeMicrophone();
        // Damos feedback visual de que el micrófono está listo
        enableMicButton.style.backgroundColor = '#01FF70';
        enableMicButton.style.color = '#111';
        enableMicButton.textContent = '🎙️ Mic Listo';
    });
    playStopButton.addEventListener('click', () => {
        audioEngine.toggleTransport();

        // Actualizamos el texto del botón y el estado según el transporte.
        const transportState = audioEngine.getTransportState();
        if (transportState.state === 'started') {
            playStopButton.textContent = 'Stop';
            statusDisplay.textContent = 'Reproduciendo...';
        } else {
            playStopButton.textContent = 'Play';
            statusDisplay.textContent = 'Detenido.';
        }
    });
    // Listener para el botón de Guardar
    saveSessionButton.addEventListener('click', async () => {
        const sessionName = prompt("Elige un nombre para tu sesión:", `Sesión ${new Date().toLocaleTimeString()}`);
        if (!sessionName) return; // El usuario canceló

        try {
            const sessionData = audioEngine.serialize();
            await sessionManager.saveSession(sessionName, sessionData);
        } catch (error) {
            console.error("Error al guardar la sesión:", error);
            alert("No se pudo guardar la sesión.");
        }
    });
    metronomeToggle.addEventListener('change', (event) => {
        audioEngine.toggleMetronome(event.target.checked);
    });
    // --- Lógica de Carga al Iniciar ---
    async function populateLoadMenu() {
        try {
            const sessions = await sessionManager.getSavedSessions();
            if (sessions.length > 0) {
                loadMenuContainer.innerHTML = '<h3>Cargar Sesión:</h3>';
                const select = document.createElement('select');
                select.innerHTML = `<option>-- Elige una sesión --</option>`;
                sessions.forEach(session => {
                    select.innerHTML += `<option value="${session.name}">${session.name}</option>`;
                });

                select.addEventListener('change', async (event) => {
                    const sessionName = event.target.value;
                    if (!sessionName || sessionName.startsWith('--')) return;

                    try {
                        const sessionData = await sessionManager.loadSession(sessionName);
                        await audioEngine.loadSessionData(sessionData);
                        document.getElementById('loop-length-input').value = audioEngine.loopLengthInMeasures;
                        renderTracks(); // ¡Fundamental para mostrar la sesión cargada!
                        alert(`¡Sesión "${sessionName}" cargada!`);
                    } catch (e) {
                        alert("Error al cargar la sesión.");
                        console.error(e);
                    }
                });
                loadMenuContainer.appendChild(select);
            }
        } catch (e) {
            console.warn("No se pudo cargar la lista de sesiones guardadas.", e);
        }
    }
    
    // Llamamos a la función para poblar el menú cuando la app inicia
    populateLoadMenu();
}

// Nos aseguramos de llamar a init() solo cuando la página se haya cargado por completo.
window.addEventListener('load', init);