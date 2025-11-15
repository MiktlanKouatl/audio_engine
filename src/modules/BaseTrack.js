import { Channel } from 'tone';

export class BaseTrack {
    constructor(id, name, masterOut) {
        if (this.constructor === BaseTrack) {
            throw new Error("La clase abstracta 'BaseTrack' no puede ser instanciada directamente.");
        }

        this.id = id;
        this.name = name;
        this.color = '#cccccc'; // Propiedad de color compartida
        this.state = 'empty';   // Estado inicial por defecto

        // Canal de audio compartido para volumen, paneo y muteo.
        this.channel = new Channel({
            volume: 0,
            pan: 0,
            mute: false
        }).connect(masterOut);
    }

    // Métodos comunes que pueden ser utilizados o sobreescritos por las clases hijas.
    setVolume(db) {
        if (this.channel) this.channel.volume.value = db;
    }

    setPan(panValue) {
        if (this.channel) this.channel.pan.value = panValue;
    }

    toggleMute() {
        if (this.channel) {
            this.channel.mute = !this.channel.mute;
            return this.channel.mute;
        }
        return false;
    }

    // Métodos que DEBEN ser implementados por las clases hijas.
    serialize() {
        // Devuelve un objeto simple para la persistencia.
        return {
            id: this.id,
            name: this.name,
            color: this.color && typeof this.color.toHexString === 'function' ? this.color.toHexString() : this.color,
            volume: this.channel.volume.value,
            pan: this.channel.pan.value,
            mute: this.channel.mute,
        };
    }

    loadData(data) {
        // Carga datos desde un objeto simple.
        this.name = data.name || this.name;
        this.color = data.color || this.color;
        this.channel.volume.value = data.volume || 0;
        this.channel.pan.value = data.pan || 0;
        this.channel.mute = data.mute || false;
    }

    dispose() {
        if (this.channel) this.channel.dispose();
        console.log(`BaseTrack ${this.id} (${this.name}) liberado.`);
    }
}
