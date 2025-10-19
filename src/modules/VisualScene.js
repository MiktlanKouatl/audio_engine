import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { GhostFinger } from './GhostFinger.js';
import { TrackWidget } from './widgets/TrackWidget.js';
import { GlobalControlsWidget } from './widgets/GlobalControlsWidget.js';
import { MainSphere } from './MainSphere.js';
import { SequencerVisualizerWidget } from './widgets/SequencerVisualizerWidget.js';
// import { InstrumentWidget } from './widgets/InstrumentWidget.js';
import { DualArcInstrumentWidget } from './widgets/DualArcInstrumentWidget.js';

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

        // Contenedores y Widgets
        this.uiContainer = null;
        this.globalControlsContainer = null;
        this.globalControls = null;
        this.sequencerVisualizer = null;
        this.instrumentWidget = null;

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
        this.volumeDotOnMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });

        // Elementos y Estado de la UI
        this.trackSlots = {};
        this.trackUIComponents = {};
        this.ghostFingers = new Map();
        
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
        this.isDraggingVolume = false;
        this.draggedTrackId = null;
        this.draggedTrack = null; // Nuevo: para el arrastre de tracks
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

        // this.instrumentWidget = new InstrumentWidget();
        this.instrumentWidget = new DualArcInstrumentWidget();
        this.uiContainer.add(this.instrumentWidget);

        // Esfera invisible para raycasting al arrastrar tracks
        this.dragProxySphere = new THREE.Mesh(
            new THREE.SphereGeometry(3.7, 32, 32),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        );
        this.scene.add(this.dragProxySphere); // Corregido: Añadido a la escena principal

        this.container.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.container.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.container.addEventListener('pointermove', this._onPointerMove.bind(this));
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        
        this.mainSphere = new MainSphere();
        this.scene.add(this.mainSphere);

        this._animate();
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
    
        const controlIntersects = this.raycaster.intersectObjects(this.interactiveControls);
        if (controlIntersects.length > 0) {
            if (this.onInteraction) this.onInteraction({ type: 'ui-click', element: controlIntersects[0].object.name });
            return;
        }

        // Lógica para el nuevo DualArcInstrumentWidget
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

                // NO normalizar el ángulo globalmente. Se trata diferente para cada arco.
                let angle = Math.atan2(localPoint.y, localPoint.x);

                const radiusRange = this.instrumentWidget.outerRadius - this.instrumentWidget.innerRadius;
                let velocity = (distanceFromCenter - this.instrumentWidget.innerRadius) / radiusRange;
                velocity = Math.max(0, Math.min(1, velocity)); // Clamp velocity

                let globalArcPosition = -1;

                if (hitObject.name === 'left_arc_hitbox') {
                    if (angle < 0) angle += 2 * Math.PI; // Normalizar para el arco izquierdo
                    const params = this.instrumentWidget.leftArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = arcPosition * 0.5; // Mapea a 0.0 - 0.5
                } else if (hitObject.name === 'right_arc_hitbox') {
                    const params = this.instrumentWidget.rightArcParams;
                    const arcRange = params.endAngle - params.startAngle;
                    // El ángulo de atan2 ya está en el rango correcto para este arco (-PI a PI)
                    const arcPosition = (angle - params.startAngle) / arcRange;
                    globalArcPosition = 0.5 + (arcPosition * 0.5); // Mapea a 0.5 - 1.0
                }

                // Asegurarse de que las coordenadas siempre estén en el rango 0-1
                globalArcPosition = Math.max(0, Math.min(1, globalArcPosition));

                if (this.onInteraction && globalArcPosition !== -1) {
                    this.onInteraction({ type: 'disc-drag', coords: { x: globalArcPosition, y: velocity }, active: true });
                }

            } else {
                this.interactionLight.intensity = 0;
            }
            return;
        }
    }
    
    createTrackUI(trackData) {
        const materials = {
            metronomeOnMaterial: this.metronomeOnMaterial,
            metronomeOffMaterial: this.metronomeOffMaterial,
            volumeDotOnMaterial: this.volumeDotOnMaterial
        };
    
        const newWidget = new TrackWidget(trackData, this.interactiveControls, materials);
    
        if (this.mainSphere) {
            this.mainSphere.add(newWidget);
        }
    
        this.trackUIComponents[trackData.id] = newWidget;
    
        if (trackData.type === 'instrument') {
            const newGhostFinger = new GhostFinger(trackData.id);
            this.instrumentWidget.add(newGhostFinger);
            this.ghostFingers.set(trackData.id, newGhostFinger);
        }
    
        console.log(`TrackWidget (ID: ${trackData.id}) creado y añadido a la escena.`);
    }

    updateGhostFinger(trackId, coord, isVisible) {
        const ghostFinger = this.ghostFingers.get(trackId);
        if (!ghostFinger) return;

        if (isVisible) {
            ghostFinger.update(coord, this.instrumentWidget);
        } else {
            ghostFinger.hide();
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

    setActiveTrackUI(activeTrackId) {
        for (const id in this.trackUIComponents) {
            const widget = this.trackUIComponents[id];
            if (widget) {
                widget.setActive(parseInt(id) === activeTrackId);
            }
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
        // Desactivado temporalmente para separar el control del visualizador
        return;
    }

    toggleMetronomeVisuals(isOn) {
        this.isMetronomeOn = isOn;
        if (this.globalControls.metronome && this.globalControls.metronome.userData.button) {
            this.globalControls.metronome.userData.button.material = isOn ? this.metronomeOnMaterial : this.metronomeOffMaterial;
        }
    }
    
    _handleVolumeDrag(event) {
        try {
            if (!this.draggedTrackId && this.draggedTrackId !== 0) {
                return;
            }

            const widget = this.trackUIComponents[this.draggedTrackId];
            if (!widget) return;

            if (!widget.volumePanel || !Array.isArray(widget.volumePanel.children)) return;

            const sliderHitbox = widget.volumePanel.children.find(c => c.name && c.name.startsWith('volume-slider-'));
            if (!sliderHitbox) return;

            this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const intersects = this.raycaster.intersectObject(sliderHitbox).slice();
            if (intersects.length === 0 && sliderHitbox.children && sliderHitbox.children.length > 0) {
                const childIntersects = this.raycaster.intersectObjects(sliderHitbox.children, true);
                if (childIntersects.length > 0) intersects.push(childIntersects[0]);
            }

            if (intersects.length > 0) {
                const localPoint = sliderHitbox.worldToLocal(intersects[0].point.clone());

                if (!sliderHitbox.geometry.boundingBox) {
                    sliderHitbox.geometry.computeBoundingBox();
                }
                const box = sliderHitbox.geometry.boundingBox;
                const height = box.max.y - box.min.y;
                if (height === 0) return;

                const rawValue = (localPoint.y - box.min.y) / height;
                const value = Math.max(0, Math.min(1, rawValue));
                const db = (value * 54) - 48; // -48dB to +6dB range

                if (this.onInteraction) {
                    this.onInteraction({ type: 'track-param-change', payload: { trackId: this.draggedTrackId, param: 'volume', value: db } });
                }

                if (typeof widget.updateVolumeSlider === 'function') {
                    widget.updateVolumeSlider(value, {
                        volumeDotOnMaterial: this.volumeDotOnMaterial,
                        metronomeOffMaterial: this.metronomeOffMaterial
                    });
                }
            }
        } catch (err) {
            // Silently ignore errors to avoid console output per request
        }
    }

    _onPointerDown(event) {
        this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const controlIntersects = this.raycaster.intersectObjects(this.interactiveControls);
        if (controlIntersects.length > 0) {
            const intersectedObject = controlIntersects[0].object;
            const name = intersectedObject.name;

            if (name.startsWith('volume-slider-')) {
                this.isDraggingVolume = true;
                this.draggedTrackId = parseInt(name.split('-').pop());
                this._handleVolumeDrag(event);
                return;
            }

            if (name.startsWith('track-select-')) {
                const trackId = parseInt(name.split('-').pop());
                const widget = this.trackUIComponents[trackId];
                const intersectionPoint = controlIntersects[0].point;

                if (widget) {
                    const widgetWorldPosition = new THREE.Vector3();
                    widget.getWorldPosition(widgetWorldPosition);
                    const offset = new THREE.Vector3().subVectors(widgetWorldPosition, intersectionPoint);

                    this.draggedTrack = {
                        widget: widget,
                        id: trackId,
                        originalSlotIndex: this.sphereManager.freeSlotByTrackId(trackId),
                        offset: offset
                    };
                    this.isDraggingSphere = false; // Desactivar rotación de la esfera principal
                    this.isInteracting = false; // Desactivar interacción con instrumento
                    return;
                }
            }
            
            if (this.onInteraction) this.onInteraction({ type: 'ui-click', element: name });
            return;
        }

        // Lógica para el nuevo DualArcInstrumentWidget
        if (this.instrumentWidget instanceof DualArcInstrumentWidget) {
            const hitboxes = [this.instrumentWidget.leftHitbox, this.instrumentWidget.rightHitbox];
            const intersects = this.raycaster.intersectObjects(hitboxes);

            if (intersects.length > 0) {
                 this.isInteracting = true; 
                this._handleInteraction(event);
                return;
            }
        }

        const sphereIntersects = this.raycaster.intersectObject(this.mainSphere);
        if (sphereIntersects.length > 0 && !this.draggedTrack) { // Solo rotar si no estamos arrastrando un track
            this.isDraggingSphere = true;
            this.mainSphere.onPointerDown({ x: event.clientX, y: event.clientY });
            return;
        }
    }

    _onPointerUp(event) {
        if (this.draggedTrack) {
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
            this.draggedTrack = null;
        }

        if (this.isDraggingSphere) {
            this.isDraggingSphere = false;
            this.mainSphere.onPointerUp();
        }
        this.isInteracting = false;
        this.isDraggingVolume = false;
        this.draggedTrackId = null;
        
        this.interactionLight.intensity = 0;
        if (this.onInteraction) this.onInteraction({ type: 'disc-drag', active: false });
    }

    _onPointerMove(event) {
        if (this.draggedTrack) {
            this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const intersects = this.raycaster.intersectObject(this.dragProxySphere);
            if (intersects.length > 0) {
                const newWorldPosition = intersects[0].point.add(this.draggedTrack.offset);
                const newLocalPosition = this.mainSphere.worldToLocal(newWorldPosition.clone());
                
                this.draggedTrack.widget.position.copy(newLocalPosition);
                this.draggedTrack.widget.lookAt(0, 0, 0);
            }
            return;
        }

        if (this.isDraggingVolume) {
            this._handleVolumeDrag(event);
            return;
        }

        if (this.isDraggingSphere) {
            this.mainSphere.onPointerMove({ x: event.clientX, y: event.clientY });
        } else if (this.isInteracting) {
            this._handleInteraction(event);
        }
    }
    
    _animate() {
        // Procesar animaciones de snap
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
        }
        this.renderer.render(this.scene, this.camera);
    }
}