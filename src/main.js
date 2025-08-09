// main.js
import { AudioEngine } from './engines/AudioEngine.js';
import { UIManager } from './managers/UIManager.js';

// 1. Inicializamos los Módulos Principales
const audioEngine = new AudioEngine(4);
const uiManager = new UIManager(audioEngine);

// --- INICIO DEL CÓDIGO RESTAURADO ---

// 2. Conectamos la UI de Botones de Pista
const trackButtonsContainer = document.getElementById('track-buttons-container');

// Creamos los botones para cada pista dinámicamente
for (let i = 0; i < audioEngine.trackCount; i++) {
    const button = document.createElement('button');
    button.id = `track-btn-${i}`;
    button.dataset.trackId = i;
    button.textContent = `Pista ${i + 1}`;
    trackButtonsContainer.appendChild(button);
}

// Escuchamos clics en el contenedor de botones (event delegation)
trackButtonsContainer.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
        const trackId = parseInt(event.target.dataset.trackId);
        audioEngine.toggleRecording(trackId);
    }
});

// La UI ahora se actualiza en base al estado del motor Y de cada pista
audioEngine.onStateChange = (engineState, activeTrackId) => {
    const buttons = document.querySelectorAll('#track-buttons-container button');
    buttons.forEach((btn, id) => {
        const track = audioEngine.tracks[id];

        if (engineState === 'armed' && id === activeTrackId) {
            btn.style.backgroundColor = '#FFC107';
            btn.textContent = `Armado ${id + 1}`;
        } else if (engineState === 'recording' && id === activeTrackId) {
            btn.style.backgroundColor = '#F44336';
            btn.textContent = `Grabando ${id + 1}`;
        } else {
            if (track.state === 'has_loop') {
                btn.style.backgroundColor = track.channel.mute ? '#555' : '#01FF70';
                btn.textContent = `Loop ${id + 1}`;
            } else {
                btn.style.backgroundColor = '';
                btn.textContent = `Pista ${id + 1}`;
            }
        }
    });
};

window.addEventListener('keydown', (event) => {
    // Verificamos si la tecla es un número del 1 al 4
    const keyNumber = parseInt(event.key);
    if (keyNumber >= 1 && keyNumber <= audioEngine.trackCount) {
        // Mapeamos la tecla al ID de la pista (tecla '1' -> trackId 0)
        const trackId = keyNumber - 1;
        
        console.log(`Tecla '${event.key}' presionada, activando Pista ${trackId + 1}`);
        audioEngine.toggleRecording(trackId);
        
        // Prevenimos que el número se escriba en algún campo de texto
        event.preventDefault();
    }
});

// 3. Arrancamos el UI Manager
uiManager.init();