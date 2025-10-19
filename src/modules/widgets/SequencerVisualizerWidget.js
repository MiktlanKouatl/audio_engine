import * as THREE from 'three';

export class SequencerVisualizerWidget extends THREE.Group {
    constructor() {
        super();

        this.vizOptions = {
            ringSize: 0.3,
            ringSpacing: 0.9,
            dotSize: 0.08,
            dotSpacing: 0.22,
            yPositionMeasures: 3.4,
            yPositionBeats: 2.9,
            layerOffset: 0.1
        };

        this.measureVisualizers = [];
        this.beatVisualizers = [];
        this.activeMeasureIndicator = null;
    }

    rebuildVisualizers(measureCount, timeSignature) {
        this.measureVisualizers.forEach(vis => this.remove(vis));
        if (this.activeMeasureIndicator) this.remove(this.activeMeasureIndicator);
        this.beatVisualizers.forEach(vis => this.remove(vis));
        this.measureVisualizers = [];
        this.beatVisualizers = [];

        const opts = this.vizOptions;
        const measuresTotalWidth = (measureCount - 1) * opts.ringSpacing;
        const measureStartX = -measuresTotalWidth / 2;
        const ringGeometry = new THREE.RingGeometry(opts.ringSize * 0.8, opts.ringSize, 12);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < measureCount; i++) {
            const ringX = measureStartX + (i * opts.ringSpacing);
            const ring = new THREE.Mesh(ringGeometry.clone(), ringMaterial.clone());
            ring.position.set(ringX, opts.yPositionMeasures, opts.layerOffset);
            this.add(ring);
            this.measureVisualizers.push(ring);

            const beatsInMeasureWidth = (timeSignature - 1) * opts.dotSpacing;
            const beatInMeasureStartX = -beatsInMeasureWidth / 2;
            const dotGeometry = new THREE.CircleGeometry(opts.dotSize, 8);
            const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const activeDotMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });

            for (let j = 0; j < timeSignature; j++) {
                const beatRelativeX = beatInMeasureStartX + (j * opts.dotSpacing);
                const dotX = ringX + beatRelativeX;
                const dot = new THREE.Mesh(dotGeometry.clone(), dotMaterial.clone());
                dot.position.set(dotX, opts.yPositionBeats, opts.layerOffset);
                dot.userData = { originalMaterial: dotMaterial, activeMaterial: activeDotMaterial };
                this.add(dot);
                this.beatVisualizers.push(dot);
            }
        }

        const indicatorGeometry = new THREE.CircleGeometry(opts.ringSize * 0.7, 8);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });
        this.activeMeasureIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        this.activeMeasureIndicator.position.z = opts.layerOffset + 0.01;
        this.activeMeasureIndicator.visible = false;
        this.add(this.activeMeasureIndicator);
    }

    setActiveMeasure(measureIndex) {
        if (this.activeMeasureIndicator && this.measureVisualizers[measureIndex]) {
            const targetRing = this.measureVisualizers[measureIndex];
            this.activeMeasureIndicator.position.x = targetRing.position.x;
            this.activeMeasureIndicator.position.y = targetRing.position.y;
            this.activeMeasureIndicator.visible = true;
        } else if (this.activeMeasureIndicator) {
            this.activeMeasureIndicator.visible = false;
        }
    }

    setActiveBeat(beatIndex) {
        this.beatVisualizers.forEach((dot, index) => {
            const isActive = index === beatIndex;
            dot.material = isActive ? dot.userData.activeMaterial : dot.userData.originalMaterial;
            dot.scale.set(isActive ? 1.5 : 1, isActive ? 1.5 : 1, 1);
        });
    }
}
