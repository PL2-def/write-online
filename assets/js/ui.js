/**
 * C:\Users\PL2\Documents\write\assets\js\ui.js
 * Gère les notifications, modales et overlays avec accessibilité et file d'attente.
 */

const toastQueue = [];
let isToastShowing = false;

export function showToast(message, type = 'info') {
    toastQueue.push({ message, type });
    processToastQueue();
}

function processToastQueue() {
    if (isToastShowing || toastQueue.length === 0) return;
    
    isToastShowing = true;
    const { message, type } = toastQueue.shift();
    
    const container = document.getElementById('toast-container');
    if (!container) {
        isToastShowing = false;
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    
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
        setTimeout(() => {
            toast.remove();
            isToastShowing = false;
            processToastQueue();
        }, 300);
    }, 3000);
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

export function showCustomDialog({ title, message, isPrompt = false, defaultValue = '', isHtml = false }) {
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

        // Accessibility
        const dialogContent = overlay.querySelector('.modal-content');
        if (dialogContent) {
            dialogContent.setAttribute('role', 'dialog');
            dialogContent.setAttribute('aria-modal', 'true');
            dialogContent.setAttribute('aria-labelledby', 'custom-dialog-title');
            dialogContent.setAttribute('aria-describedby', 'custom-dialog-message');
        }

        titleEl.textContent = title;
        if (isHtml) {
            messageEl.innerHTML = message;
        } else {
            messageEl.textContent = message;
        }
        
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
            promptInput.select();
        } else {
            confirmBtn.focus();
        }

        const handleKeydown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                cleanup();
                resolve(isPrompt ? null : false);
            } else if (e.key === 'Enter' && e.target !== cancelBtn) {
                e.preventDefault();
                cleanup();
                resolve(isPrompt ? promptInput.value : true);
            } else if (e.key === 'Tab') {
                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstFocusableElement) {
                        lastFocusableElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastFocusableElement) {
                        firstFocusableElement.focus();
                        e.preventDefault();
                    }
                }
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
