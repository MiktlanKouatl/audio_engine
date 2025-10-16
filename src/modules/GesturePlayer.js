// src/modules/GesturePlayer.js

import { pointToMusicalData } from './Notation.js'; // Asumimos que la lógica de notación estará aquí

export class GesturePlayer {
    constructor() {
        // Guardará una referencia a las pistas que están reproduciendo un gesto
        this.activeGestures = new Map(); // Map de trackId -> { gesture, startTime }
        this.lastCalculatedCoords = new Map();
        this.rampTime = 1 / 60;
    }

    /**
     * Asigna un gesto a una pista para que se reproduzca.
     * @param {Track} track - La pista que reproducirá el gesto.
     * @param {Array} gesture - El array de datos del gesto.
     * @param {number} startTimeInBeats - El beat del transporte en el que comienza el gesto.
     */
    playGesture(track, gesture, startTimeInBeats) {
        if (!track || !gesture || gesture.length === 0) return;

        let duration = gesture[gesture.length - 1].t - gesture[0].t; // Duración relativa
        if (duration <= 0) {
            duration = 1.0; 
        }

        this.activeGestures.set(track.id, {
            gesture,
            startTime: startTimeInBeats,
            duration: duration,
            trackRef: track
        });

        // --- ¡CAMBIO CLAVE! ---
        // Le decimos al sinte que empiece a sonar AHORA y se mantenga así.
        if (track.synth) {
            track.synth.triggerAttack();
        }
    }

    stopGesture(trackId) {
        const activeGesture = this.activeGestures.get(trackId);
        if (activeGesture && activeGesture.trackRef.synth) {
            activeGesture.trackRef.synth.triggerRelease();
            this.activeGestures.delete(trackId);
        }
    }

    /**
     * Devuelve la última coordenada calculada para una pista específica.
     * @param {number} trackId - El ID de la pista.
     * @returns {{x: number, y: number} | null}
     */
    getCurrentCoordinate(trackId) {
        return this.lastCalculatedCoords.get(trackId) || null;
    }
    
    /**
     * El corazón del reproductor. Se llama a alta frecuencia desde el AudioEngine.
     * @param {number} currentTransportBeats - La posición actual del transporte en beats.
     * @param {number} audioContextTime - El tiempo preciso del AudioContext para agendar eventos.
     */
    update(currentTransportBeats, audioContextTime) {
        this.lastCalculatedCoords.clear();
        // 1. RECORRER GESTOS ACTIVOS
        // Iteramos sobre cada pista que actualmente tiene un gesto asignado.
        for (const [trackId, activeGesture] of this.activeGestures.entries()) {
            const { gesture, startTime, duration, trackRef } = activeGesture;

            // 2. CALCULAR TIEMPO LOCAL (CON LÓGICA DE LOOP)
            // Calculamos cuántos beats han pasado desde que el gesto debía empezar.
            const timeSinceStart = currentTransportBeats - startTime;
            if (timeSinceStart < 0) {
                // Si aún no es tiempo de empezar, pasamos al siguiente gesto.
                continue; 
            }

            // Esta es la clave del looping flexible: el operador de módulo (%).
            // Nos da la posición actual DENTRO de la duración del gesto, repitiéndolo si es necesario.
            const localGestureTime = timeSinceStart % duration;

            if (isNaN(localGestureTime)) {
                    continue; // Si algo sale mal, simplemente saltamos este frame.
                }

            // 3. INTERPOLAR LAS COORDENADAS (PARA FLUIDEZ)
            // Buscamos los dos puntos en nuestra "partitura" de gesto que rodean el tiempo actual.
            let prevPoint = gesture[0];
            let nextPoint = gesture[gesture.length - 1];
            for (let i = 1; i < gesture.length; i++) {
                if (gesture[i].t >= localGestureTime) {
                    prevPoint = gesture[i - 1];
                    nextPoint = gesture[i];
                    break;
                }
            }

            // Calculamos qué tan "avanzados" estamos entre el punto previo y el siguiente (un valor de 0 a 1).
            const timeRange = nextPoint.t - prevPoint.t;
            const progress = timeRange > 0 ? (localGestureTime - prevPoint.t) / timeRange : 0;
            
            // Usamos esa progresión para encontrar la coordenada exacta entre los dos puntos.
            const x = prevPoint.c.x + progress * (nextPoint.c.x - prevPoint.c.x);
            const y = prevPoint.c.y + progress * (nextPoint.c.y - prevPoint.c.y);
            const finalCoord = { x, y };

            // Guardamos la última coordenada calculada para este trackId.
            this.lastCalculatedCoords.set(trackId, finalCoord);
            
            // 4. ACTUAR: DELEGAR AL INSTRUMENTO
            // El GesturePlayer no hace música. Su trabajo termina aquí.
            // Le pasa la coordenada calculada al instrumento para que él se encargue de sonar.
            if (trackRef && typeof trackRef.playAt === 'function') {
                trackRef.playAt(finalCoord, audioContextTime);
            }
        }
    }
}