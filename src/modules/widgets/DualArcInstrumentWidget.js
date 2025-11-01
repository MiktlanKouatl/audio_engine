import * as THREE from 'three';

export class DualArcInstrumentWidget extends THREE.Group {
    constructor() {
        super();

        // --- Parámetros de los Arcos ---
        this.arcPoints = [];
        this.numberOfPoints = 15; // Puntos por cada línea de arco
        this.innerRadius = 4.0;
        this.outerRadius = 4.6;
        const verticalAngleSpread = Math.PI * 0.6; // La "altura" del arco

        // --- Definiciones de Geometría y Material ---
        const dotGeometry = new THREE.CircleGeometry(0.08, 12);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // --- Creación de los Arcos Visuales ---
        this.leftArcParams = {
            startAngle: Math.PI - (verticalAngleSpread / 2),
            endAngle: Math.PI + (verticalAngleSpread / 2)
        };
        this.rightArcParams = {
            startAngle: -(verticalAngleSpread / 2),
            endAngle: verticalAngleSpread / 2
        };

        this._createArc(dotGeometry, dotMaterial, this.innerRadius, this.leftArcParams.startAngle, this.leftArcParams.endAngle);
        this._createArc(dotGeometry, dotMaterial, this.outerRadius, this.leftArcParams.startAngle, this.leftArcParams.endAngle);
        this._createArc(dotGeometry, dotMaterial, this.innerRadius, this.rightArcParams.startAngle, this.rightArcParams.endAngle);
        this._createArc(dotGeometry, dotMaterial, this.outerRadius, this.rightArcParams.startAngle, this.rightArcParams.endAngle);
        
        // --- Creación de Hitboxes Curvos ---
        const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        const thetaSegments = 32;
        const phiSegments = 1; // Solo necesitamos un segmento a lo largo del radio

        // Hitbox Izquierdo
        const leftHitboxGeom = new THREE.RingGeometry(
            this.innerRadius,
            this.outerRadius,
            thetaSegments,
            phiSegments,
            this.leftArcParams.startAngle,
            this.leftArcParams.endAngle - this.leftArcParams.startAngle
        );
        this.leftHitbox = new THREE.Mesh(leftHitboxGeom, hitboxMaterial);
        this.leftHitbox.name = 'left_arc_hitbox';
        this.add(this.leftHitbox);

        // Hitbox Derecho
        const rightHitboxGeom = new THREE.RingGeometry(
            this.innerRadius,
            this.outerRadius,
            thetaSegments,
            phiSegments,
            this.rightArcParams.startAngle,
            this.rightArcParams.endAngle - this.rightArcParams.startAngle
        );
        this.rightHitbox = new THREE.Mesh(rightHitboxGeom, hitboxMaterial);
        this.rightHitbox.name = 'right_arc_hitbox';
        this.add(this.rightHitbox);

        // Posicionamos el widget completo
        //this.position.y = -1;
    }

    _createArc(geometry, material, radius, startAngle, endAngle) {
        const endAngleCorrected = endAngle < startAngle ? endAngle + 2 * Math.PI : endAngle;
        
        for (let i = 0; i <= this.numberOfPoints; i++) {
            const fraction = i / this.numberOfPoints;
            const angle = startAngle + fraction * (endAngleCorrected - startAngle);
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            const point = new THREE.Mesh(geometry.clone(), material.clone());
            point.position.set(x, y, 0.1);
            this.add(point);
            this.arcPoints.push(point);
        }
    }
}
