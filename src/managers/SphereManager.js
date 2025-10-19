import * as THREE from 'three';

export class SphereManager {
    constructor(radius = 3.5) {
        this.radius = radius;
        this.tracks = new Map(); // Asocia trackId con su slotIndex
        this.slots = []; // Array de objetos { position: Vector3, occupied: boolean }

        this._initializeGeodesicGrid();
    }

    /**
     * Crea una rejilla de posiciones basada en los vértices de una icoesfera
     * para una distribución uniforme.
     * @private
     */
    _initializeGeodesicGrid() {
        const geometry = new THREE.IcosahedronGeometry(this.radius, 1); // detail = 1 para 42 vértices
        const vertices = geometry.attributes.position;
        const uniquePositions = new Map();

        // Extraer vértices únicos, ya que el buffer de atributos puede tener duplicados
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const y = vertices.getY(i);
            const z = vertices.getZ(i);
            // Usamos un string con precisión fija como clave para agrupar vértices flotantes casi idénticos
            const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
            if (!uniquePositions.has(key)) {
                uniquePositions.set(key, new THREE.Vector3(x, y, z));
            }
        }

        this.slots = Array.from(uniquePositions.values()).map(pos => ({
            position: pos,
            occupied: false
        }));

        console.log(`SphereManager inicializado con ${this.slots.length} slots geodésicos.`);
    }

    /**
     * Añade una nueva pista, encontrando el mejor slot disponible.
     * @param {number} trackId - El ID de la nueva pista.
     * @returns {THREE.Vector3 | null} La posición calculada, o null si no hay slots libres.
     */
    addTrack(trackId) {
        if (this.tracks.has(trackId)) {
            const existingSlotIndex = this.tracks.get(trackId);
            return this.slots[existingSlotIndex].position;
        }

        const emptySlots = this.slots
            .map((slot, index) => ({ ...slot, index }))
            .filter(slot => !slot.occupied);

        if (emptySlots.length === 0) {
            console.warn("No hay más slots libres en la esfera.");
            return null;
        }

        // El "frente" para el usuario es la dirección +Z en el espacio del UI container
        const forwardVector = new THREE.Vector3(0, 0, 1);

        // Encontrar el slot vacío más cercano al "frente"
        let closestSlot = null;
        let minDistance = Infinity;

        emptySlots.forEach(slot => {
            // Clonamos la posición para no modificar la original del slot
            const slotPosition = slot.position.clone();
            const distance = slotPosition.distanceTo(forwardVector.multiplyScalar(this.radius));
            if (distance < minDistance) {
                minDistance = distance;
                closestSlot = slot;
            }
        });

        // Ocupar el slot encontrado
        this.slots[closestSlot.index].occupied = true;
        this.tracks.set(trackId, closestSlot.index);

        console.log(`Track ${trackId} asignado al slot geodésico ${closestSlot.index}.`);
        return closestSlot.position;
    }

    /**
     * Libera el slot asociado a un trackId, devolviendo el índice del slot.
     * @param {number} trackId 
     * @returns {number | null} El índice del slot liberado o null si no se encontró el track.
     */
    freeSlotByTrackId(trackId) {
        if (!this.tracks.has(trackId)) return null;

        const slotIndex = this.tracks.get(trackId);
        if (this.slots[slotIndex]) {
            this.slots[slotIndex].occupied = false;
            console.log(`Slot ${slotIndex} liberado temporalmente por el track ${trackId}.`);
            return slotIndex;
        }
        return null;
    }

    /**
     * Encuentra el slot vacío más cercano a una posición dada y lo ocupa.
     * @param {THREE.Vector3} position - La posición desde la que buscar.
     * @param {number} trackId - El ID del track que va a ocupar el slot.
     * @param {number} originalSlotIndex - El slot original del track por si la operación debe cancelarse.
     * @returns {THREE.Vector3} La posición del nuevo slot.
     */
    occupyNearestEmptySlot(position, trackId, originalSlotIndex) {
        const emptySlots = this.slots
            .map((slot, index) => ({ ...slot, index }))
            .filter(slot => !slot.occupied);

        if (emptySlots.length === 0) {
            // No hay slots, el track debe volver a su lugar original
            this.slots[originalSlotIndex].occupied = true;
            return this.slots[originalSlotIndex].position;
        }

        let closestSlot = null;
        let minDistance = Infinity;

        emptySlots.forEach(slot => {
            const distance = slot.position.distanceTo(position);
            if (distance < minDistance) {
                minDistance = distance;
                closestSlot = slot;
            }
        });

        // Ocupar el nuevo slot
        this.slots[closestSlot.index].occupied = true;
        this.tracks.set(trackId, closestSlot.index);
        console.log(`Track ${trackId} reubicado en el slot ${closestSlot.index}.`);
        return closestSlot.position;
    }

    /**
     * Elimina una pista y libera su slot.
     * @param {number} trackId - El ID de la pista a eliminar.
     */
    removeTrack(trackId) {
        if (this.tracks.has(trackId)) {
            const slotIndex = this.tracks.get(trackId);
            
            if (this.slots[slotIndex]) {
                this.slots[slotIndex].occupied = false;
                console.log(`Slot ${slotIndex} liberado.`);
            }

            this.tracks.delete(trackId);
            console.log(`Track ${trackId} eliminado del SphereManager.`);
        }
    }
}
