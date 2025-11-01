export class SessionListWidget {
    constructor() {
        // Create the main overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'session-list-overlay';
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100vw';
        this.overlay.style.height = '100vh';
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.overlay.style.display = 'flex';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.alignItems = 'center';
        this.overlay.style.zIndex = '1000';
        this.overlay.style.visibility = 'hidden';
        this.overlay.style.opacity = '0';
        this.overlay.style.transition = 'visibility 0s, opacity 0.3s linear';

        // Create the content container
        const container = document.createElement('div');
        container.id = 'session-list-container';
        container.style.backgroundColor = '#222';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.maxWidth = '400px';
        container.style.maxHeight = '80vh';
        container.style.overflowY = 'auto';
        container.style.color = 'white';
        container.style.position = 'relative';
        container.style.fontFamily = 'monospace';

        // Create the close button
        const closeButton = document.createElement('button');
        closeButton.id = 'session-list-close-button';
        closeButton.textContent = '✖';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.fontSize = '1.2rem';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.hide();

        // Create the title
        const title = document.createElement('h3');
        title.textContent = 'Cargar Sesión';
        title.style.marginTop = '0';
        title.style.color = '#01FF70';

        // Create the list element
        this.listElement = document.createElement('ul');
        this.listElement.style.listStyle = 'none';
        this.listElement.style.padding = '0';
        this.listElement.style.margin = '0';

        // Assemble the widget
        container.appendChild(closeButton);
        container.appendChild(title);
        container.appendChild(this.listElement);
        this.overlay.appendChild(container);
        document.body.appendChild(this.overlay);
    }

    populate(sessions, onSessionClick) {
        // Clear previous list
        this.listElement.innerHTML = '';

        if (sessions.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No hay sesiones guardadas.';
            emptyItem.style.padding = '10px';
            this.listElement.appendChild(emptyItem);
            return;
        }

        sessions.forEach(session => {
            const listItem = document.createElement('li');
            listItem.textContent = session.name;
            listItem.style.padding = '10px';
            listItem.style.cursor = 'pointer';
            listItem.style.borderBottom = '1px solid #333';

            listItem.onmouseover = () => listItem.style.backgroundColor = '#444';
            listItem.onmouseout = () => listItem.style.backgroundColor = 'transparent';

            listItem.onclick = () => {
                onSessionClick(session.name);
                this.hide(); // Automatically hide after selection
            };
            this.listElement.appendChild(listItem);
        });
    }

    show() {
        this.overlay.style.visibility = 'visible';
        this.overlay.style.opacity = '1';
    }

    hide() {
        this.overlay.style.opacity = '0';
        this.overlay.style.visibility = 'hidden';
    }

    clear() {
        this.listElement.innerHTML = '';
    }
}
