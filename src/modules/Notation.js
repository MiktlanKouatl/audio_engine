// src/modules/Notation.js

import { Frequency } from 'tone';

// Definimos una escala musical para que el instrumento suene siempre afinado.
// La escala pentatónica mayor de Do es una excelente opción (sin notas "incorrectas").
const PENTATONIC_SCALE = [
    // Graves (extendiendo hacia abajo)
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    // Original rango medio
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    // Agudos (extendiendo hacia arriba)
    'C6', 'D6', 'E6', 'G6', 'A6',
    'C7', 'D7', 'E7', 'G7', 'A7'
];

/**
 * Convierte la posición en el arco y la velocidad en datos musicales concretos.
 * @param {number} arcPosition - Un valor de 0.0 (izquierda/grave) a 1.0 (derecha/agudo).
 * @param {number} velocity - Un valor de 0.0 (radio interior) a 1.0 (radio exterior).
 * @returns {{freq: number, velocity: number}} - Datos listos para el sintetizador.
 */
export function pointToMusicalData(arcPosition, velocity) {
    if (typeof arcPosition !== 'number' || typeof velocity !== 'number') {
        return null;
    }

    // 1. Mapear la posición del arco a un índice de nuestra escala musical.
    // Usamos Math.floor para "cuantizar" la nota a la escala.
    const noteIndex = Math.floor(arcPosition * (PENTATONIC_SCALE.length - 1));
    const noteName = PENTATONIC_SCALE[noteIndex];

    // 2. Convertir el nombre de la nota (ej. "C4") a su frecuencia en Hercios.
    const freq = new Frequency(noteName).toFrequency();

    // 3. Devolvemos los datos listos para ser usados por Tone.js.
    // La velocidad ya está normalizada (0-1), lo que es perfecto para el volumen.
    return {
        freq,
        velocity
    };
}