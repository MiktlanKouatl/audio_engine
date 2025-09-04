# AudioEngine Looper 🎧

Un secuenciador por pasos y loopstation polifónico construido con tecnologías web modernas, enfocado en la modularidad, el rendimiento y la estabilidad rítmica. Este proyecto busca emular la lógica y funcionalidades de herramientas de producción musical profesionales como Loopy Pro en el entorno del navegador.

---

## Core Technologies

* **Motor de Audio:** [Tone.js](https://tonejs.github.io/)
* **Motor Gráfico (Futuro):** [Three.js](https://threejs.org/docs/)
* **Panel de Control (Futuro):** [Tweakpane](https://tweakpane.github.io/docs/)
* **Lenguaje:** JavaScript (ESM) con un paradigma estricto de Programación Orientada a Objetos (OOP).

## Principios de Arquitectura

1.  **Separación de Intereses (SoC):** Cada módulo (`AudioEngine`, `UIManager`, `Track`, `RecorderModule`) tiene una única y clara responsabilidad.
2.  **Modularidad y Desacoplamiento:** Los módulos se comunican a través de APIs públicas (métodos) y no dependen de la implementación interna de otros módulos.
3.  **Sincronización por Agendamiento:** Todas las acciones de audio se agendan en el futuro en la línea de tiempo del `Transport` para garantizar una estabilidad rítmica perfecta.

---

## 🗺️ Project Roadmap

El desarrollo se divide en fases, donde cada una construye sobre la anterior para añadir una capa completa de funcionalidad.

### Fase 0: El Núcleo del Transporte y la Secuencia ⚙️
*(El "esqueleto" funcional)*

**Objetivo:** Establecer la arquitectura base con un `Transport` funcional y una única pista de secuenciador no interactiva.

* [ ] **1. Estructura del Proyecto:** Crear el layout de archivos (`index.html`, `main.js`, `AudioEngine.js`, `UIManager.js`, `Track.js`).
* [ ] **2. `AudioEngine` Básico:** Implementar la clase `AudioEngine` para gestionar la instancia global de `Tone.Transport`.
* [ ] **3. `UIManager` Mínimo:** Implementar controles de Play/Pause en la UI que se comuniquen con el `AudioEngine`.
* [ ] **4. Clase `Track` Inicial:** Crear la clase `Track` que contenga un `Tone.Synth` y un `Tone.Sequence` con un patrón de notas predefinido (hard-coded).
* [ ] **5. Ensamblaje en `main.js`:** Instanciar y conectar los módulos para que al dar "Play" se escuche el patrón de la `Track`.

### Fase 1: El Secuenciador Interactivo y Multi-Pista 🎹
*(Haciendo la aplicación usable como secuenciador)*

**Objetivo:** Permitir al usuario modificar patrones y añadir múltiples pistas.

* [ ] **1. UI Dinámica:** El `UIManager` debe ser capaz de dibujar una cuadrícula (grid) de 16 pasos para una `Track`.
* [ ] **2. Interactividad del Patrón:** Implementar la lógica `toggleStep()`: el clic en un paso de la UI modifica el array de datos en la instancia de la `Track` correspondiente.
* [ ] **3. Multi-Pista:** Refactorizar `main.js` y `UIManager` para poder crear y visualizar múltiples instancias de `Track` (ej. Bombo, Caja, Hi-Hat).
* [ ] **4. Sonidos de Batería:** Reemplazar el `Tone.Synth` en las pistas de percusión por un `Tone.Sampler` para usar muestras de audio reales.
* [ ] **5. Visualización del "Playhead":** Usar `requestAnimationFrame` en el `UIManager` para mostrar visualmente el paso actual que se está reproduciendo.

### Fase 2: El Motor de Grabación Cuantizada 🔴
*(Transformando el secuenciador en un "looper")*

**Objetivo:** Implementar la capacidad de grabar audio en vivo desde el micrófono, de forma sincronizada.

* [ ] **1. `RecorderModule`:** Desarrollar el módulo de grabación centralizado como una clase Singleton.
* [ ] **2. Acceso al Micrófono:** Implementar el método `initializeMicrophone()` en `RecorderModule`, manejando los permisos del navegador.
* [ ] **3. Lógica de Grabación Agendada:** Implementar el método `startScheduledRecording({ length, quantizeStart })` que utiliza el `Transport` para iniciar y detener la grabación con precisión.
* [ ] **4. Integración con `Track`:** Modificar la clase `Track` para que pueda pasar de ser un secuenciador a un "reproductor de loop". Deberá poder invocar al `RecorderModule` y cargar el audio resultante en un `Tone.Player`.
* [ ] **5. UI de Grabación:** Añadir botones en la UI para cada pista que permitan "Armar para Grabar" e "Iniciar Grabación".

### Fase 3: El Mezclador y los Efectos (FX) 🎛️
*(Añadiendo capacidades de producción y diseño sonoro)*

**Objetivo:** Dar al usuario control sobre el volumen, paneo y efectos de cada pista.

* [ ] **1. Integrar `Tone.Channel`:** Refactorizar la clase `Track` para que su salida de audio pase a través de un `Tone.Channel`, permitiendo control de volumen, pan, mute y solo.
* [ ] **2. UI del Mezclador:** Añadir sliders y botones en el `UIManager` para controlar las propiedades del `Tone.Channel` de cada pista.
* [ ] **3. Cadena de Efectos Básica:** Añadir una cadena de efectos (ej. `Tone.Reverb`, `Tone.Filter`) a cada `Track`.
* [ ] **4. Controles de Efectos:** Exponer los parámetros principales de los efectos en la UI para que el usuario pueda modificarlos en tiempo real (un buen caso de uso para `Tweakpane`).

### Fase 4: Visualización y Refinamiento ✨
*(Pulido final y la conexión audio-visual)*

**Objetivo:** Mejorar la experiencia de usuario y añadir una capa gráfica reactiva.

* [ ] **1. `VisualScene`:** Crear la clase para manejar una escena básica de `Three.js`.
* [ ] **2. Análisis de Audio:** Usar `Tone.FFT` o `Tone.Meter` en el `AudioEngine` para obtener datos de la señal de audio (ej. volumen general, componentes de frecuencia).
* [... ] **3. Gráficos Reactivos:** Hacer que elementos en la escena de `Three.js` reaccionen a los datos de audio.
* [... ] **4. Guardar/Cargar Sesión:** Implementar la capacidad de guardar el estado de las pistas y patrones (ej. usando JSON y `localStorage`).

---