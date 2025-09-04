// LoopVisualizer.js

export class LoopVisualizer {
    /**
     * @param {AudioEngine} audioEngine La instancia del motor de audio para consultar el estado del transporte.
     * @param {HTMLElement} containerElement El elemento del DOM donde se dibujará el visualizador.
     */
    constructor(audioEngine, containerElement) {
        this.audioEngine = audioEngine;
        this.container = containerElement;
        this.indicators = [];
        this.currentLoopLength = audioEngine.loopLengthInMeasures; // Obtener la duración inicial
        this.lastActiveMeasure = -1;

        // Dibujar los indicadores iniciales
        this._renderIndicators();

        // Escuchar cambios en la longitud del loop del AudioEngine (si implementamos un observer)
        // Por ahora, solo dependemos del bucle de animación para el redibujo.

        this._startAnimationLoop();
    }

    /**
     * Dibuja o redibuja los indicadores de los compases.
     */
    _renderIndicators() {
        this.container.innerHTML = ''; // Limpiamos el contenedor
        this.indicators = []; // Reseteamos el array de referencias

        for (let i = 0; i < this.currentLoopLength; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'loop-indicator';
            this.container.appendChild(indicator);
            this.indicators.push(indicator);
        }
    }

    /**
     * Actualiza la visualización del loop.
     */
    _startAnimationLoop() {
        const animate = () => {
            const { position, state } = this.audioEngine.getTransportState();
            const newLoopLength = this.audioEngine.loopLengthInMeasures;

            // Si la longitud del loop ha cambiado, redibujamos
            if (newLoopLength !== this.currentLoopLength) {
                this.currentLoopLength = newLoopLength;
                this._renderIndicators();
                this.lastActiveMeasure = -1; // Reset para asegurar que el primer indicador se active
            }

            if (state === "started") {
                const [bar] = position.split(':').map(parseFloat);
                const currentMeasure = Math.floor(bar % this.currentLoopLength); // Asegurarse de que el índice se mantenga dentro del loop

                if (currentMeasure !== this.lastActiveMeasure) {
                    this.indicators.forEach((indicator, index) => {
                        indicator.classList.toggle('active', index === currentMeasure);
                    });
                    this.lastActiveMeasure = currentMeasure;
                }
            } else {
                // Si el transporte está detenido o pausado, resetear los visuales
                this.indicators.forEach(indicator => indicator.classList.remove('active'));
                this.lastActiveMeasure = -1;
            }

            requestAnimationFrame(animate);
        };
        
        animate();
    }
}