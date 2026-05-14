window.Utils = (function() {
    'use strict';

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function assertSbOrShowBlockingError() {
        if (!window.sb) {
            console.error('CRITICAL: Supabase client (window.sb) is not initialized.');
            document.body.innerHTML = `<div style="padding: 2rem; color: #ef4444; background: #111; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 14px; text-align: center;">
                <div>
                    <h2 style="margin-top:0;">Database Connection Error</h2>
                    <p>No se pudo conectar a la base de datos (Supabase Client Missing).</p>
                    <p>Por favor, revisa la configuración y recarga la página.</p>
                </div>
            </div>`;
            throw new Error('Supabase Client (window.sb) not initialized');
        }
        return true;
    }

    function setPageState(state) {
        const loading = document.getElementById('page-card-loading');
        const empty = document.getElementById('page-card-empty');
        const content = document.getElementById('module-content');
        
        if(loading) loading.classList.remove('is-visible');
        if(empty) empty.classList.remove('is-visible', 'is-error');
        if(content) content.classList.remove('hidden');

        if (state === 'loading') {
            // Non-blocking load: let content be visible so we see skeletons/scrambling
            // if(loading) loading.classList.add('is-visible');
            // if(content) content.classList.add('hidden');
        } else if (state === 'empty') {
            if(empty) empty.classList.add('is-visible');
            if(content) content.classList.add('hidden');
        } else if (state === 'error') {
            if(empty) {
                empty.classList.add('is-visible', 'is-error');
                const emptyText = empty.querySelector('.empty-state');
                if(emptyText) emptyText.textContent = 'Hubo un error al cargar los datos.';
            }
            if(content) content.classList.add('hidden');
        }
    }

    function confirmModal(title, message, confirmText = 'Confirmar', danger = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            if (!modal) {
                const isConfirmed = confirm(title + '\n\n' + message);
                resolve(isConfirmed);
                return;
            }

            modal.querySelector('.modal-title').textContent = title;
            modal.querySelector('.modal-body p').textContent = message;
            
            const btnConfirm = modal.querySelector('.btn-submit');
            btnConfirm.textContent = confirmText;
            
            if (danger) {
                btnConfirm.className = 'btn btn-danger btn-submit';
            } else {
                btnConfirm.className = 'btn btn-primary btn-submit';
            }

            const handleConfirm = () => { cleanup(); resolve(true); };
            const handleCancel = () => { cleanup(); resolve(false); };

            const btnCancel = modal.querySelector('.btn-ghost');
            const closeBtn = modal.querySelector('.modal-close');

            btnConfirm.addEventListener('click', handleConfirm);
            btnCancel.addEventListener('click', handleCancel);
            if (closeBtn) closeBtn.addEventListener('click', handleCancel);

            function cleanup() {
                btnConfirm.removeEventListener('click', handleConfirm);
                btnCancel.removeEventListener('click', handleCancel);
                if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
                modal.classList.remove('active');
            }

            modal.classList.add('active');
        });
    }

    function alertModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('alertModal');
            if (!modal) {
                alert(title + '\n\n' + message);
                resolve();
                return;
            }

            modal.querySelector('.modal-title').textContent = title;
            modal.querySelector('.modal-body p').textContent = message;

            const btnOk = modal.querySelector('.btn-primary');
            const closeBtn = modal.querySelector('.modal-close');

            const handleOk = () => { cleanup(); resolve(); };

            btnOk.addEventListener('click', handleOk);
            if (closeBtn) closeBtn.addEventListener('click', handleOk);

            function cleanup() {
                btnOk.removeEventListener('click', handleOk);
                if (closeBtn) closeBtn.removeEventListener('click', handleOk);
                modal.classList.remove('active');
            }

            modal.classList.add('active');
        });
    }

    const scrambleIntervals = new Map();

    function startScramble(element) {
        if (!element) return;
        if (scrambleIntervals.has(element)) return;
        
        // Save original value if it exists and we haven't yet
        if (!element.dataset.orig) element.dataset.orig = element.textContent;
        const length = Math.max(2, element.textContent.trim().length);
        
        const interval = setInterval(() => {
            let scrambled = '';
            for(let i=0; i<length; i++) {
                scrambled += Math.floor(Math.random() * 10);
            }
            element.textContent = scrambled;
        }, 40); // 40ms updates = 25fps Matrix style
        
        scrambleIntervals.set(element, interval);
    }

    function stopScramble(element, finalValue) {
        if (!element) return;
        if (scrambleIntervals.has(element)) {
            clearInterval(scrambleIntervals.get(element));
            scrambleIntervals.delete(element);
        }
        
        // Final transition effect
        element.style.transform = 'scale(1.1)';
        element.textContent = finalValue;
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            element.style.transition = 'transform 0.2s ease-out';
        }, 50);
    }

    return {
        debounce,
        assertSbOrShowBlockingError,
        setPageState,
        confirmModal,
        alertModal,
        startScramble,
        stopScramble
    };
})();