/**
 * C:\Users\PL2\Documents\write\assets\js\effects.js
 * Gère les effets visuels : Power Mode (particules) et Typewriter Mode.
 */

class PowerMode {
    constructor() {
        this.canvas = document.getElementById('power-mode-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = localStorage.getItem('power-mode') === 'true';
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawn(x, y, color) {
        if (!this.active) return;
        
        const count = 5 + Math.random() * 5;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5,
                alpha: 1,
                color: color || 'var(--accent)',
                size: 2 + Math.random() * 4
            });
        }
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravity
            p.alpha -= 0.02;
            
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color.startsWith('var') ? getComputedStyle(document.body).getPropertyValue(p.color.match(/\(([^)]+)\)/)[1]) : p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        requestAnimationFrame(() => this.loop());
    }

    toggle(state) {
        this.active = state;
        localStorage.setItem('power-mode', state);
    }
}

export const powerMode = new PowerMode();

/**
 * Centre la ligne active dans l'éditeur.
 */
export function centerActiveLine(quill) {
    if (!document.body.classList.contains('typewriter-active')) return;

    const selection = quill.getSelection();
    if (!selection) return;

    const bounds = quill.getBounds(selection.index);
    const editorContainer = document.querySelector('.editor-section');
    const editorCard = document.querySelector('.editor-card');
    
    if (bounds && editorContainer) {
        // Calculer la position relative de la ligne dans le conteneur de scroll
        const scrollTop = bounds.top + editorCard.offsetTop - (editorContainer.offsetHeight / 2) + (bounds.height / 2);
        
        editorContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }
}

/**
 * Initialise les écouteurs pour les effets.
 */
export function initEffects(quill) {
    // Écouteur de frappe pour le Power Mode
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user' && powerMode.active) {
            const range = quill.getSelection();
            if (range) {
                const bounds = quill.getBounds(range.index);
                const editorRect = quill.container.getBoundingClientRect();
                
                // Position approximative du curseur à l'écran
                const x = editorRect.left + bounds.left;
                const y = editorRect.top + bounds.top;
                
                // Utiliser la couleur de l'accentuation actuelle
                const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim();
                powerMode.spawn(x, y, accentColor);
            }
        }
        
        // Typewriter centrage
        if (source === 'user') {
            setTimeout(() => centerActiveLine(quill), 10);
        }
    });

    // Écouteur de sélection pour le centrage Typewriter (clic ou flèches)
    quill.on('selection-change', (range) => {
        if (range) {
            setTimeout(() => centerActiveLine(quill), 10);
        }
    });
}
