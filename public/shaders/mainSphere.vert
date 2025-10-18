uniform float u_time;
uniform float u_point_size;
uniform int u_effect_type; // 0: Ondas Alpha, 1: Desplazamiento de Vértices

varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_normal_view;
varying float v_displacement; // Pasamos la cantidad de desplazamiento al fragment shader

// La función que calcula la onda, ahora vive aquí para ser usada en el desplazamiento.
float create_ripple(vec3 epic_center, vec3 current_pos, float time) {
    float distance = acos(dot(current_pos, epic_center));
    return sin(distance * 25.0 - time * 2.0);
}

void main() {
    v_position = position;
    v_normal = normal;
    v_displacement = 0.0; // El desplazamiento por defecto es 0

    vec3 displaced_position = position;

    if (u_effect_type == 1) {
        // --- EFECTO 1: LÓGICA DE DESPLAZAMIENTO DE VÉRTICES ---
        vec3 p1 = vec3(1.0, 0.0, 0.0);
        vec3 p2 = vec3(-1.0, 0.0, 0.0);
        vec3 p3 = vec3(0.0, 0.0, 1.0);
        vec3 p4 = vec3(0.0, 0.0, -1.0);

        vec3 current_pos_normalized = normalize(position);
        float wave1 = create_ripple(p1, current_pos_normalized, u_time);
        float wave2 = create_ripple(p2, current_pos_normalized, u_time);
        float wave3 = create_ripple(p3, current_pos_normalized, u_time);
        float wave4 = create_ripple(p4, current_pos_normalized, u_time);

        float total_wave = max(wave1, max(wave2, max(wave3, wave4)));
        
        // Guardamos el valor de la onda (0.0 a 1.0) para pasarlo al fragment shader
        v_displacement = smoothstep(0.9, 1.0, total_wave);

        // Aplicamos el desplazamiento a la posición del vértice a lo largo de su normal
        float displacement_amount = 0.2; // Qué tan "alto" es el relieve
        displaced_position = position + normal * v_displacement * displacement_amount;
    }

    // --- CÁLCULOS FINALES DE POSICIÓN (común a ambos efectos) ---
    vec4 modelViewPosition = modelViewMatrix * vec4(displaced_position, 1.0);
    v_normal_view = normalize((modelViewMatrix * vec4(normal, 0.0)).xyz);

    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = u_point_size;
}
