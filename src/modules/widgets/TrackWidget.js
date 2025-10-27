import * as THREE from 'three';

export class TrackWidget extends THREE.Group {
    constructor(trackData, interactiveControls, materials) {
        super();

        this.trackId = trackData.id;
        this.interactiveObjects = []; // Para gestionar los objetos interactivos de este widget

        // --- Posicionamiento y Orientación ---
        this.position.copy(trackData.position).normalize().multiplyScalar(3.7);
        this.lookAt(0, 0, 0);

        // --- Materiales ---
        const { metronomeOffMaterial, volumeDotOnMaterial } = materials;

        // --- Botón de Selección (Círculo Principal) ---
        const selectGeo = new THREE.CircleGeometry(0.3, 32);
        const selectMat = new THREE.MeshStandardMaterial({
            color: trackData.type === 'instrument' ? 0x0074D9 : 0xFF4136,
            metalness: 0.4,
            roughness: 0.6,
            side: THREE.DoubleSide
        });
        const selectButton = new THREE.Mesh(selectGeo, selectMat);
        selectButton.name = `track-select-${this.trackId}`;
        this.add(selectButton);
        interactiveControls.push(selectButton);
        this.interactiveObjects.push(selectButton);

        // --- Indicador de Selección (Aro Verde) ---
        const indicatorGeo = new THREE.RingGeometry(0.32, 0.37, 32);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x01FF70, side: THREE.DoubleSide });
        this.selectionIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        this.selectionIndicator.visible = false;
        this.selectionIndicator.position.z = 0.01;
        this.add(this.selectionIndicator);

        // --- Indicador de Selección para Bounce (Aro Azul) ---
        const bounceIndicatorGeo = new THREE.RingGeometry(0.39, 0.44, 32);
        const bounceIndicatorMat = new THREE.MeshBasicMaterial({ color: 0x0074D9, side: THREE.DoubleSide });
        this.bounceSelectionIndicator = new THREE.Mesh(bounceIndicatorGeo, bounceIndicatorMat);
        this.bounceSelectionIndicator.visible = false;
        this.bounceSelectionIndicator.position.z = 0.01;
        this.add(this.bounceSelectionIndicator);

        // --- Botón de Grabación (REC) ---
        const recGeo = new THREE.CircleGeometry(0.1, 16);
        this.recButton = new THREE.Mesh(recGeo, metronomeOffMaterial.clone());
        this.recButton.name = `rec-arm-track-${this.trackId}`;
        this.recButton.position.set(0, 0, -0.05);
        this.recButton.rotation.x = Math.PI;
        this.add(this.recButton);
        interactiveControls.push(this.recButton);
        this.interactiveObjects.push(this.recButton);

        // --- Botón de Borrar (Delete) ---
        const deleteGeo = new THREE.CircleGeometry(0.1, 16);
        const deleteMat = new THREE.MeshBasicMaterial({ color: 0x8B0000, side: THREE.DoubleSide }); // DarkRed color
        const deleteButton = new THREE.Mesh(deleteGeo, deleteMat);
        deleteButton.name = `delete-track-${this.trackId}`;
        deleteButton.position.set(0.45, 0, 0.02); // Position it to the side
        this.add(deleteButton);
        interactiveControls.push(deleteButton);
        this.interactiveObjects.push(deleteButton);

        // --- Panel de Volumen ---
        this.volumePanel = new THREE.Group();
        this.volumePanel.position.set(0, 1.1, 0);
        //this.volumePanel.rotation.x = -Math.PI / 12;
        this.volumePanel.visible = false;
        this.add(this.volumePanel);

        const panelShape = new THREE.Shape();
        const width = 0.3, height = 1.5, radius = 0.1;
        panelShape.moveTo(-width / 2, -height / 2 + radius);
        panelShape.lineTo(-width / 2, height / 2 - radius);
        panelShape.quadraticCurveTo(-width / 2, height / 2, -width / 2 + radius, height / 2);
        panelShape.lineTo(width / 2 - radius, height / 2);
        panelShape.quadraticCurveTo(width / 2, height / 2, width / 2, height / 2 - radius);
        panelShape.lineTo(width / 2, -height / 2 + radius);
        panelShape.quadraticCurveTo(width / 2, -height / 2, width / 2 - radius, -height / 2);
        panelShape.lineTo(-width / 2 + radius, -height / 2);
        panelShape.quadraticCurveTo(-width / 2, -height / 2, -width / 2, -height / 2 + radius);
        
        const panelGeo = new THREE.ShapeGeometry(panelShape);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        const panelBg = new THREE.Mesh(panelGeo, panelMat);
        panelBg.position.z = -0.01;
        this.volumePanel.add(panelBg);

        const dotCount = 8;
        const dotGeo = new THREE.CircleGeometry(0.05, 8);
        const dotOffMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide });
        this.volumeDots = [];
        for (let i = 0; i < dotCount; i++) {
            const dot = new THREE.Mesh(dotGeo, dotOffMat.clone());
            const yPos = (-height / 2) + 0.25 + (i / (dotCount - 1)) * (height - 0.5);
            dot.position.set(0, yPos, -0.02);
            dot.rotation.y = Math.PI;
            this.volumePanel.add(dot);
            this.volumeDots.push(dot);
        }

        const sliderHitbox = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0xff0000, visible:false }));
        sliderHitbox.name = `volume-slider-${this.trackId}`;
        sliderHitbox.position.z = -0.02;
        sliderHitbox.rotation.y = Math.PI;
        this.volumePanel.add(sliderHitbox);
        interactiveControls.push(sliderHitbox);
        this.interactiveObjects.push(sliderHitbox);
    }

    setActive(isActive) {
        this.selectionIndicator.visible = isActive;
        this.volumePanel.visible = isActive;
    }

    setBounceSelected(isSelected) {
        this.bounceSelectionIndicator.visible = isSelected;
    }

    setArmed(isArmed, materials) {
        this.recButton.material = isArmed ? materials.metronomeOnMaterial : materials.metronomeOffMaterial;
    }

    updateVolumeSlider(value, materials) { // value es 0-1
        this.volumeDots.forEach((dot, index) => {
            dot.material = index < value * this.volumeDots.length ? materials.volumeDotOnMaterial : materials.metronomeOffMaterial;
        });
    }

    dispose(interactiveControls) {
        // Eliminar objetos de la escena y de los controles interactivos
        this.interactiveObjects.forEach(obj => {
            const index = interactiveControls.indexOf(obj);
            if (index > -1) {
                interactiveControls.splice(index, 1);
            }
        });
        // Limpieza de geometrías y materiales si es necesario
    }
}