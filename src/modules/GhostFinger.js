// src/modules/GhostFinger.js
import * as THREE from 'three';

export class GhostFinger {
    /**
     * @param {number} trackId El ID de la pista a la que está asociado.
     * @param {THREE.Color | number} color El color del indicador.
     */
    constructor(trackId, color = 0xFF00FF) {
        this.trackId = trackId;

        const geometry = new THREE.CircleGeometry(0.2, 16);
        const material = new THREE.MeshBasicMaterial({ color: color });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.z = 0.5; // Siempre por encima de otros elementos
        this.mesh.visible = false;  // Oculto por defecto
    }

    /**
     * Actualiza la posición del dedo en el espacio del instrumento.
     * @param {{x: number, y: number}} coord - La coordenada normalizada (0-1).
     * @param {object} instrumentParams - Parámetros del arco del instrumento.
     */
    update(coord, instrumentParams) {
        if (!coord) {
            this.hide();
            return;
        }
        
        // La matemática de traducción ahora vive DENTRO del componente que la necesita.
        const { startAngle, endAngle, innerRadius, outerRadius } = instrumentParams;

        const angleRange = endAngle - startAngle;
        const angle = startAngle + coord.x * angleRange;

        const radiusRange = outerRadius - innerRadius;
        const radius = innerRadius + coord.y * radiusRange;
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        this.mesh.position.set(x, y, this.mesh.position.z);
        this.show();
    }

    show() {
        this.mesh.visible = true;
    }

    hide() {
        this.mesh.visible = false;
    }

    /**
     * Libera los recursos de Three.js para evitar fugas de memoria.
     */
    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}