// main.js

import { AudioEngine } from './engines/AudioEngine.js';
import { Track } from './modules/Track.js';

// Envolvemos toda la lógica en una función 'init' para asegurar
// que el DOM esté completamente cargado antes de ejecutar el código.
function init() {
    console.log("Inicializando aplicación...");

    // 1. Obtenemos las referencias a los elementos del DOM que necesitamos.
    const startButton = document.getElementById('start-button');
    const playStopButton = document.getElementById('play-stop-button');
    const statusDisplay = document.getElementById('status-display');

    // 2. Creamos una instancia de nuestro motor de audio.
    const audioEngine = new AudioEngine();
    // --- ¡AQUÍ ESTÁ LA MAGIA! ---

    // 1. Definimos los patrones musicales fuera de las clases.
    //    Esto es un buen ejemplo de separación de datos y lógica.
    const melodyPattern = ["C4", "E4", "G4", "B4", "C5", null, "G4", null];
    const bassPattern = ["C2", null, "G2", null, "A2", null, "G2", null];

    // 2. Creamos dos instancias de Track, cada una con su propio patrón.
    const melodyTrack = new Track("Melodía", melodyPattern);
    const bassTrack = new Track("Bajo", bassPattern);

    // 3. Añadimos ambas pistas al motor.
    audioEngine.addTrack(melodyTrack);
    audioEngine.addTrack(bassTrack);

    // ----------------------------

    // 3. Añadimos el Event Listener al botón.
    // La función del evento debe ser 'async' para poder usar 'await'.
    startButton.addEventListener('click', async () => {
        try {
            // Llamamos al método start() de nuestro motor y esperamos a que termine.
            await audioEngine.start();
            
            // Si todo va bien, actualizamos la UI para dar feedback al usuario.
            statusDisplay.textContent = "Motor de Audio: LISTO";
            startButton.style.display = 'none'; // Ocultamos el botón de inicio
            playStopButton.style.display = 'inline-block'; // ¡Mostramos el de Play/Stop!

            //startButton.textContent = "Motor Iniciado";
            //startButton.disabled = true; // Deshabilitamos el botón una vez usado.
            //startButton.style.backgroundColor = '#01FF70'; // Un verde brillante
            //startButton.style.color = '#111';

        } catch (error) {
            console.error("No se pudo iniciar el motor de audio:", error);
            statusDisplay.textContent = "Error al iniciar el motor.";
        }
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
}

// Nos aseguramos de llamar a init() solo cuando la página se haya cargado por completo.
window.addEventListener('load', init);