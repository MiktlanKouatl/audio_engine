import { FMSynth, MembraneSynth, Synth, NoiseSynth, MetalSynth, MonoSynth, getContext } from 'tone';

export const SOUND_BANK = {
    'melodic': {
        synth: (masterOut) => new FMSynth({
            harmonicity: 2,
            modulationIndex: 10,
            envelope: { attack: 0.01, decay: 0.2, release: 0.2 }
        }).connect(masterOut),
        map: (synth, x, y) => {
            const musicalData = pointToMusicalData(x, y);
            if (!musicalData) return;
            const volumeInDb = -30 + musicalData.velocity * 30;
            synth.frequency.value = musicalData.freq;
            synth.volume.value = volumeInDb;
        },
        triggerAttack: (synth) => synth.triggerAttack(),
        triggerRelease: (synth) => synth.triggerRelease(),
        defaultName: 'Instrumento'
    },
    'kick': {
        synth: (masterOut) => new MembraneSynth({
            pitchDecay: 0.02, // Decaimiento de tono más rápido
            octaves: 8,
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 0.001,
                decay: 0.1, // Decaimiento corto para un golpe seco
                sustain: 0, // Sin sostenido
                release: 0.1, // Liberación corta
                attackCurve: 'exponential'
            }
        }).connect(masterOut),
        map: (synth, x, y) => {
            // x: 0-1 (left-right) -> pitch (e.g., 20Hz to 80Hz)
            // y: 0-1 (bottom-top) -> decay/sustain (e.g., 0.2 to 0.8)
            const minPitch = 20;
            const maxPitch = 80;
            const pitch = minPitch + (x * (maxPitch - minPitch));

            const minDecay = 0.2;
            const maxDecay = 0.8;
            const decay = minDecay + (y * (maxDecay - minDecay));

            synth.pitch = pitch;
            synth.envelope.decay = decay;
        },
        playPreview: (synth, x, y) => {
            // For debugging: fixed pitch and longer duration
            synth.pitch = 50; // Fixed pitch for audibility
            synth.envelope.decay = 0.5; // Longer decay for audibility
            synth.triggerAttackRelease(50, "8n"); // Play a longer kick at fixed pitch
        },
    }
};

// Helper function (assuming pointToMusicalData is defined elsewhere or needs to be imported)
function pointToMusicalData(x, y) {
    // This is a placeholder. In a real scenario, this would be imported or defined globally.
    // For now, we'll just return some basic data.
    const minFreq = 200; // C3
    const maxFreq = 1000; // C5
    const freq = minFreq + (x * (maxFreq - minFreq));
    const velocity = y; // 0-1
    return { freq, velocity };
}
