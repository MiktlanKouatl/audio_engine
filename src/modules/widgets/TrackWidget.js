import * as THREE from 'three';
import { Text } from 'troika-three-text';

export class TrackWidget extends THREE.Group {
    constructor(trackData, interactiveControls, materials) {
        super();

        this.trackId = trackData.id;
        this.isRecorded = false;
        this.interactiveControls = interactiveControls; // Store a reference
        this.interactiveObjects = []; // Para gestionar los objetos interactivos de este widget

        // --- Posicionamiento y Orientación ---
        this.position.copy(trackData.position).normalize().multiplyScalar(3.7);
        this.lookAt(0, 0, 0);

    // --- Materiales ---
    const { metronomeOffMaterial } = materials;

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

        // --- Botón de Mute/Unmute ---
        const muteGeo = new THREE.CircleGeometry(0.1, 16);
        const muteMat = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide }); // Grey color
        this.muteButton = new THREE.Mesh(muteGeo, muteMat);
        this.muteButton.name = `mute-track-${this.trackId}`;
        this.muteButton.position.set(0, 0, -0.05);
        this.muteButton.rotation.x = Math.PI;
        this.muteButton.visible = false; // Initially hidden
        this.add(this.muteButton);
        interactiveControls.push(this.muteButton);
        this.interactiveObjects.push(this.muteButton);

    // (Delete button removed — handled elsewhere or no longer needed)

        // --- Modo Instrumento (solo para Instrument Tracks) ---
        if (trackData.type === 'instrument') {
            this.modeText = new Text();
            this.modeText.text = trackData.mode ? trackData.mode.toUpperCase() : 'MELODIC';
            this.modeText.font = '../GoogleSansCode-VariableFont_wght.ttf';
            this.modeText.fontSize = 0.1;
            this.modeText.color = 0xFFFFFF;
            this.modeText.anchorX = 'center';
            this.modeText.anchorY = 'middle';
            this.modeText.position.set(0, -0.5, 0.02);
            this.add(this.modeText);
            this.modeText.sync();

            // Hitbox para cambiar el modo
            const modeHitbox = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
            modeHitbox.name = `change-mode-${this.trackId}`;
            modeHitbox.position.set(0, -0.5, 0.02);
            this.add(modeHitbox);
            interactiveControls.push(modeHitbox);
            this.interactiveObjects.push(modeHitbox);
        }

        // Volume panel removed — volume control handled elsewhere or not needed
    }

    setActive(isActive) {
        this.selectionIndicator.visible = isActive;
    }

    updateModeDisplay(modeName) {
        if (this.modeText) {
            this.modeText.text = modeName.toUpperCase();
            this.modeText.sync();
        }
    }

    setBounceSelected(isSelected) {
        this.bounceSelectionIndicator.visible = isSelected;
    }

    setArmed(isArmed, materials) {
        this.recButton.material = isArmed ? materials.metronomeOnMaterial : materials.metronomeOffMaterial;
    }

    setRecordedState(isRecorded) {
        this.recButton.visible = !isRecorded;
        this.muteButton.visible = isRecorded;
        this.isRecorded = isRecorded;

        if (isRecorded) {
            const index = this.interactiveControls.indexOf(this.recButton);
            if (index > -1) {
                this.interactiveControls.splice(index, 1);
            }
            this.interactiveControls.push(this.muteButton);
        } else {
            const index = this.interactiveControls.indexOf(this.muteButton);
            if (index > -1) {
                this.interactiveControls.splice(index, 1);
            }
            this.interactiveControls.push(this.recButton);
        }
    }

    setMuteState(isMuted) {
        this.muteButton.material.color.set(isMuted ? 0xFF4136 : 0x808080);
    }

    // Backwards-compatible alias used elsewhere in the app
    setMuted(isMuted) {
        this.setMuteState(isMuted);
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