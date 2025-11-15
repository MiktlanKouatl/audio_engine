
import { Pane } from 'tweakpane';

/**
 * Determina si el color del texto debe ser blanco o negro en función de la luminancia del color de fondo.
 * @param {string} hex - El color de fondo en formato hexadecimal (ej. '#RRGGBB').
 * @returns {'#000000' | '#ffffff'} - El color de texto de contraste.
 */
function getContrastingTextColor(hex) {
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Oscurece un color hexadecimal en un porcentaje determinado.
 * @param {string} hex - El color en formato hexadecimal.
 * @param {number} percent - El porcentaje para oscurecer (ej. 0.2 para 20%).
 * @returns {string} - El nuevo color hexadecimal.
 */
function darkenColor(hex, percent) {
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    let f = parseInt(hex, 16),
        t = 0, // Oscurecer hacia el negro
        R = f >> 16,
        G = (f >> 8) & 0x00FF,
        B = f & 0x0000FF;

    const newR = Math.round((t - R) * percent) + R;
    const newG = Math.round((t - G) * percent) + G;
    const newB = Math.round((t - B) * percent) + B;

    return `#${(0x1000000 + newR * 0x10000 + newG * 0x100 + newB).toString(16).slice(1)}`;
}


export class ControlPanel {
    constructor(container, audioEngine, visualScene, sphereManager) {
        this.container = container;
        this.audioEngine = audioEngine;
        this.visualScene = visualScene;
        this.sphereManager = sphereManager;
        this.pane = null;

        if (this.container && this.container.style) {
            const s = this.container.style;
            s.position = 'fixed';
            s.right = '20px';
            s.bottom = '20px';
            s.width = '320px';
            s.top = 'auto';
            s.left = 'auto';
            s.zIndex = '1000';
            s.pointerEvents = 'auto';
            
        }
    }

    _applyTheme(color) {
        const bgColor = darkenColor(color, 0.4);
        const textColor = getContrastingTextColor(bgColor);

        this.container.style.setProperty('--tp-base-background-color', bgColor);
        this.container.style.setProperty('--tp-base-foreground-color', textColor);
        this.container.style.setProperty('--tp-input-background-color', darkenColor(bgColor, 0.1));
        this.container.style.setProperty('--tp-input-foreground-color', textColor);
        this.container.style.setProperty('--tp-label-foreground-color', textColor);
        this.container.style.setProperty('--tp-button-background-color', bgColor);
        this.container.style.setProperty('--tp-button-foreground-color', textColor);
        this.container.style.setProperty('--tp-folder-foreground-color', textColor);
    }


    showForTrack(track) {
        if (this.pane) {
            this.pane.dispose();
        }

        const initialColor = track.color.toHexString ? track.color.toHexString() : track.color;
        this._applyTheme(initialColor);


        this.pane = new Pane({
            container: this.container,
            title: 'Track Controls',
        });

        this.pane.addBinding(track, 'color', { label: 'Color' })
            .on('change', (ev) => {
                const colorString = ev.value;
                this._applyTheme(colorString);
                this.visualScene.updateTrackColor(track.id, colorString);
            });

        const params = {
            volume: track.channel.volume.value,
            pan: track.channel.pan.value,
            pitch: track.pitchShift ? track.pitchShift.pitch : 0,
            frequency: track.filter ? track.filter.frequency.value : 20000,
        };

        // Control de Volumen
        this.pane.addBinding(params, 'volume', {
            min: -60,
            max: 6,
            step: 1,
            label: 'Volume (dB)'
        }).on('change', (ev) => {
            track.setVolume(ev.value);
        });

        // Control de Paneo
        this.pane.addBinding(params, 'pan', {
            min: -1,
            max: 1,
            step: 0.1,
            label: 'Pan'
        }).on('change', (ev) => {
            track.setPan(ev.value);
        });

        // Botón de Mute
        this.pane.addBinding(track.channel, 'mute', {
            label: 'Mute'
        });

        // Botón de Solo
        this.pane.addButton({ title: 'Solo' }).on('click', () => {
            this.audioEngine.soloTrack(track);
        });

        // Control de Tono (Pitch)
        if (track.pitchShift) {
            this.pane.addBinding(params, 'pitch', {
                min: -12,
                max: 12,
                step: 1,
                label: 'Pitch (semitones)'
            }).on('change', (ev) => {
                track.setPitch(ev.value);
            });
        }

        // Control de Filtro
        if (track.filter) {
            this.pane.addBinding(params, 'frequency', {
                min: 100,
                max: 10000,
                step: 10,
                label: 'Filter (Hz)'
            }).on('change', (ev) => {
                track.setFilterFrequency(ev.value);
            });
        }

        // Botón de Borrar
        this.pane.addButton({ title: 'Delete Track' }).on('click', () => {
            if (confirm(`¿Seguro que quieres borrar "${track.name}"?`)) {
                if (this.audioEngine.activeTrack === track) {
                    this.audioEngine.setActiveTrack(null);
                }
                this.audioEngine.deleteTrack(track);
                this.visualScene.deleteTrackUI(track.id);
                this.sphereManager.removeTrack(track.id);
                this.hide();
            }
        });

        // Botón de Exportar a .WAV
        this.pane.addButton({ title: 'Exportar a .WAV' }).on('click', () => {
            if (this.audioEngine.activeTrack) {
                this.audioEngine.activeTrack.exportToWAV();
            }
        });
    }

    hide() {
        if (this.pane) {
            this.pane.dispose();
            this.pane = null;
        }
    }
}
