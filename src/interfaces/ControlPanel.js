
import { Pane } from 'tweakpane';

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
        // Style the container so the control panel appears at the bottom-right
        /* if (this.container && this.container.style) {
            const s = this.container.style;
            s.position = 'fixed';
            s.right = '20px';
            s.bottom = '20px';
            s.width = '320px';
            s.zIndex = '1000';
            s.pointerEvents = 'auto';
        } */
    }



    showForTrack(track) {
        if (this.pane) {
            this.pane.dispose();
        }

        this.pane = new Pane({
            container: this.container,
            title: 'Track Controls',
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
                this.audioEngine.deleteTrack(track);
                this.visualScene.deleteTrackUI(track.id);
                this.sphereManager.removeTrack(track.id);
                this.pane.dispose();
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
