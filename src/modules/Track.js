import { Synth, Sequence } from 'tone';

export class Track {
    /**
     * @param {string} name El nombre de la pista.
     * @param {Array<string|null>} pattern El array de notas para la secuencia.
     */
    constructor(name, pattern){
        this.name = name;
        this.instrument = new Synth().toDestination();
        this.sequence = new Sequence ((time, note) => {
            if (note) {
                this.instrument.triggerAttackRelease(note, "8n", time);
            }
        }, pattern, "4n");
        this.sequence.loop = true;
    }
    /**
     * Inicia la reproducción de la secuencia de esta pista.
     */
    start() {
        this.sequence.start(0);
    }
}