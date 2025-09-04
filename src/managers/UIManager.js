// UIManager.js

export class UIManager {
    constructor(onStartAudio, onToggleTransport) {
        this.startButton = document.getElementById('startButton');
        this.playButton = document.getElementById('playButton');
        this.statusDiv = document.getElementById('status');
        
        // Asignamos los callbacks recibidos a los eventos de clic.
        this.startButton.addEventListener('click', async () => {
            await onStartAudio();
            // Una vez iniciado el audio, mostramos el botón de play.
            this.startButton.style.display = 'none';
            this.playButton.style.display = 'block';
            this.playButton.innerText = 'Play';
        });

        this.playButton.addEventListener('click', () => {
            onToggleTransport();
            // Actualizamos el texto del botón según el estado del transporte.
            this.playButton.innerText = Tone.Transport.state === "started" ? 'Pause' : 'Play';
        });
        
        // Observamos los cambios de estado en el transporte para actualizar la UI
        // si el transporte se detiene por sí mismo, por ejemplo.
        Tone.Transport.on("pause", () => {
            this.playButton.innerText = 'Play';
            this.statusDiv.innerText = `Estado: Pausado | Posición: ${Tone.Transport.position}`;
        });
        
         Tone.Transport.on("stop", () => {
            this.playButton.innerText = 'Play';
            this.statusDiv.innerText = `Estado: Detenido`;
        });
    }
}