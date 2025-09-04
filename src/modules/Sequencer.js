// src/modules/Sequencer.js (puedes crear una carpeta 'modules')
import * as Tone from 'tone';

export class Sequencer {
    constructor(tracks, transport) {
        this.tracks = tracks;
        this.transport = transport;
        this.part = null;
    }

    init() {
        const events = [];
        // Creamos un evento para cada pista que le dice que debe sonar al inicio del ciclo
        this.tracks.forEach(track => {
            events.push({
                time: "0:0:0",
                trackId: track.id,
                action: (time) => {
                    // Solo reproduce si la pista tiene contenido y no está muteada
                    if (track.state === 'has_loop' && !track.channel.mute) {
                        track.player.start(time);
                    }
                }
            });
        });

        // Creamos la Tone.Part, que es nuestro secuenciador de eventos
        this.part = new Tone.Part((time, event) => {
            event.action(time);
        }, events);

        this.part.loop = true;
        this.part.loopEnd = this.transport.loopEnd;
        this.part.start(0); // Inicia la parte junto con el transporte
    }
}