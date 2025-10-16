// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { Track } from './modules/Track.js';
import { LoopVisualizer } from './modules/LoopVisualizer.js';
import { BeatVisualizer } from './modules/BeatVisualizer.js';
import { RecorderModule } from './modules/RecorderModule.js';
import { sessionManager } from './managers/SessionManager.js';
import { VisualScene } from './modules/VisualScene.js';


// Envolvemos toda la lógica en una función 'init' para asegurar
// que el DOM esté completamente cargado antes de ejecutar el código.
function init() {
    console.log("Inicializando aplicación...");

    // --- 1. ESTADO DE LA APLICACIÓN ---
    // Este objeto nos ayudará a saber si el usuario está escribiendo.
    let appState = {
        isTyping: false,
        typingTarget: null // 'tempo' o 'loop'
    };
    // ------------------------------------
    const createdTracks = {
        'audio-slot-1': null,
        'instrument-slot-1': null
    };

    const visualScene = new VisualScene('scene-container');

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

    const toggleBounceModeButton = document.getElementById('toggle-bounce-mode-button');
    const confirmBounceButton = document.getElementById('confirm-bounce-button');

    const masterVolumeSlider = document.getElementById('master-volume-slider');
    const metronomeVolumeSlider = document.getElementById('metronome-volume-slider');

    //  Creamos una instancia de nuestro motor de audio.
    const audioEngine = new AudioEngine();
    const recorderModule = new RecorderModule(audioEngine.transport);
    audioEngine.recorderModule = recorderModule;
    
    const loopVisualizer = new LoopVisualizer(audioEngine, loopVisualizerContainer);
    const beatVisualizer = new BeatVisualizer(audioEngine, beatVisualizerContainer);

    let lastActiveMeasure = -1;
    let lastActiveBeat = -1; //

    // --- 2. LÓGICA DE INTERACCIÓN CENTRALIZADA ---
    visualScene.onInteraction = (data) => {
        console.log('Interaction data received:', data); 
        console.log ("data Type", data.type);
        if (appState.isTyping) return; // Si estamos escribiendo, ignorar interacciones 3D

        switch(data.type) {
            case 'ui-click':
                handleUIClick(data.element);
                break;
            case 'disc-drag':
                // La lógica para tocar el disco se mantiene
                audioEngine.playPreviewNote(data);
                break;
        }
    };
    // ---------------------------------------------
    // --- 3. NUEVA FUNCIÓN PARA MANEJAR CLICS EN LA UI ---
    function handleUIClick(elementName) {
        let currentBPM = audioEngine.getBPM();
        // let currentLoopLength = audioEngine.loopLengthInMeasures; // Para el futuro
        
        switch(elementName) {
            case 'tempo-increment':
                audioEngine.setBPM(currentBPM + 1);
                break;
            case 'tempo-decrement':
                audioEngine.setBPM(currentBPM - 1);
                break;
            // --- NUEVOS CASOS PARA LA CREACIÓN DE PISTAS ---
            case 'create-audio-track':
                // Si la pista aún no existe, la creamos
                if (!createdTracks['audio-slot-1']) {
                    const newAudioTrack = audioEngine.createAudioTrack(`Loop #${audioEngine.tracks.length + 1}`);
                    createdTracks['audio-slot-1'] = newAudioTrack;
                }
                // Siempre la seleccionamos como activa
                audioEngine.setActiveTrack(createdTracks['audio-slot-1']);
                visualScene.setActiveSlot(elementName);
                break;

            case 'create-instrument-track':
                if (!createdTracks['instrument-slot-1']) {
                    const newInstrumentTrack = audioEngine.createInstrumentTrack(`Instrumento #${audioEngine.tracks.length + 1}`);
                    createdTracks['instrument-slot-1'] = newInstrumentTrack;
                }
                audioEngine.setActiveTrack(createdTracks['instrument-slot-1']);
                visualScene.setActiveSlot(elementName);
                break;

            // ---------------------------------------------
            // Aquí irían los casos para 'loop-increment', 'save-button', etc.
        }
    }
    // ----------------------------------------------------
    // --- 4. LÓGICA DE TECLADO ---
    window.addEventListener('keydown', (event) => {
        // Ignorar si se está escribiendo en otro campo de texto
        if (event.target.tagName === 'INPUT') return;

        if (event.key.toLowerCase() === 't' && !appState.isTyping) {
            appState.isTyping = true;
            appState.typingTarget = 'tempo';
            
            const newBPM = prompt('Nuevo TEMPO (BPM):', audioEngine.getBPM());
            
            if (newBPM !== null && !isNaN(newBPM)) {
                audioEngine.setBPM(parseFloat(newBPM));
            }
            // El prompt pausa la ejecución, así que reseteamos el estado al terminar
            appState.isTyping = false;
            appState.typingTarget = null;
        }
        // Aquí añadiríamos la lógica para la tecla 'C' de COMPASS/LOOP
    });
3

    /* const trackCount = 2; // Vamos a crear 2 pistas vacías para grabar
    for (let i = 0; i < trackCount; i++) {
        // ¡Inyectamos el recorderModule en cada pista!
        const track = new Track(`Pista ${i + 1}`, recorderModule);
        audioEngine.addTrack(track);
    } */

    // --- Lógica de UI ---

    let isBounceMode = false; // Una variable para saber si estamos en modo de unión



    function renderTracks() {
        tracksContainer.innerHTML = '';
        audioEngine.tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-ui-container';


            if (isBounceMode && track.state === 'has_loop') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'bounce-checkbox';
                checkbox.dataset.trackName = track.name; // Guardamos el nombre para identificarla
                trackElement.appendChild(checkbox);
            }
            
            
            const trackControls = document.createElement('div');

            const mainButton = document.createElement('button');
            mainButton.className = 'track-button';
            mainButton.textContent = track.name;
            mainButton.classList.add(track.state);
            trackControls.appendChild(mainButton);

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
                trackControls.appendChild(volGroup);

                // Control de Paneo
                const panGroup = document.createElement('div');
                panGroup.className = 'slider-group';
                panGroup.innerHTML = `<label>Pan</label><input type="range" min="-1" max="1" value="${track.channel.pan.value}" step="0.01">`;
                panGroup.querySelector('input').addEventListener('input', e => track.setPan(parseFloat(e.target.value)));
                mixerControls.appendChild(panGroup);

                trackControls.appendChild(mixerControls);

                // Control de Tono (Pitch)
                const pitchGroup = document.createElement('div');
                pitchGroup.className = 'slider-group';
                // El valor 'pitch' en el PitchShift es en semitonos.
                pitchGroup.innerHTML = `<label>Tono</label><input type="range" min="-12" max="12" value="${track.pitchShift.pitch}" step="1">`;
                pitchGroup.querySelector('input').addEventListener('input', e => track.setPitch(parseFloat(e.target.value)));
                mixerControls.appendChild(pitchGroup);
                // Control del Filtro
                const filterGroup = document.createElement('div');
                filterGroup.className = 'slider-group';
                // La frecuencia es logarítmica, pero un rango lineal funciona bien para empezar.
                filterGroup.innerHTML = `<label>Filtro</label><input type="range" min="100" max="10000" value="${track.filter.frequency.value}" step="10">`;
                filterGroup.querySelector('input').addEventListener('input', e => track.setFilterFrequency(parseFloat(e.target.value)));
                mixerControls.appendChild(filterGroup);

                trackControls.appendChild(mixerControls);

                

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
                trackControls.appendChild(deleteButton);
                trackElement.appendChild(trackControls);
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

    // --- Lógica del Modo Bounce (Unir Pistas) ---
    
    toggleBounceModeButton.addEventListener('click', () => {
        isBounceMode = !isBounceMode; // Invertimos el estado

        if (isBounceMode) {
            toggleBounceModeButton.textContent = 'Cancelar';
            confirmBounceButton.style.display = 'inline-block';
        } else {
            toggleBounceModeButton.textContent = '🔗 Unir Pistas';
            confirmBounceButton.style.display = 'none';
        }

        renderTracks(); // Volvemos a dibujar para mostrar/ocultar los checkboxes
    });

    confirmBounceButton.addEventListener('click', async () => {
        // 1. Encontrar los checkboxes que fueron marcados.
        const selectedCheckboxes = document.querySelectorAll('.bounce-checkbox:checked');
        if (selectedCheckboxes.length < 2) {
            alert("Por favor, selecciona al menos dos pistas para unir.");
            return;
        }

        // 2. Obtener las instancias de las pistas correspondientes a esos checkboxes.
        const selectedTrackNames = Array.from(selectedCheckboxes).map(cb => cb.dataset.trackName);
        const tracksToBounce = audioEngine.tracks.filter(track => selectedTrackNames.includes(track.name));

        // 3. Desactivar la UI mientras se procesa.
        confirmBounceButton.disabled = true;
        confirmBounceButton.textContent = 'Procesando...';

        // 4. Llamar al método principal del motor y esperar a que termine.
        await audioEngine.bounceTracks(tracksToBounce);

        // 5. Salir del modo de unión y actualizar la UI.
        isBounceMode = false;
        toggleBounceModeButton.textContent = '🔗 Unir Pistas';
        confirmBounceButton.style.display = 'none';
        confirmBounceButton.disabled = false;
        confirmBounceButton.textContent = 'Confirmar Unión';
        
        renderTracks(); // Dibujar la nueva estructura de pistas.
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

            // --- ¡AQUÍ ESTÁ LA CONEXIÓN! ---
            // Le decimos a la escena 3D que se reconstruya con los nuevos valores.
            // Asumimos 4 tiempos por compás (timeSignature).
            visualScene.rebuildVisualizers(measures, 4);
            // ---------------------------------

        }
    });


    // Listener para el control del volumen maestro
    masterVolumeSlider.addEventListener('input', (event) => {
        audioEngine.setMasterVolume(parseFloat(event.target.value));
    });
    metronomeVolumeSlider.addEventListener('input', (event) => {
        audioEngine.setMetronomeVolume(parseFloat(event.target.value));
    });
    metronomeToggle.addEventListener('change', (event) => {
        // Hacemos que el toggle y el slider estén sincronizados
        if (event.target.checked) {
            metronomeVolumeSlider.value = -12;
            audioEngine.setMetronomeVolume(-12);
        } else {
            metronomeVolumeSlider.value = -48; // O un valor muy bajo
            audioEngine.setMetronomeVolume(-Infinity);
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

    function uiUpdateLoop() {
        const currentBPM = audioEngine.getBPM();
        visualScene.updateTempoDisplay(currentBPM);


        // --- LÓGICA DEL VISUALIZADOR DE COMPÁS ---
        const currentMeasure = audioEngine.getCurrentMeasure();
        
        // Solo actualizamos la escena si el compás ha cambiado
        if (currentMeasure !== lastActiveMeasure) {
            visualScene.setActiveMeasure(currentMeasure);
            lastActiveMeasure = currentMeasure; // Guardamos el nuevo compás activo
        }
        // ------------------------------------------
        const currentBeat = audioEngine.getCurrentBeat();
        if (currentBeat !== lastActiveBeat) {
            visualScene.setActiveBeat(currentBeat);
            lastActiveBeat = currentBeat;
        }

        // --- NUEVA LÓGICA PARA ACTUALIZAR EL SLOT ACTIVO ---
        if (audioEngine.activeTrack) {
            // Esto es una simplificación. Asumimos que el nombre del slot
            // corresponde al tipo de pista. Lo mejoraremos después.
            // Por ahora, necesitamos una forma de identificar el slot correcto.
            // Lo dejaremos pendiente y lo activaremos visualmente al hacer clic.
        }
        // ------------------------------------------------

        // Llama a esta función de nuevo en el próximo frame de animación
        requestAnimationFrame(uiUpdateLoop);
    }
    uiUpdateLoop();
    // Llamamos a la función para poblar el menú cuando la app inicia
    populateLoadMenu();
}

// Nos aseguramos de llamar a init() solo cuando la página se haya cargado por completo.
window.addEventListener('load', init);