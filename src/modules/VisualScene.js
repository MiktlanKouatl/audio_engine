import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { GhostFinger } from './GhostFinger.js';
import { TrackWidget } from './widgets/TrackWidget.js';
import { GlobalControlsWidget } from './widgets/GlobalControlsWidget.js';
import { MainSphere } from './MainSphere.js';
import { SequencerVisualizerWidget } from './widgets/SequencerVisualizerWidget.js';
import { DualArcInstrumentWidget } from './widgets/DualArcInstrumentWidget.js';
import { SessionListWidget } from './widgets/SessionListWidget.js';

import { pointToMusicalData } from './Notation.js';

export class VisualScene {
    constructor(containerId, sphereManager) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error("No se encontró el contenedor para la escena 3D.");
            return;
        }
        this.sphereManager = sphereManager; // Inyectar dependencia

        // --- PROPIEDADES DE LA CLASE (Consolidadas y Limpias) ---
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.mainSphere = null;
        this.sphereAndTracksContainer = null; // Contenedor para esfera y tracks
        this.targetQuaternion = new THREE.Quaternion(); // Quaternion objetivo para la rotación

        // Contenedores y Widgets
        this.uiContainer = null;
        this.globalControlsContainer = null;
        this.globalControls = null;
        this.sequencerVisualizer = null;
        this.instrumentWidget = null;
        this.sessionListWidget = null;

        // Parámetros de Posicionamiento de Pistas
        this.trackUIOptions = {
            radius: 2.0,                   // Distancia desde el centro
            startAngle: Math.PI * 0.2,     // Ángulo de inicio (abajo a la izquierda)
            endAngle: Math.PI * 0.8          // Ángulo de fin (abajo a la derecha)
        };

        // Parámetros del Metrónomo
        this.isMetronomeOn = false;
    this.metronomeOnMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 }); // Verde encendido
    this.metronomeOffMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });// Gris apagado

        // Elementos y Estado de la UI
        this.trackSlots = {};
        this.trackUIComponents = {};
        this.ghostFingers = new Map();
        this.isBounceMode = false;
        this.bounceSelection = [];
        
        // Interacción
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.interactionLight = null;
        this.isInteracting = false;
        this.interactiveControls = [];
        this.activeSlotMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });
        this.onInteraction = null;

        // Estados de Arrastre
    this.isDraggingSphere = false;
    this.isDraggingTrack = false;
        this.dragStart = { x: 0, y: 0, time: 0 };
        this.previousPointerPosition = { x: 0, y: 0 }; // Para arrastrar la esfera
        this.draggedTrack = null; // Objeto para la información de arrastre
        this.animations = []; // Nuevo: para animaciones de snap
        this.dragProxySphere = null; // Nuevo: para el raycast al arrastrar
        
        this._init();
    }

    _init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x121212);

        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 8;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2,
            frustumSize / 2, frustumSize / -2, 0.1, 1000
        );
        this.camera.position.set(0, 20, 0);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.uiContainer = new THREE.Group();
        this.uiContainer.rotation.x = -Math.PI / 2;
        this.scene.add(this.uiContainer);

        this.globalControlsContainer = new THREE.Group();
        this.globalControlsContainer.position.z = 8;
        this.uiContainer.add(this.globalControlsContainer);
        
        this.interactionLight = new THREE.PointLight(0x01FF70, 0, .55);
        this.scene.add(this.interactionLight);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        this.globalControls = new GlobalControlsWidget(this.interactiveControls);
        this.globalControlsContainer.add(this.globalControls);
        this.globalControls.updateLayout(this.camera);

        this.sequencerVisualizer = new SequencerVisualizerWidget();
        this.globalControlsContainer.add(this.sequencerVisualizer);
        this.rebuildVisualizers(4, 4);

        this.instrumentWidget = new DualArcInstrumentWidget();
        this.uiContainer.add(this.instrumentWidget);

        this.sessionListWidget = new SessionListWidget();

        this.dragProxySphere = new THREE.Mesh(
            new THREE.SphereGeometry(3.7, 32, 32),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        );
        this.scene.add(this.dragProxySphere);

        this.container.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.container.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.container.addEventListener('pointermove', this._onPointerMove.bind(this));
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        
        this.sphereAndTracksContainer = new THREE.Object3D();
        this.scene.add(this.sphereAndTracksContainer);

        this.mainSphere = new MainSphere();
        this.sphereAndTracksContainer.add(this.mainSphere);

        this._animate();
    }

    enterBounceMode() {
        this.isBounceMode = true;
        this.globalControls.bounceButton.visible = false;
        this.globalControls.confirmBounceButton.visible = true;
        this.globalControls.cancelBounceButton.visible = true;
        this.globalControls.selectAllBounceButton.visible = true;
    }

    exitBounceMode() {
        this.isBounceMode = false;
        this.globalControls.bounceButton.visible = true;
        this.globalControls.confirmBounceButton.visible = false;
        this.globalControls.cancelBounceButton.visible = false;
        this.globalControls.selectAllBounceButton.visible = false;
        this.bounceSelection.forEach(trackId => {
            const widget = this.trackUIComponents[trackId];
            if (widget) {
                widget.setBounceSelected(false);
            }
        });
        this.bounceSelection = [];
    }

    showSessionList(sessions) {
        const onSessionClick = (sessionName) => {
            if (this.onInteraction) {
                this.onInteraction({ type: 'load-session-by-name', payload: { sessionName } });
            }
        };
        this.sessionListWidget.populate(sessions, onSessionClick);
        this.sessionListWidget.show();
    }

    hideSessionList() {
        this.sessionListWidget.hide();
    }

    rebuildVisualizers(measureCount, timeSignature) {
        if (this.sequencerVisualizer) {
            this.sequencerVisualizer.rebuildVisualizers(measureCount, timeSignature);
        }
    }

    _handleInteraction(event) {
        this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        if (this.instrumentWidget instanceof DualArcInstrumentWidget) {
            const hitboxes = [this.instrumentWidget.leftHitbox, this.instrumentWidget.rightHitbox];
            const intersects = this.raycaster.intersectObjects(hitboxes);

            if (intersects.length > 0) {
                const intersection = intersects[0];
                const point = intersection.point;
                const hitObject = intersection.object;

                this.interactionLight.position.copy(point).y += 0.5;
                this.interactionLight.intensity = 40;

                const localPoint = this.instrumentWidget.worldToLocal(point.clone());
                const distanceFromCenter = Math.sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);

                let angle = Math.atan2(localPoint.y, localPoint.x);

                const radiusRange = this.instrumentWidget.outerRadius - this.instrumentWidget.innerRadius;
                let velocity = (distanceFromCenter - this.instrumentWidget.innerRadius) / radiusRange;
                velocity = Math.max(0, Math.min(1, velocity));

                let globalArcPosition = -1;

                if (hitObject.name === 'left_arc_hitbox') {
                    if (angle < 0) angle += 2 * Math.PI;
                    const params = this.instrumentWidget.leftArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = arcPosition * 0.5;
                } else if (hitObject.name === 'right_arc_hitbox') {
                    const params = this.instrumentWidget.rightArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = 0.5 + (arcPosition * 0.5);
                }

                globalArcPosition = Math.max(0, Math.min(1, globalArcPosition));

                if (this.onInteraction && globalArcPosition !== -1) {
                    // This part will be removed or refactored
                }

            } else {
                this.interactionLight.intensity = 0;
            }
        }
    }
    
    createTrackUI(trackData) {
        const materials = {
            metronomeOnMaterial: this.metronomeOnMaterial,
            metronomeOffMaterial: this.metronomeOffMaterial
        };
    
        const newWidget = new TrackWidget(trackData, this.interactiveControls, materials);
    
        if (this.sphereAndTracksContainer) {
            this.sphereAndTracksContainer.add(newWidget);
        }
    
        this.trackUIComponents[trackData.id] = newWidget;
    
        if (trackData.type === 'instrument') {
            const newGhostFinger = new GhostFinger(trackData.id);
            this.instrumentWidget.add(newGhostFinger);
            this.ghostFingers.set(trackData.id, newGhostFinger);
        }
    
        console.log(`TrackWidget (ID: ${trackData.id}) creado y añadido a la escena.`);
    }

    deleteTrackUI(trackId) {
        const widget = this.trackUIComponents[trackId];
        if (widget) {
            widget.dispose(this.interactiveControls);
            this.sphereAndTracksContainer.remove(widget);
            delete this.trackUIComponents[trackId];
        }

        const ghostFinger = this.ghostFingers.get(trackId);
        if (ghostFinger) {
            this.instrumentWidget.remove(ghostFinger);
            this.ghostFingers.delete(trackId);
        }
    }

    updateGhostFinger(trackId, coord, isVisible) {
        const ghostFinger = this.ghostFingers.get(trackId);
        if (!ghostFinger) return;

        if (isVisible) {
            ghostFinger.update(coord, this.instrumentWidget);
        }
    }

    setTrackUIArmedState(trackId, isArmed) {
        const widget = this.trackUIComponents[trackId];
        if (widget) {
            widget.setArmed(isArmed, { 
                metronomeOnMaterial: this.metronomeOnMaterial, 
                metronomeOffMaterial: this.metronomeOffMaterial 
            });
        }
    }

    updateTrackModeDisplay(trackId, newMode) {
        const widget = this.trackUIComponents[trackId];
        if (widget) {
            widget.updateModeDisplay(newMode);
        }
    }

    updateTrackColor(trackId, newColor) {
        const widget = this.trackUIComponents[trackId];
        if (widget && typeof widget.setColor === 'function') {
            widget.setColor(newColor);
        }
    }

    setTrackAsRecorded(trackId) {
        const widget = this.trackUIComponents[trackId];
        if (widget) {
            widget.setRecordedState(true);
        }
    }

    setActiveTrackUI(activeTrackId) {
        for (const id in this.trackUIComponents) {
            const widget = this.trackUIComponents[id];
            if (widget) {
                widget.setActive(parseInt(id) === activeTrackId);
            }
        }
    }

    updateMainSpherePolePosition(position) {
        if (this.mainSphere) {
            // The sphere's 'up' vector, in its un-rotated state, is (0, 1, 0).
            const up = new THREE.Vector3(0, 1, 0);
    
            // The track's position is already in the correct local coordinate space
            // relative to the sphere's parent. We just need to normalize it to get a direction.
            const targetDirection = position.clone().normalize();
    
            // This quaternion now represents the desired LOCAL rotation of the sphere
            // to make its 'up' vector point towards the target direction.
            this.targetQuaternion.setFromUnitVectors(up, targetDirection);
        }
    }

    _onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 22;
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    setActiveSlot(activeTrackName) {
        for (const name in this.trackSlots) {
            const slot = this.trackSlots[name];
            if (name === activeTrackName) {
                slot.material = this.activeSlotMaterial;
            } else if (!slot.material.userData.original) {
                slot.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
                slot.material.userData.original = true;
            }
        }
    }

    setActiveMeasure(measureIndex) {
        if (this.sequencerVisualizer) {
            this.sequencerVisualizer.setActiveMeasure(measureIndex);
        }
    }

    setActiveBeat(beatIndex) {
        if (this.sequencerVisualizer) {
            this.sequencerVisualizer.setActiveBeat(beatIndex);
        }
    }

    updateTrackVUMeter(trackId, level) {
        return;
    }

    toggleMetronomeVisuals(isOn) {
        this.isMetronomeOn = isOn;
        if (this.globalControls.metronome && this.globalControls.metronome.userData.button) {
            this.globalControls.metronome.userData.button.material = isOn ? this.metronomeOnMaterial : this.metronomeOffMaterial;
        }
    }
    
    // Volume drag handling removed (volume UI moved out of 3D widgets)

    _onPointerDown(event) {
        this.dragStart.x = event.clientX;
        this.dragStart.y = event.clientY;
        this.dragStart.time = Date.now();

        this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const controlIntersects = this.raycaster.intersectObjects(this.interactiveControls);
        if (controlIntersects.length > 0) {
            const intersectedObject = controlIntersects[0].object;
            const name = intersectedObject.name;

            if (name === 'select-all-bounce') {
                this.bounceSelection = Object.keys(this.trackUIComponents).map(id => parseInt(id));
                for (const id of this.bounceSelection) {
                    const widget = this.trackUIComponents[id];
                    if (widget) {
                        widget.setBounceSelected(true);
                    }
                }
                return;
            }

            if (name.startsWith('track-select-')) {
                const trackId = parseInt(name.split('-').pop());
                const widget = this.trackUIComponents[trackId];

                if (this.isBounceMode) {
                    const index = this.bounceSelection.indexOf(trackId);
                    if (index > -1) {
                        this.bounceSelection.splice(index, 1);
                        widget.setBounceSelected(false);
                    } else {
                        this.bounceSelection.push(trackId);
                        widget.setBounceSelected(true);
                    }
                    return;
                }

                const intersectionPoint = controlIntersects[0].point;

                if (widget) {
                    const widgetWorldPosition = new THREE.Vector3();
                    widget.getWorldPosition(widgetWorldPosition);
                    const offset = new THREE.Vector3().subVectors(widgetWorldPosition, intersectionPoint);

                    this.draggedTrack = {
                        widget: widget,
                        id: trackId,
                        name: name, // Store the name for the click event
                        originalSlotIndex: this.sphereManager.tracks.get(trackId),
                        offset: offset
                    };
                    this.sphereManager.freeSlotByTrackId(trackId); // Free the original slot when dragging starts
                }
                return;
            }
            
            if (this.onInteraction) this.onInteraction({ type: 'ui-click', element: name });
            return;
        }

        if (this.instrumentWidget instanceof DualArcInstrumentWidget) {
            const hitboxes = [this.instrumentWidget.leftHitbox, this.instrumentWidget.rightHitbox];
            const intersects = this.raycaster.intersectObjects(hitboxes);

            if (intersects.length > 0) {
                const intersection = intersects[0];
                const point = intersection.point;
                const hitObject = intersection.object;

                this.interactionLight.position.copy(point).y += 0.5;
                this.interactionLight.intensity = 40;

                const localPoint = this.instrumentWidget.worldToLocal(point.clone());
                const distanceFromCenter = Math.sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);

                let angle = Math.atan2(localPoint.y, localPoint.x);

                const radiusRange = this.instrumentWidget.outerRadius - this.instrumentWidget.innerRadius;
                let velocity = (distanceFromCenter - this.instrumentWidget.innerRadius) / radiusRange;
                velocity = Math.max(0, Math.min(1, velocity));

                let globalArcPosition = -1;

                if (hitObject.name === 'left_arc_hitbox') {
                    if (angle < 0) angle += 2 * Math.PI;
                    const params = this.instrumentWidget.leftArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = arcPosition * 0.5;
                } else if (hitObject.name === 'right_arc_hitbox') {
                    const params = this.instrumentWidget.rightArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = 0.5 + (arcPosition * 0.5);
                }

                globalArcPosition = Math.max(0, Math.min(1, globalArcPosition));

                if (this.onInteraction && globalArcPosition !== -1) {
                    this.onInteraction({ type: 'disc-start-interaction', coords: { x: globalArcPosition, y: velocity } });
                    this.isInteracting = true; // Set flag that an instrument interaction has started
                }
                return;
            } else {
                this.interactionLight.intensity = 0;
            }
        }

        const sphereIntersects = this.raycaster.intersectObject(this.mainSphere);
        if (sphereIntersects.length > 0 && !this.draggedTrack) {
            this.isDraggingSphere = true;
            this.previousPointerPosition = { x: event.clientX, y: event.clientY };
            return;
        }
    }

    _onPointerUp(event) {
        if (this.isDraggingTrack) {
            const dropPosition = this.draggedTrack.widget.position;
            const targetPosition = this.sphereManager.occupyNearestEmptySlot(
                dropPosition,
                this.draggedTrack.id,
                this.draggedTrack.originalSlotIndex
            );

            if (targetPosition) {
                this.animations.push({
                    object: this.draggedTrack.widget,
                    target: targetPosition,
                    alpha: 0.1
                });
            }
        } else if (this.draggedTrack) {
            // This is a click, not a drag
            if (this.onInteraction) {
                this.onInteraction({ type: 'ui-click', element: this.draggedTrack.name });
            }
        }

        this.draggedTrack = null;
        this.isDraggingTrack = false;
        this.isDraggingSphere = false;
        // Check if an instrument interaction was active
        if (this.isInteracting) {
            if (this.onInteraction) {
                this.onInteraction({ type: 'disc-end-interaction' });
            }
            this.isInteracting = false;
        }
    this.draggedTrackId = null;
        
        this.interactionLight.intensity = 0;
        if (this.isInteracting && this.onInteraction) {
            this.onInteraction({ type: 'disc-end-interaction' });
        }
    }

    _onPointerMove(event) {
        if (this.draggedTrack && !this.isDraggingTrack) {
            const dx = event.clientX - this.dragStart.x;
            const dy = event.clientY - this.dragStart.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) { // Drag threshold
                this.isDraggingTrack = true;
            }
        }

        if (this.isDraggingTrack) {
            this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const intersects = this.raycaster.intersectObject(this.dragProxySphere);
            if (intersects.length > 0) {
                const newWorldPosition = intersects[0].point.add(this.draggedTrack.offset);
                const newLocalPosition = this.sphereAndTracksContainer.worldToLocal(newWorldPosition.clone());
                
                this.draggedTrack.widget.position.copy(newLocalPosition);
                this.draggedTrack.widget.lookAt(0, 0, 0);
            }
            return;
        }

        

        if (this.isDraggingSphere) {
            const deltaX = event.clientX - this.previousPointerPosition.x;
            const deltaY = event.clientY - this.previousPointerPosition.y;
    
            if (this.sphereAndTracksContainer) {
                // Get camera's world-aligned up and right vectors
                const cameraWorldUp = new THREE.Vector3(0, 1, 0).transformDirection(this.camera.matrixWorld);
                const cameraWorldRight = new THREE.Vector3(1, 0, 0).transformDirection(this.camera.matrixWorld);

                // Rotate around camera's world up for horizontal movement
                const quatY = new THREE.Quaternion().setFromAxisAngle(cameraWorldUp, deltaX * 0.005); // Corrected direction
                const quatX = new THREE.Quaternion().setFromAxisAngle(cameraWorldRight, deltaY * 0.005); // Corrected direction

                this.sphereAndTracksContainer.quaternion.premultiply(quatY);
                this.sphereAndTracksContainer.quaternion.premultiply(quatX);
            }
    
            this.previousPointerPosition = { x: event.clientX, y: event.clientY };
        } else if (this.isInteracting) {
            // Instrument arc interaction is active, send update event
            this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const hitboxes = [this.instrumentWidget.leftHitbox, this.instrumentWidget.rightHitbox];
            const intersects = this.raycaster.intersectObjects(hitboxes);

            if (intersects.length > 0) {
                const intersection = intersects[0];
                const point = intersection.point;
                const hitObject = intersection.object;

                this.interactionLight.position.copy(point).y += 0.5;
                this.interactionLight.intensity = 40;

                const localPoint = this.instrumentWidget.worldToLocal(point.clone());
                const distanceFromCenter = Math.sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);

                let angle = Math.atan2(localPoint.y, localPoint.x);

                const radiusRange = this.instrumentWidget.outerRadius - this.instrumentWidget.innerRadius;
                let velocity = (distanceFromCenter - this.instrumentWidget.innerRadius) / radiusRange;
                velocity = Math.max(0, Math.min(1, velocity));

                let globalArcPosition = -1;

                if (hitObject.name === 'left_arc_hitbox') {
                    if (angle < 0) angle += 2 * Math.PI;
                    const params = this.instrumentWidget.leftArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = arcPosition * 0.5;
                } else if (hitObject.name === 'right_arc_hitbox') {
                    const params = this.instrumentWidget.rightArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = 0.5 + (arcPosition * 0.5);
                }

                globalArcPosition = Math.max(0, Math.min(1, globalArcPosition));

                if (this.onInteraction && globalArcPosition !== -1) {
                    this.onInteraction({ type: 'disc-update-interaction', coords: { x: globalArcPosition, y: velocity } });
                }
            } else {
                this.interactionLight.intensity = 0;
            }
        }
    }
    
    _animate() {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            anim.object.position.lerp(anim.target, anim.alpha);

            if (anim.object.position.distanceTo(anim.target) < 0.01) {
                anim.object.position.copy(anim.target);
                this.animations.splice(i, 1);
            }
        }

        requestAnimationFrame(this._animate.bind(this));
        if (this.mainSphere) {
            this.mainSphere.update();
            // Interpolar suavemente la rotación local de la esfera hacia el objetivo
            this.mainSphere.quaternion.slerp(this.targetQuaternion, 0.05);
        }

        this.renderer.render(this.scene, this.camera);
    }
}