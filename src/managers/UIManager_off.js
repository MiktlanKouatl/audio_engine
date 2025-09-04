// managers/UIManager.js
import { TweakpaneInterface } from '../interfaces/TweakpaneInterface.js';

export class UIManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        // En el futuro, podríamos tener lógica para decidir qué interfaz cargar
        this.activeInterface = new TweakpaneInterface(this.audioEngine);
    }

    init() {
        this.activeInterface.init();
        console.log("UI Manager inicializado con Tweakpane.");
    }
}