import * as THREE from 'three';

export class InstrumentWidget extends THREE.Group {
    constructor() {
        super();

        // Parámetros del Instrumento (Única Fuente de Verdad)
        this.numberOfPoints = 15;
        this.innerRadius = 4.3;
        this.outerRadius = 5.0;
        this.startAngle = Math.PI * 0.30;
        this.endAngle = Math.PI * 0.70;

        this.arcPoints = [];

        // Disco de interacción (plano invisible)
        const discoGeometry = new THREE.CircleGeometry(10, 128);
        const discoMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        this.disco = new THREE.Mesh(discoGeometry, discoMaterial);
        this.add(this.disco);

        this.position.y = -7.5;

        this._createInstrumentArc();
    }

    _createInstrumentArc() {
        this.arcPoints.forEach(p => this.remove(p));
        this.arcPoints = [];
        const dotGeometry = new THREE.CircleGeometry(0.05, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1, transparent: true });

        const createArc = (radius) => {
            const endAngleCorrected = this.endAngle < this.startAngle ? this.endAngle + 2 * Math.PI : this.endAngle;
            for (let i = 0; i <= this.numberOfPoints; i++) {
                const fraction = i / this.numberOfPoints;
                let angle = this.startAngle + fraction * (endAngleCorrected - this.startAngle);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const point = new THREE.Mesh(dotGeometry.clone(), dotMaterial.clone());
                point.position.set(x, y, 0.1);
                this.add(point);
                this.arcPoints.push(point);
            }
        };

        createArc(this.innerRadius);
        createArc(this.outerRadius);
    }
}
