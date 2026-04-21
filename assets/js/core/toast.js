/**
 * Toast Notification System
 * Standardized notifications for the application.
 * Usage:
 * window.Toast.success('Operation completed');
 * window.Toast.error('Something went wrong');
 * window.Toast.info('Did you know?');
 */

window.Toast = (function() {
    let container = null;

    function init() {
        if (container) return;
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    function show(message, type = 'info', duration = 4000) {
        if (!container) init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
        let icon = '';
        if (type === 'success') icon = '✓';
        if (type === 'error') icon = '✕';
        if (type === 'info') icon = 'ℹ';
        if (type === 'warning') icon = '⚠';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">×</button>
        `;

        // Close button logic
        toast.querySelector('.toast-close').addEventListener('click', () => {
             dismiss(toast);
        });

        container.appendChild(toast);

        // Animation In
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto Dismiss
        if (duration > 0) {
            setTimeout(() => {
                dismiss(toast);
            }, duration);
        }
    }

    function dismiss(toast) {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    }

    return {
        success: (msg, dur) => show(msg, 'success', dur),
        error: (msg, dur) => show(msg, 'error', dur),
        info: (msg, dur) => show(msg, 'info', dur),
        warning: (msg, dur) => show(msg, 'warning', dur)
    };
})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
    // If container doesn't exist, init will create it on first call
});
