### Resumen de Sesión

**Objetivo Principal:** Implementar una interfaz 3D con Three.js para una aplicación de loopstation.

**Arquitectura Acordada:** Adoptar un enfoque de componentes modulares para la UI, encapsulando la lógica visual en clases dedicadas para evitar sobrecargar `VisualScene.js`.

**Componentes Creados:**
- `src/modules/widgets/TrackWidget.js`: Una clase que gestiona la apariencia y estado de un único track (botón, panel de volumen, etc.).
- `src/modules/widgets/GlobalControlsWidget.js`: Una clase para gestionar los controles globales (Play, Tempo) con un layout responsivo anclado a la esquina superior-izquierda.

**Refactorización en Curso:**
Estamos en proceso de modificar `VisualScene.js` para que actúe como un simple gestor de estos nuevos widgets, en lugar de construir los elementos directamente.

**Decisiones de UI/UX y Bugs Corregidos:**
- El slider de volumen es solo un control, no un VU-metro (la lógica del VU-metro está temporalmente desactivada).
- Se deben eliminar los anillos de los botones `[+AUDIO]` y `[+INST]`.
- La interacción del clic/arrastre ha sido corregida en `_onPointerDown` para priorizar los controles de la UI y el instrumento sobre el arrastre de la esfera.

**Ideas a Futuro:**
- Crear un `MaterialManager` para temas de color dinámicos.
- Crear una clase `MainSphere.js` para encapsular la lógica de la esfera.
- Implementar un "dial rotatorio" para los controles de pista si estos son muchos.
