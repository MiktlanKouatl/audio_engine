import * as THREE from 'three';

export class SphereManager {
    constructor(radius = 3.5) {
        this.radius = radius;
        this.tracks = new Map(); // Usaremos un Map para asociar trackId con su data (posición, etc.)

        // Definimos 4 slots predefinidos correspondientes a los epicentros de las ondas.
        // Estos son vectores de dirección. La posición final es dirección * radio.
        this.predefinedSlots = [
            new THREE.Vector3(0, 0, 1),  // Frente
            new THREE.Vector3(1, 0, 0),  // Derecha
            new THREE.Vector3(-1, 0, 0), // Izquierda
            new THREE.Vector3(0, 0, -1), // Atrás
        ];
        this.nextSlotIndex = 0;
    }

    /**
     * Añade una nueva pista y le asigna una posición.
     * @param {number} trackId - El ID de la nueva pista.
     * @returns {THREE.Vector3 | null} La posición calculada en el espacio del mundo, o null si no hay slots.
     */
    addTrack(trackId) {
        if (this.tracks.has(trackId)) {
            return this.tracks.get(trackId).position;
        }

        // Lógica de "Colocación Inteligente" (Fase 1 - Simplificada)
        // Asignamos el siguiente slot predefinido disponible.
        if (this.nextSlotIndex >= this.predefinedSlots.length) {
            console.warn("No hay más slots predefinidos para nuevas pistas.");
            // En el futuro, aquí podríamos crear posiciones dinámicamente o manejar la repulsión.
            // Por ahora, simplemente devolvemos null o reutilizamos.
            this.nextSlotIndex = 0; // Reutilizamos los slots por ahora.
        }

        const slotDirection = this.predefinedSlots[this.nextSlotIndex].clone();
        const finalPosition = slotDirection.multiplyScalar(this.radius);
        
        console.log(`Track ${trackId} asignado al slot ${this.nextSlotIndex}.`);

        // Guardamos la información del track
        this.tracks.set(trackId, {
            position: finalPosition,
            slotIndex: this.nextSlotIndex
        });

        this.nextSlotIndex++;

        return finalPosition;
    }

    /**
     * Elimina una pista del gestor.
     * @param {number} trackId - El ID de la pista a eliminar.
     */
    removeTrack(trackId) {
        if (this.tracks.has(trackId)) {
            // TODO: En el futuro, podríamos querer liberar el slot que ocupaba para que pueda ser reutilizado.
            this.tracks.delete(trackId);
            console.log(`Track ${trackId} eliminado del SphereManager.`);
        }
    }
}
