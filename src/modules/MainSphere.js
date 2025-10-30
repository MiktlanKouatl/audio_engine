import * as THREE from 'three';
import vertexShader from '/public/shaders/mainSphere.vert?raw';
import fragmentShader from '/public/shaders/mainSphere.frag?raw';

export class MainSphere extends THREE.Points {
    constructor() {
        const sphereGeometry = new THREE.SphereGeometry(3.5, 64, 64);

        const shaderUniforms = {
            u_time: { value: 0.0 },
            u_point_size: { value: 2.5 },
            u_effect_type: { value: 1 }
        };

        const pointsMaterial = new THREE.ShaderMaterial({
            uniforms: shaderUniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        super(sphereGeometry, pointsMaterial);

        this.rotation.y = Math.PI / 2;
        this.position.set(0, 0, 0);
        this.shaderUniforms = shaderUniforms;
    }

    update() {
        if (this.material.uniforms) {
            this.material.uniforms.u_time.value += 0.005;
        }
    }
}
