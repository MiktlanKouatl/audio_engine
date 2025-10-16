// src/modules/GestureLibrary.js

/**
 * 't' = tiempo en BEATS (tiempos de negra) desde el inicio del gesto.
 * 'c' = coordenadas normalizadas (0 a 1).
 */

const NotaSimple = [
    { t: 0, c: { x: 0.5, y: 0.8 } },
    { t: 1, c: { x: 0.5, y: 0.8 } } // Dura 1 beat
];

const SubidaRapida = [
    { t: 0, c: { x: 0.1, y: 0.9 } },
    { t: 0.5, c: { x: 0.9, y: 0.9 } } // Dura medio beat
];

// ¡NUEVO EJEMPLO! Un barrido lento que dura un compás entero.
const BarridoLargo = [
    { t: 0, c: { x: 0.1, y: 0.2 } },
    { t: 1, c: { x: 0.3, y: 0.8 } },
    { t: 2, c: { x: 0.6, y: 0.4 } },
    { t: 3, c: { x: 0.8, y: 0.9 } },
    { t: 4, c: { x: 1.0, y: 0.5 } }  // Dura 4 beats
];

export const GestureLibrary = {
    'NotaSimple': NotaSimple,
    'SubidaRapida': SubidaRapida,
    'BarridoLargo': BarridoLargo,
};