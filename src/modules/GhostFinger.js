// src/modules/GhostFinger.js
import * as THREE from 'three';
import { DualArcInstrumentWidget } from './widgets/DualArcInstrumentWidget.js';

export class GhostFinger extends THREE.Group {
    /**
     * @param {number} trackId El ID de la pista a la que está asociado.
     * @param {THREE.Color | number} color El color del indicador.
     */
    constructor(trackId, color = 0xFF00FF) {
        super();
        this.trackId = trackId;

        const geometry = new THREE.CircleGeometry(0.2, 16);
        const material = new THREE.MeshBasicMaterial({ color: color });
        
        const mesh = new THREE.Mesh(geometry, material);
        this.add(mesh);

        this.position.z = 0.5; // Siempre por encima de otros elementos
        this.visible = false;  // Oculto por defecto
    }

    /**
     * Actualiza la posición del dedo en el espacio del instrumento.
     * @param {{x: number, y: number}} coord - La coordenada normalizada (0-1) para todo el instrumento.
     * @param {object} instrumentWidget - La instancia del widget del instrumento actual.
     */
    update(coord, instrumentWidget) {
        if (!coord || !instrumentWidget) {
            this.hide();
            return;
        }

        let targetParams;
        let localX = coord.x;

        // Determina en qué arco posicionarse y normaliza la coordenada X localmente
        if (instrumentWidget instanceof DualArcInstrumentWidget) {
            if (coord.x < 0.5) {
                targetParams = instrumentWidget.leftArcParams;
                localX = coord.x * 2; // Remapea 0.0-0.5 a 0.0-1.0
            } else {
                targetParams = instrumentWidget.rightArcParams;
                localX = (coord.x - 0.5) * 2; // Remapea 0.5-1.0 a 0.0-1.0
            }
        } else {
            // Lógica para el widget de un solo arco (si se vuelve a usar)
            targetParams = { 
                startAngle: instrumentWidget.startAngle, 
                endAngle: instrumentWidget.endAngle 
            };
        }

        if (!targetParams) {
            this.hide();
            return;
        }

        const { startAngle, endAngle } = targetParams;
        const { innerRadius, outerRadius } = instrumentWidget;

        const angleRange = endAngle - startAngle;
        const angle = startAngle + localX * angleRange;

        const radiusRange = outerRadius - innerRadius;
        const radius = innerRadius + coord.y * radiusRange;
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        this.position.set(x, y, this.position.z);
        this.show();
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    /**
     * Libera los recursos de Three.js para evitar fugas de memoria.
     */
    dispose() {
        if (this.children.length > 0) {
            const mesh = this.children[0];
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
    }
}