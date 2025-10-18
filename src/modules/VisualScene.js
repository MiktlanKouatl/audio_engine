// src/modules/VisualScene.js

import * as THREE from 'three';
import vertexShader from '/public/shaders/mainSphere.vert?raw';
import fragmentShader from '/public/shaders/mainSphere.frag?raw';
import { Text } from 'troika-three-text';
import { GhostFinger } from './GhostFinger.js';

import { pointToMusicalData } from './Notation.js';

export class VisualScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error("No se encontró el contenedor para la escena 3D.");
            return;
        }

        // --- PROPIEDADES DE LA CLASE (Consolidadas y Limpias) ---
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.disco = null;

        // Contenedores
        this.uiContainer = null;
        this.globalControlsContainer = null;
        this.sequenceControlsContainer = null;
        this.instrumentContainer = null;

        // Parámetros del Instrumento (Única Fuente de Verdad)
        this.numberOfPoints = 15;
        this.instrumentInnerRadius = 4.3;
        this.instrumentOuterRadius = 5.0;
        this.instrumentStartAngle = Math.PI * 0.30;
        this.instrumentEndAngle = Math.PI * 0.70;

        // Parámetros de Posicionamiento de Pistas
        this.trackUIOptions = {
            radius: 2.0,                   // Distancia desde el centro
            startAngle: Math.PI * 0.2,     // Ángulo de inicio (abajo a la izquierda)
            endAngle: Math.PI * 0.8          // Ángulo de fin (abajo a la derecha)
        };

        // Parámetros de Visualizadores
        this.vizOptions = {
            ringSize: 0.3,          // Radio de los anillos de compás
            ringSpacing: 0.9,       // Espacio entre los anillos de compás
            dotSize: 0.08,          // Radio de los puntos de beat
            dotSpacing: 0.22,        // Espacio entre los puntos de beat
            yPositionMeasures: 3.4,   // Posición vertical (antes Z) de los anillos
            yPositionBeats: 2.9,    // Posición vertical (antes Z) de los puntos
            layerOffset: 0.1        // Pequeño desfase en Z para evitar solapamiento
        };

        // Parámetros del Metrónomo
        this.isMetronomeOn = false;
        this.metronomeOnMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 }); // Verde encendido
        this.metronomeOffMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });// Gris apagado

        // Elementos y Estado de la UI
        this.tempoText = null;
        this.gestureText = null;
        this.trackSlots = {};
        this.measureVisualizers = [];
        this.beatVisualizers = [];
        this.activeMeasureIndicator = null;
        this.instrumentArcPoints = [];
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

        // Propiedades para la rotación de la esfera
        this.isDraggingSphere = false;
        this.previousPointerPosition = { x: 0, y: 0 };
        
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

        this.sequenceControlsContainer = new THREE.Group();
        this.sequenceControlsContainer.position.z = 1;
        this.uiContainer.add(this.sequenceControlsContainer);

        this.instrumentContainer = new THREE.Group();
        this.uiContainer.add(this.instrumentContainer);
        
        // Reemplazado por la esfera de puntos con shaders
        // this.instrumentContainer.position.y = -7.5;

        this.interactionLight = new THREE.PointLight(0x01FF70, 0, .55);
        this.scene.add(this.interactionLight);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        this._createUIText();
        this._createInteractiveControls();
        this.rebuildVisualizers(4, 4);
        this.createNewTrackButtons();
        this._createInstrumentArc();

        this.container.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.container.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.container.addEventListener('pointermove', this._onPointerMove.bind(this));
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        
        // Creamos un disco invisible que servirá únicamente para la interacción del instrumento.
        const discoGeometry = new THREE.CircleGeometry(10, 128);
        const discoMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        this.disco = new THREE.Mesh(discoGeometry, discoMaterial);
        this.instrumentContainer.add(this.disco);
        this.instrumentContainer.position.y = -7.5;

        this._createMainSphere();
        this._animate();
    }

    _createMainSphere() {
        // Bajamos la resolución para optimizar. 64x64 es un buen balance.
        const sphereGeometry = new THREE.SphereGeometry(3.5, 64, 64);

        this.shaderUniforms = {
            u_time: { value: 0.0 },
            // Aumentamos el tamaño del punto para compensar la menor densidad.
            u_point_size: { value: 2.5 },
            u_effect_type: { value: 1 } // 0: Ondas Alpha, 1: Desplazamiento de Vértices
        };

        const pointsMaterial = new THREE.ShaderMaterial({
            uniforms: this.shaderUniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.mainSphere = new THREE.Points(sphereGeometry, pointsMaterial);
        
        // Rotamos la esfera para que la 'costura' de la geometría no quede visible al frente.
        this.mainSphere.rotation.y = Math.PI / 2;

        this.scene.add(this.mainSphere);
    }

    // --- LÓGICA DE INTERACCIÓN RESTAURADA Y FUNCIONAL ---
    _handleInteraction(event) {
    this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    
    const controlIntersects = this.raycaster.intersectObjects(this.interactiveControls);
    if (controlIntersects.length > 0) {
        if (this.onInteraction) this.onInteraction({ type: 'ui-click', element: controlIntersects[0].object.name });
        return;
    }

    const discoIntersects = this.raycaster.intersectObject(this.disco);
    if (discoIntersects.length > 0) {
        // Obtenemos el punto de impacto en coordenadas del MUNDO. Lo usamos para la luz.
        const point = discoIntersects[0].point;
        this.interactionLight.position.copy(point).y += 0.5;

        // Convertimos el punto del mundo a coordenadas LOCALES (relativas al disco).
        const localPoint = this.disco.worldToLocal(point.clone());
        
        // --- INICIO DE LA LÓGICA CORREGIDA ---

        // 1. La distancia al centro se calcula en el plano XY LOCAL.
        const distanceFromCenter = Math.sqrt(localPoint.x * localPoint.x + localPoint.y * localPoint.y);

        if (distanceFromCenter >= this.instrumentInnerRadius && distanceFromCenter <= this.instrumentOuterRadius) {

            // 2. El ángulo se calcula en el plano XY LOCAL, sin ninguna inversión.
            let angle = Math.atan2(localPoint.y, localPoint.x);
            if (angle < 0) {
                angle += 2 * Math.PI;
            }

            // --- FIN DE LA LÓGICA CORREGIDA ---

            const startAngle = this.instrumentStartAngle;
            const endAngle = this.instrumentEndAngle;

            if (angle >= startAngle && angle <= endAngle) {
                this.interactionLight.intensity = 40;

                const arcRange = endAngle - startAngle;
                const arcPosition = (angle - startAngle) / arcRange;

                const radiusRange = this.instrumentOuterRadius - this.instrumentInnerRadius;
                const velocity = (distanceFromCenter - this.instrumentInnerRadius) / radiusRange;

                if (this.onInteraction) {
                    this.onInteraction({ 
                        type: 'disc-drag',
                        coords: { x: arcPosition, y: velocity }, // {x: 0-1, y: 0-1}
                        active: true 
                    });
                }

            } else {
                this.interactionLight.intensity = 0;
            }

        } else {
            this.interactionLight.intensity = 0;
        }
    } else {
        this.interactionLight.intensity = 0;
    }
}

    // --- LÓGICA DE DIBUJADO DE ARCO CORREGIDA ---
    _createInstrumentArc() {
        this.instrumentArcPoints.forEach(p => this.instrumentContainer.remove(p));
        this.instrumentArcPoints = [];

        const dotGeometry = new THREE.CircleGeometry(0.05, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1, transparent: true });

        const createArc = (radius) => {
            const endAngleCorrected = this.instrumentEndAngle < this.instrumentStartAngle 
            ? this.instrumentEndAngle + 2 * Math.PI 
            : this.instrumentEndAngle;
            for (let i = 0; i <= this.numberOfPoints; i++) {
                const fraction = i / this.numberOfPoints;
                let angle;
                const start = this.instrumentStartAngle;
                const end = endAngleCorrected;
                angle = start + fraction * (end - start);
                
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius; 
                
                const point = new THREE.Mesh(dotGeometry.clone(), dotMaterial.clone());
                point.position.set(x, y, 0.1);
                this.instrumentContainer.add(point);
                this.instrumentArcPoints.push(point);
            }
        };

        createArc(this.instrumentInnerRadius);
        createArc(this.instrumentOuterRadius);
    }
    
    // --- RESTO DE MÉTODOS COMPLETOS ---
    _createUIText() {
        
    }
    
    _createInteractiveControls() {
    
        // --- Widget de Tempo ---
        this.tempo = new THREE.Group();
        this.tempoText = new Text();
        this.tempoText.text = 'TEMPO (BPM) < 120 >';
        this.tempoText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        this.tempoText.fontSize = 0.2;
        this.tempoText.color = 0xFFFFFF;
        this.tempoText.anchorX = 'center';
        this.tempo.position.set(-6, 3, 0);
        this.tempo.add(this.tempoText);
        this.globalControlsContainer.add(this.tempo);
        this.tempoText.sync();
        // Botones invisibles para interacción del tiempo BPM
        const buttonGeometry = new THREE.PlaneGeometry(0.2, 0.2);
        const buttonMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
        const tempoDec = new THREE.Mesh(buttonGeometry.clone(), buttonMaterial.clone());
        tempoDec.name = 'tempo-decrement';
        tempoDec.position.set(0.36, -0.13, 0);
        this.tempo.add(tempoDec);
        this.interactiveControls.push(tempoDec);
        const tempoInc = new THREE.Mesh(buttonGeometry.clone(), buttonMaterial.clone());
        tempoInc.name = 'tempo-increment';
        tempoInc.position.set(1.08, -0.13, 0);
        this.tempo.add(tempoInc);
        this.interactiveControls.push(tempoInc);

        // Botón de Play/Stop
        const playButtonGeo = new THREE.PlaneGeometry(1.5, 0.4);
        // Podrías usar una textura con un ícono de 'Play' o simplemente un material
        const playButtonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 }); 
        const playButton = new THREE.Mesh(playButtonGeo, playButtonMat.clone());
        playButton.name = 'transport-toggle'; // Un nombre único para identificarlo
        playButton.position.set(-6.5, 3.25, 0.1); // Posiciónalo donde prefieras (ej. debajo de los beats)
        this.globalControlsContainer.add(playButton);
        this.interactiveControls.push(playButton);
        // texto para mayor claridad
        const playButtonText = new Text();
        playButtonText.text = 'PLAY ▶';
        playButtonText.font = '../GoogleSansCode-VariableFont_wght.ttf'; // Usa tu fuente
        playButtonText.fontSize = 0.3;
        playButtonText.color = 0xffffff;
        playButtonText.anchorX = 'center';
        playButtonText.anchorY = 'middle';
        playButtonText.position.z = 0.0; // Ligeramente encima del botón
        playButton.add(playButtonText); // Añádelo como hijo del botón
        playButton.userData.text = playButtonText; // Guardamos una referencia para cambiarlo
        playButtonText.sync();

         // --- Widget de Compases ---
        this.measures = new THREE.Group();
        this.measuresText = new Text();
        // NOTA: Usamos 4 como valor inicial, pero esto debería reflejar el estado real del AudioEngine
        this.measuresText.text = 'COMPASES < 4 >'; 
        this.measuresText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        this.measuresText.fontSize = 0.2;
        this.measuresText.color = 0xFFFFFF;
        this.measuresText.anchorX = 'center';
        // --- Botones para el Widget de Compases ---
        const measuresDec = new THREE.Mesh(buttonGeometry.clone(), buttonMaterial.clone());
        measuresDec.name = 'measures-decrement';
        measuresDec.position.set(0.31, -0.13, 0); // Posición relativa al texto "COMPASES"
        this.measures.add(measuresDec);
        this.interactiveControls.push(measuresDec);
        const measuresInc = new THREE.Mesh(buttonGeometry.clone(), buttonMaterial.clone());
        measuresInc.name = 'measures-increment';
        measuresInc.position.set(0.78, -0.13, 0); // Posición relativa al texto "COMPASES"
        this.measures.add(measuresInc);
        this.interactiveControls.push(measuresInc);
        // Posicionamos el widget completo
        this.measures.position.set(-6.29, 2.7, 0); 
        
        this.measures.add(this.measuresText);
        this.globalControlsContainer.add(this.measures);
        this.measuresText.sync();

        // --- Widget del Metrónomo ---
        this.metronome = new THREE.Group();
        this.globalControlsContainer.add(this.metronome);
        this.metronome.position.set(-6.58, 2.05, 0); // Lo posicionamos a la derecha

        const metroButtonGeo = new THREE.CircleGeometry(0.1, 8);
        const metroButtonMat = new THREE.MeshBasicMaterial({ color: 0x555555 }); // Color inicial: apagado
        const metronomeButton = new THREE.Mesh(metroButtonGeo, metroButtonMat);
        metronomeButton.position.set(0.8, 0.22, 0);
        metronomeButton.name = 'metronome-toggle';

        const metronomeText = new Text();
        metronomeText.text = 'METRONOMO';
        metronomeText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        metronomeText.fontSize = 0.2;
        metronomeText.color = 0xffffff;
        metronomeText.anchorX = 'center';
        metronomeText.anchorY = 'middle';
        metronomeText.position.set(0, 0.22, 0.01);
        this.metronome.add(metronomeText);
        metronomeText.sync();
        this.metronome.add(metronomeButton);
        this.interactiveControls.push(metronomeButton);
        // Guardamos una referencia al botón para poder cambiar su material
        this.metronome.userData.button = metronomeButton; 

    }
    

    rebuildVisualizers(measureCount, timeSignature) {
        // Limpieza de objetos anteriores
        this.measureVisualizers.forEach(vis => this.globalControlsContainer.remove(vis));
        if (this.activeMeasureIndicator) this.globalControlsContainer.remove(this.activeMeasureIndicator);
        this.beatVisualizers.forEach(vis => this.globalControlsContainer.remove(vis));
        this.measureVisualizers = [];
        this.beatVisualizers = [];

        // Extraemos las opciones para un código más limpio
        const opts = this.vizOptions;

        // --- 1. CÁLCULO Y DIBUJO DE LOS COMPASES (ANILLOS) ---

        // Calculamos el ancho total que ocuparán todos los anillos de compás
        const measuresTotalWidth = (measureCount - 1) * opts.ringSpacing;
        // El punto de inicio es la mitad de ese ancho a la izquierda, para centrar el conjunto
        const measureStartX = -measuresTotalWidth / 2;

        const ringGeometry = new THREE.RingGeometry(opts.ringSize * 0.8, opts.ringSize, 12);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < measureCount; i++) {
            // Posición X para el anillo del compás actual
            const ringX = measureStartX + (i * opts.ringSpacing);
            
            const ring = new THREE.Mesh(ringGeometry.clone(), ringMaterial.clone());
            ring.position.set(ringX, opts.yPositionMeasures, opts.layerOffset);
            this.globalControlsContainer.add(ring);
            this.measureVisualizers.push(ring);

            // --- 2. CÁLCULO Y DIBUJO DE LOS BEATS (PUNTOS) PARA ESTE COMPÁS ---

            // Calculamos el ancho total de los puntos DENTRO de un solo compás
            const beatsInMeasureWidth = (timeSignature - 1) * opts.dotSpacing;
            // El punto de inicio para los beats es relativo al centro del anillo actual
            const beatInMeasureStartX = -beatsInMeasureWidth / 2;
            
            const dotGeometry = new THREE.CircleGeometry(opts.dotSize, 8);
            const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const activeDotMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });

            for (let j = 0; j < timeSignature; j++) {
                // Posición X del beat relativa al centro de su anillo
                const beatRelativeX = beatInMeasureStartX + (j * opts.dotSpacing);
                
                // La posición final es la del anillo + la relativa del beat
                const dotX = ringX + beatRelativeX;

                const dot = new THREE.Mesh(dotGeometry.clone(), dotMaterial.clone());
                dot.position.set(dotX, opts.yPositionBeats, opts.layerOffset);
                dot.userData = { originalMaterial: dotMaterial, activeMaterial: activeDotMaterial };
                this.globalControlsContainer.add(dot);
                this.beatVisualizers.push(dot);
            }
        }

        // --- 3. CREACIÓN DEL INDICADOR DE COMPÁS ACTIVO ---
        
        const indicatorGeometry = new THREE.CircleGeometry(opts.ringSize * 0.7, 8);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0x01FF70 });
        this.activeMeasureIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        this.activeMeasureIndicator.position.z = opts.layerOffset + 0.01; // Ligeramente por encima
        this.activeMeasureIndicator.visible = false;
        this.globalControlsContainer.add(this.activeMeasureIndicator);
    }

    /* MÉTODO OBSOLETO - La posición ahora la gestiona SphereManager
    repositionTracks() {
        const opts = this.trackUIOptions;
        const trackIds = Object.keys(this.trackUIComponents);
        const numTracks = trackIds.length;

        if (numTracks === 0) return;

        const angleSweep = opts.endAngle - opts.startAngle;
        const angleStep = numTracks > 1 ? angleSweep / (numTracks - 1) : 0;

        trackIds.forEach((id, index) => {
            const trackUI = this.trackUIComponents[id];
            
            const angle = numTracks > 1 
                ? opts.startAngle + (index * angleStep)
                : (opts.startAngle + opts.endAngle) / 2;

            const x = Math.cos(angle) * opts.radius;
            const y = Math.sin(angle) * opts.radius;

            trackUI.position.set(x, y, 0.1);
        });
    }
    */
    
    createNewTrackButtons() {
        // --- Botón para Crear Pista de Audio ---
        const audioTrackButton = new THREE.Group();
        this.sequenceControlsContainer.add(audioTrackButton);
        audioTrackButton.position.set(-6.3, 1.2, 0.1);

        const ringGeometry = new THREE.RingGeometry(0.6, 0.8, 12);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4136 }); // Color rojo para audio
        const audioRing = new THREE.Mesh(ringGeometry, ringMaterial);
        audioTrackButton.add(audioRing);

        const audioText = new Text();
        audioText.text = '[+AUDIO]';
        audioText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        audioText.fontSize = 0.2;
        audioText.color = 0xFFFFFF;
        audioText.anchorX = 'center';
        audioText.anchorY = 'middle';
        audioText.position.z = 0.01;
        audioTrackButton.add(audioText);
        audioText.sync();

        // Plano de interacción invisible (más grande para un clic fácil)
        const audioHitbox = new THREE.Mesh(
            new THREE.PlaneGeometry(1.8, 1.8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        audioHitbox.name = 'create-audio-track';
        audioTrackButton.add(audioHitbox);
        this.interactiveControls.push(audioHitbox);

        // --- Botón para Crear Pista de Instrumento ---
        const instrumentTrackButton = new THREE.Group();
        this.sequenceControlsContainer.add(instrumentTrackButton);
        instrumentTrackButton.position.set(6.3, 1.2, 0.1);

        const instrumentRing = new THREE.Mesh(ringGeometry.clone(), new THREE.MeshBasicMaterial({ color: 0x0074D9 })); // Color azul para instrumento
        instrumentTrackButton.add(instrumentRing);

        const instrumentText = new Text();
        instrumentText.text = '[+INST]';
        instrumentText.font = '../GoogleSansCode-VariableFont_wght.ttf';
        instrumentText.fontSize = 0.2;
        instrumentText.color = 0xFFFFFF;
        instrumentText.anchorX = 'center';
        instrumentText.anchorY = 'middle';
        instrumentText.position.z = 0.01;
        instrumentTrackButton.add(instrumentText);
        instrumentText.sync();

        const instrumentHitbox = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        instrumentHitbox.name = 'create-instrument-track';
        instrumentTrackButton.add(instrumentHitbox);
        this.interactiveControls.push(instrumentHitbox);
    }
    
    createTrackUI(trackData) {
        // 1. CREAR LA BASE DEL WIDGET (UN GRUPO)
        const trackWidget = new THREE.Group();

        // 2. POSICIONAR Y ORIENTAR LA BASE
        // La colocamos en su lugar sobre la esfera
        trackWidget.position.copy(trackData.position);
        // Hacemos que "mire" hacia el centro de la esfera para alinearse con la curvatura
        trackWidget.lookAt(0, 0, 0);

        // 3. CONSTRUIR LOS COMPONENTES SOBRE LA BASE

        // --- Botón de Selección (el círculo principal) ---
        const selectGeo = new THREE.CircleGeometry(0.3, 32); // Un poco más grande
        const selectMat = new THREE.MeshStandardMaterial({
            color: trackData.type === 'instrument' ? 0x0074D9 : 0xFF4136,
            metalness: 0.4,
            roughness: 0.6,
            side: THREE.DoubleSide // <-- SOLUCIÓN: Hacer visible por ambos lados
        });
        const selectButton = new THREE.Mesh(selectGeo, selectMat);
        selectButton.name = `track-select-${trackData.id}`;
        this.interactiveControls.push(selectButton);
        trackWidget.add(selectButton);

        // --- Indicador de Selección (el aro verde) ---
        const indicatorGeo = new THREE.RingGeometry(0.32, 0.37, 32);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x01FF70, side: THREE.DoubleSide });
        const selectionIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        selectionIndicator.visible = false; // Oculto por defecto
        selectionIndicator.position.z = 0.01; // Ligeramente por encima para evitar z-fighting
        trackWidget.add(selectionIndicator);
        trackWidget.userData.selectionIndicator = selectionIndicator;

        // --- Botón de Grabación (REC) ---
        const recGeo = new THREE.CircleGeometry(0.1, 16);
        const recMat = this.metronomeOffMaterial.clone(); // Reutilizamos el material gris
        const recButton = new THREE.Mesh(recGeo, recMat);
        recButton.name = `rec-arm-track-${trackData.id}`;
        recButton.position.set(0, 0, 0.02); // <-- CAMBIO: Lo movemos al centro
        this.interactiveControls.push(recButton);
        trackWidget.add(recButton);
        trackWidget.userData.recButton = recButton;

        // 4. AÑADIR EL WIDGET COMPLETO A LA ESFERA
        if (this.mainSphere) {
            this.mainSphere.add(trackWidget);
        }

        // 5. GUARDAR REFERENCIA
        this.trackUIComponents[trackData.id] = trackWidget;

        console.log(`Widget de Pista UI creado para el track ${trackData.id}`);
    }

    /*
    +-- NUEVO MÉTODO: ACTUALIZAR LA POSICIÓN DEL GHOSTFINGER ---
    |   trackId: ID de la pista a la que pertenece el dedo fantasma
    |   coord: {x, y} coordenadas normalizadas (0-1) dentro del arco del instrumento
    |   isVisible: booleano que indica si el dedo debe mostrarse u ocultarse
    +---------------------------------------------------------+
    */
    updateGhostFinger(trackId, coord, isVisible) {
    const ghostFinger = this.ghostFingers.get(trackId);
    if (!ghostFinger) return;

    if (isVisible) {
        // Preparamos los parámetros que el GhostFinger necesita para calcular su posición.
        const instrumentParams = {
            startAngle: this.instrumentStartAngle,
            endAngle: this.instrumentEndAngle,
            innerRadius: this.instrumentInnerRadius,
            outerRadius: this.instrumentOuterRadius
        };
        // Le ordenamos al GhostFinger que se actualice. Él se encarga del resto.
        ghostFinger.update(coord, instrumentParams);
    } else {
        ghostFinger.hide();
    }
}

    /**
     * Actualiza el estado visual del botón REC de un componente de pista específico.
     * @param {number} trackId El ID de la pista cuya UI se va a actualizar.
     * @param {boolean} isArmed El nuevo estado de armado.
     */
    setTrackUIArmedState(trackId, isArmed) {
        const trackUI = this.trackUIComponents[trackId];
        if (trackUI && trackUI.userData.recButton) {
            // Usamos los mismos materiales que el metrónomo para consistencia (verde/gris)
            // O podrías crear materiales rojo/gris específicos para grabar
            trackUI.userData.recButton.material = isArmed ? this.metronomeOnMaterial : this.metronomeOffMaterial;
        }
    }

    /**
     * Actualiza la UI para mostrar qué pista está activa.
     * @param {number | null} activeTrackId El ID de la pista a resaltar, o null para ninguna.
     */
    setActiveTrackUI(activeTrackId) {
        // Recorremos todos los componentes de UI de las pistas
        for (const id in this.trackUIComponents) {
            const trackButton = this.trackUIComponents[id];
            if (trackButton && trackButton.userData.selectionIndicator) {
                // La visibilidad del indicador es verdadera solo si su ID coincide con el activo
                trackButton.userData.selectionIndicator.visible = (parseInt(id) === activeTrackId);
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
    
    setRecordingState(isArmed) { if (this.gestureText) this.gestureText.color = isArmed ? 0xff4136 : 0xffffff; }
    
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

    updateTempoDisplay(newBPM) {
        if (this.tempoText) {
            this.tempoText.text = `TEMPO (BPM) < ${newBPM.toFixed(0)} >`;
            this.tempoText.sync();
        }
    }

    updateMeasuresDisplay(newMeasures) {
        if (this.measuresText) {
            this.measuresText.text = `COMPASES < ${newMeasures} >`;
            this.measuresText.sync();
        }
    }

    toggleMetronomeVisuals(isOn) {
        this.isMetronomeOn = isOn;
        if (this.metronome && this.metronome.userData.button) {
            this.metronome.userData.button.material = isOn ? this.metronomeOnMaterial : this.metronomeOffMaterial;
        }
    }
    
    _onPointerDown(event) {
        this.pointer.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        // Primero, comprobamos si estamos haciendo clic en un control de UI
        const controlIntersects = this.raycaster.intersectObjects(this.interactiveControls);
        if (controlIntersects.length > 0) {
            if (this.onInteraction) this.onInteraction({ type: 'ui-click', element: controlIntersects[0].object.name });
            return; // Si es un control, no hacemos nada más
        }

        // Segundo, comprobamos si estamos haciendo clic en la esfera
        const sphereIntersects = this.raycaster.intersectObject(this.mainSphere);
        if (sphereIntersects.length > 0) {
            this.isDraggingSphere = true;
            this.previousPointerPosition = { x: event.clientX, y: event.clientY };
            return; // Interacción de arrastre de esfera
        }
        
        // Si no es la esfera, entonces es una interacción con el instrumento (disco invisible)
        this.isInteracting = true; 
        this._handleInteraction(event); 
    }
    _onPointerUp(event) {
        this.isDraggingSphere = false; // Dejamos de arrastrar la esfera
        this.isInteracting = false; // Dejamos de interactuar con el instrumento
        
        this.interactionLight.intensity = 0;
        if (this.onInteraction) this.onInteraction({ type: 'disc-drag', active: false });
    }
    _onPointerMove(event) {
        if (this.isDraggingSphere) {
            const deltaX = event.clientX - this.previousPointerPosition.x;
            const deltaY = event.clientY - this.previousPointerPosition.y;

            // La rotación en Y (horizontal) depende del movimiento en X del ratón
            this.mainSphere.rotation.y += deltaX * 0.005;
            // La rotación en X (vertical) depende del movimiento en Y del ratón
            this.mainSphere.rotation.x += deltaY * 0.005;

            this.previousPointerPosition = { x: event.clientX, y: event.clientY };
        } else if (this.isInteracting) {
            this._handleInteraction(event);
        }
    }
    
    _animate() {
        requestAnimationFrame(this._animate.bind(this));

        // Actualizamos los uniforms del shader en cada fotograma.
        if (this.shaderUniforms) {
            this.shaderUniforms.u_time.value += 0.005; // Esta velocidad se puede ajustar.
        }

        this.renderer.render(this.scene, this.camera);
    }
}