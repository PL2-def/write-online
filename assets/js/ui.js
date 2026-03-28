/**
 * C:\Users\PL2\Documents\write\assets\js\ui.js
 * Gère les notifications, modales et overlays
 */

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle-2';
    if (type === 'error') icon = 'alert-circle';
    
    toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function showLoading(message) {
    const loadingMessage = document.getElementById('loading-message');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingOverlay) loadingOverlay.classList.add('active');
}

export function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');
}

export function showCustomDialog({ title, message, isPrompt = false, defaultValue = '' }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const titleEl = document.getElementById('custom-dialog-title');
        const messageEl = document.getElementById('custom-dialog-message');
        const confirmBtn = document.getElementById('custom-dialog-confirm');
        const cancelBtn = document.getElementById('custom-dialog-cancel');
        const promptContainer = document.getElementById('custom-prompt-container');
        const promptInput = document.getElementById('custom-prompt-input');

        if (!overlay) {
            resolve(isPrompt ? null : false);
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        
        if (isPrompt) {
            promptContainer.style.display = 'block';
            promptInput.value = defaultValue;
        } else {
            promptContainer.style.display = 'none';
        }
        
        overlay.classList.add('active');
        
        // Trap focus & A11y
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableContent = overlay.querySelectorAll(focusableElements);
        const firstFocusableElement = focusableContent[0];
        const lastFocusableElement = focusableContent[focusableContent.length - 1];
        
        if (isPrompt) {
            promptInput.focus();
        } else {
            confirmBtn.focus();
        }

        const handleKeydown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve(isPrompt ? null : false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve(isPrompt ? promptInput.value : true);
            } else if (e.key === 'Tab') {
                // Ignore focus trap if not fully functional to avoid breaking
                // the modal accessibility
            }
        };

        const cleanup = () => {
            overlay.classList.remove('active');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            document.removeEventListener('keydown', handleKeydown, true);
        };

        document.addEventListener('keydown', handleKeydown, true);

        confirmBtn.onclick = () => {
            cleanup();
            resolve(isPrompt ? promptInput.value : true);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(isPrompt ? null : false);
        };
    });
}

export function showConfirm(message, title = "Confirmation") {
    return showCustomDialog({ title, message, isPrompt: false });
}

export function showPrompt(message, defaultValue = '', title = "Saisie requise") {
    return showCustomDialog({ title, message, isPrompt: true, defaultValue });
}
