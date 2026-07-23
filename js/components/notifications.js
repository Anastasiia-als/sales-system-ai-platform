/* js/components/notifications.js - Toast Notification System */

export const Toast = {
    containerId: "toast-container",

    getContainer() {
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement("div");
            container.id = this.containerId;
            container.className = "toast-container";
            document.body.appendChild(container);
        }
        return container;
    },

    show(type, title, message, duration = 4000) {
        const container = this.getContainer();
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconName = "info";
        if (type === "success") iconName = "check-circle";
        if (type === "danger") iconName = "alert-circle";
        if (type === "warning") iconName = "alert-triangle";

        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="toast-content">
                <h5>${title}</h5>
                <p>${message}</p>
            </div>
        `;

        container.appendChild(toast);
        
        // Render Lucide icon
        if (window.lucide) {
            window.lucide.createIcons({
                attrs: {
                    class: 'toast-lucide-icon'
                },
                nameAttr: 'data-lucide'
            });
        }

        // Animate slide out and remove
        setTimeout(() => {
            toast.style.animation = "slideInToast var(--transition-normal) reverse forwards";
            toast.addEventListener("animationend", () => {
                toast.remove();
            });
        }, duration);
    },

    success(title, message, duration) {
        this.show("success", title, message, duration);
    },

    error(title, message, duration) {
        this.show("danger", title, message, duration);
    },

    warning(title, message, duration) {
        this.show("warning", title, message, duration);
    },

    info(title, message, duration) {
        this.show("info", title, message, duration);
    }
};
