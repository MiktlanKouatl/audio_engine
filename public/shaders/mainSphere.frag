uniform float u_time;
uniform int u_effect_type; // 0: Ondas Alpha, 1: Desplazamiento de Vértices

varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_normal_view;
varying float v_displacement; // Recibimos la cantidad de desplazamiento

// La función de onda se necesita en ambos efectos
float create_ripple(vec3 epic_center, vec3 current_pos, float time) {
    float distance = acos(dot(current_pos, epic_center));
    return sin(distance * 25.0 - time * 2.0);
}

void main() {

    if (u_effect_type == 0) {
        // --- EFECTO 0: ONDAS DE ALPHA (el efecto original) ---
        vec3 current_pos_normalized = normalize(v_position);
        vec3 p1 = vec3(1.0, 0.0, 0.0);
        vec3 p2 = vec3(-1.0, 0.0, 0.0);
        vec3 p3 = vec3(0.0, 0.0, 1.0);
        vec3 p4 = vec3(0.0, 0.0, -1.0);

        float wave1 = create_ripple(p1, current_pos_normalized, u_time);
        float wave2 = create_ripple(p2, current_pos_normalized, u_time);
        float wave3 = create_ripple(p3, current_pos_normalized, u_time);
        float wave4 = create_ripple(p4, current_pos_normalized, u_time);

        float total_wave = max(wave1, max(wave2, max(wave3, wave4)));
        float wave_alpha = smoothstep(0.9, 1.0, total_wave);
        float depth_alpha = smoothstep(-0.2, 0.2, v_normal_view.z);
        float final_alpha = wave_alpha * depth_alpha;

        if (final_alpha < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0), final_alpha);

    } else if (u_effect_type == 1) {
        // --- EFECTO 1: COLOR PARA DESPLAZAMIENTO DE VÉRTICES ---
        // La geometría ya ha sido deformada por el Vertex Shader.
        // Aquí, simplemente le damos color. Usaremos la "altura" (v_displacement)
        // para definir la intensidad del brillo.
        float color_intensity = v_displacement; // v_displacement va de 0.0 a 1.0

        // Mantenemos el desvanecimiento por profundidad para un look más suave.
        float depth_alpha = smoothstep(-0.2, 0.2, v_normal_view.z);
        
        float final_alpha = color_intensity * depth_alpha;

        if (final_alpha < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0), final_alpha);
    }
}
