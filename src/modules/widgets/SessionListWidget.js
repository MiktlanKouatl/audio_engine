import * as THREE from 'three';
import { Text } from 'troika-three-text';

export class SessionListWidget extends THREE.Group {
    constructor(interactiveControls) {
        super();
        this.interactiveControls = interactiveControls;
        this.visible = false; // Initially hidden
    }

    populate(sessions, onSessionClick) {
        // Clear previous list
        this.clear();

        const background = new THREE.Mesh(
            new THREE.PlaneGeometry(3, sessions.length * 0.4 + 0.2),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 })
        );
        background.position.z = -0.1;
        this.add(background);

        sessions.forEach((session, index) => {
            const sessionText = new Text();
            sessionText.text = session.name;
            sessionText.font = '../GoogleSansCode-VariableFont_wght.ttf';
            sessionText.fontSize = 0.2;
            sessionText.color = 0xFFFFFF;
            sessionText.anchorX = 'center';
            sessionText.position.y = (sessions.length / 2 - index - 0.5) * 0.4;
            this.add(sessionText);

            const hitbox = new THREE.Mesh(
                new THREE.PlaneGeometry(2.8, 0.3),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitbox.name = `load-session-name-${session.name}`;
            hitbox.position.y = sessionText.position.y;
            this.add(hitbox);
            this.interactiveControls.push(hitbox);

            sessionText.sync();
        });

        this.visible = true;
    }

    clear() {
        this.children.forEach(child => {
            if (child.isMesh) {
                const index = this.interactiveControls.indexOf(child);
                if (index > -1) {
                    this.interactiveControls.splice(index, 1);
                }
            }
        });
        this.remove(...this.children);
    }
}
