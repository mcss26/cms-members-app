/**
 * @fileoverview Shared utilities for FormulaMid modules.
 * Includes DOM helpers, math/formatting tools, and common modal dialogs.
 * 
 * @see {@link .agent/workflows/backups/track-module.md} for module tracking conventions.
 */
(function () {
  if (window.Utils) return;

  const debounce = (fn, wait = 180) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const numberOrNull = (val) => {
    if (val === null || val === undefined) return null;
    const n = parseFloat(String(val).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const assertSbOrShowBlockingError = (targetEl, message) => {
    if (window.sb) return true;
    const msg =
      message ||
      "No se pudo iniciar la conexión. Recargá la página o contactá soporte.";
    const target = targetEl || document.getElementById("list-container");
    if (target) {
      target.innerHTML = `<div class="empty-state accent">${msg}</div>`;
    }
    console.error("[Utils] Supabase client not initialized.");
    return false;
  };

  const calcReplenishment = ({ requerido, stock_actual, pack_qty }) => {
    const req = numberOrNull(requerido) || 0;
    const curr = numberOrNull(stock_actual) || 0;
    const packSize = numberOrNull(pack_qty) || 1;

    const unidades = Math.max(req - curr, 0);
    const pack = Math.ceil(unidades / packSize);
    const total = pack * packSize;

    return { unidades, pack, total };
  };

  const mapSolicitudEstadoUI = ({
    supplier_id,
    eta_date,
    final_cost,
    supplier_order_status,
  }) => {
    const s = (supplier_order_status || "").toLowerCase();
    const hasSupplier = Boolean(supplier_id);
    const hasDate = Boolean(eta_date);
    const costKnown = final_cost !== undefined;
    const hasCost = costKnown ? final_cost !== null && final_cost !== "" : true;
    const isReady = hasSupplier && hasDate && hasCost;

    if (!isReady) return "pendiente";
    if (s === "received") return "recibido";
    if (["approved", "ordered", "in_transit", "arrived"].includes(s))
      return "aprobado";
    if (s === "ready_for_approval") return "enviado";
    if (s === "draft" || s === "pending") return "pendiente";

    return "enviado";
  };

  const generateUUID = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback RFC 4122 v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r =
        (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >>
        (c === "x" ? 0 : 3);
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  const formatARS = (n) => {
    if (n === null || n === undefined) return "-";
    // Using explicit 'es-AR' locale for consistent formatting
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(n);
  };



  /* DOM Helpers */
  const hide = (el) => { if (el) el.classList.add('hidden'); };
  const show = (el) => { if (el) el.classList.remove('hidden'); };

  /**
   * Safe modal opener — works with <dialog> AND <div> modals
   * @param {HTMLElement} modal - The modal element to open
   */
  const openModal = (modal) => {
    if (!modal) return;
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.classList.remove('hidden');
    }
  };
  const isHidden = (el) => el ? el.classList.contains('hidden') : true;

  /**
   * Escape HTML to prevent XSS
   */
  const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  /**
   * Promise-based confirmation modal
   * @param {string} message - The confirmation question
   * @param {object} options - Optional config { confirmText, cancelText, isDanger }
   * @returns {Promise<boolean>} - true if confirmed, false if cancelled
   */
  const confirmAction = (message, options = {}) => {
    return new Promise((resolve) => {
      const { confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false } = options;
      
      // Try to use existing modal first
      let modal = document.getElementById('confirmModal');

      // Ensure it's a <dialog> — if not, remove and recreate
      if (modal && modal.tagName !== "DIALOG") {
        modal.remove();
        modal = null;
      }

      // Create modal if not exists
      if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'confirmModal';
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content">
            <p id="confirm-message" class="modal-body"></p>
            <div class="modal-footer">
              <button type="button" class="btn-ghost" id="btn-cancel-confirm">Cancelar</button>
              <button type="button" class="btn-primary" id="btn-confirm-action">Confirmar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      let msgEl = modal.querySelector('#confirm-message');
      let btnConfirm = modal.querySelector('#btn-confirm-action');
      let btnCancel = modal.querySelector('#btn-cancel-confirm');

      // Update content
      if (msgEl) msgEl.textContent = message;
      if (btnConfirm) {
        btnConfirm.textContent = confirmText;
        btnConfirm.className = isDanger ? 'btn-danger' : 'btn-primary';
      }
      if (btnCancel) btnCancel.textContent = cancelText;

      // Show modal
      modal.showModal();

      // Handlers
      const cleanup = () => {
        modal.close();
        btnConfirm?.removeEventListener('click', onConfirm);
        btnCancel?.removeEventListener('click', onCancel);
        modal?.removeEventListener('close', onClose);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onClose = () => { cleanup(); resolve(false); };

      btnConfirm?.addEventListener('click', onConfirm);
      btnCancel?.addEventListener('click', onCancel);
      modal?.addEventListener('close', onClose);
    });
  };

  /**
   * Unified page state manager.
   * Toggles between loading, content, empty, and error states.
   * Backward-compatible: existing `setPageState(ui, { loading, empty })` calls work unchanged.
   *
   * @param {Object} ui - { loadingState, moduleContent, emptyState, errorState? }
   * @param {Object} [opts] - { loading, empty, error, timeoutMs }
   * @returns {{ cancel: Function }} controller for timeout cleanup
   */
  const setPageState = (ui, { loading = false, empty = false, error = false, timeoutMs = 15000 } = {}) => {
    if (!ui) return { cancel() {} };

    const loader = ui.loadingState || ui.pageCardLoading;
    const content = ui.moduleContent || ui.contentWrap;
    const emptyEl = ui.emptyState || ui.pageCardEmpty;
    const errorEl = ui.errorState;

    // Toggle BOTH is-visible AND hidden for compat with all patterns
    const showEl = (el) => {
      if (!el) return;
      el.classList.add('is-visible');
      el.classList.remove('hidden');
    };
    const hideEl = (el) => {
      if (!el) return;
      el.classList.remove('is-visible');
      el.classList.add('hidden');
    };

    // Loading
    loading ? showEl(loader) : hideEl(loader);

    // Content — visible only when none of loading/empty/error
    (loading || empty || error) ? hideEl(content) : showEl(content);

    // Empty — visible only when empty AND not loading/error
    if (emptyEl) {
      (empty && !loading && !error) ? showEl(emptyEl) : hideEl(emptyEl);
      emptyEl.classList.toggle('is-error', error && !errorEl);
    }

    // Error — dedicated element or fallback to emptyState with is-error class
    if (errorEl) {
      (error && !loading) ? showEl(errorEl) : hideEl(errorEl);
    }

    // Auto-timeout safety net (warn-only — does NOT hide content)
    if (!window.__uiTimers) window.__uiTimers = new WeakMap();
    
    if (window.__uiTimers.has(ui)) {
      clearTimeout(window.__uiTimers.get(ui));
      window.__uiTimers.delete(ui);
    }

    let timer = null;
    if (loading && timeoutMs > 0) {
      timer = setTimeout(() => {
        console.warn(`[setPageState] Loading exceeded ${timeoutMs}ms — possible leak. UI NOT hidden to prevent black-screen.`);
      }, timeoutMs);
      window.__uiTimers.set(ui, timer);
    }

    return {
      cancel() { 
        if (timer) clearTimeout(timer); 
        if (window.__uiTimers.has(ui)) window.__uiTimers.delete(ui);
      }
    };
  };

  /**
   * Wraps an async function with automatic loading/content/empty/error transitions.
   * Includes generation counter for race protection (stale calls are discarded).
   *
   * @param {Object} ui - { loadingState, moduleContent, emptyState, errorState? }
   * @param {Function} fn - async (signal) => 'empty' | void. Throw → error state.
   * @param {Object} [opts] - { timeoutMs? }
   */
  const withLoader = (() => {
    const generationMap = new WeakMap();

    return async function withLoader(ui, fn, { timeoutMs = 15000 } = {}) {
      if (!ui) return;
      const gen = (generationMap.get(ui) || 0) + 1;
      generationMap.set(ui, gen);

      const ctrl = setPageState(ui, { loading: true, timeoutMs });
      const ac = new AbortController();

      try {
        const result = await fn(ac.signal);
        if (generationMap.get(ui) !== gen) return; // stale
        ctrl.cancel();
        if (result === 'empty') {
          setPageState(ui, { empty: true });
        } else {
          setPageState(ui, {});
        }
      } catch (err) {
        if (generationMap.get(ui) !== gen) return;
        ctrl.cancel();
        if (err.name === 'AbortError') return;
        console.error('[withLoader]', err);
        setPageState(ui, { error: true });
        window.Toast?.error?.(err.message || 'Error cargando datos');
      }
    };
  })();

  const renderStatusBadge = (statusUI) => {
    const styling = window.Constants?.STYLING?.STATUS_CLASSES || {
      pendiente: "status-warning",
      enviado: "status-info",
      aprobado: "status-success",
      recibido: "status-success",
      ready_for_approval: "status-warning",
      draft: "status-info",
    };

    const className = styling[statusUI] || "status-neutral";
    const label = String(statusUI || "UNKNOWN").toUpperCase().replace(/_/g, ' ');

    return `<span class="status-pill ${className}">${label}</span>`;
  };

  /**
   * Promise-based alert modal (informational, single OK button)
   * @param {string} message - The message to display
   * @param {string} [title] - Optional title
   * @returns {Promise<void>}
   */
  const alertModal = (message, title) => {
    return new Promise((resolve) => {
      let modal = document.getElementById('alertModal');

      if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'alertModal';
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content">
            <h3 id="alert-title" class="modal-title" style="margin-bottom:8px;"></h3>
            <p id="alert-message" class="modal-body" style="white-space:pre-wrap;"></p>
            <div class="modal-footer">
              <button type="button" class="btn-primary" id="btn-alert-ok">OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const titleEl = modal.querySelector('#alert-title');
      const msgEl = modal.querySelector('#alert-message');
      const btnOk = modal.querySelector('#btn-alert-ok');

      if (titleEl) titleEl.textContent = title || '';
      if (titleEl) titleEl.style.display = title ? '' : 'none';
      if (msgEl) msgEl.textContent = message;

      modal.showModal();

      const cleanup = () => {
        modal.close();
        btnOk?.removeEventListener('click', onOk);
        modal?.removeEventListener('close', onClose);
      };

      const onOk = () => { cleanup(); resolve(); };
      const onClose = () => { cleanup(); resolve(); };

      btnOk?.addEventListener('click', onOk);
      modal?.addEventListener('close', onClose);
    });
  };

  /**
   * Promise-based prompt modal (text input)
   * @param {string} message - The prompt label
   * @param {object} [options] - { placeholder, defaultValue, confirmText, cancelText }
   * @returns {Promise<string|null>} - entered text or null if cancelled
   */
  const promptModal = (message, options = {}) => {
    return new Promise((resolve) => {
      const { placeholder = '', defaultValue = '', confirmText = 'Aceptar', cancelText = 'Cancelar' } = options;

      let modal = document.getElementById('promptModal');
      if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'promptModal';
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content">
            <p id="prompt-message" class="modal-body"></p>
            <input type="text" id="prompt-input" class="input" style="width:100%;margin:8px 0 16px;" />
            <div class="modal-footer">
              <button type="button" class="btn-ghost" id="btn-prompt-cancel">Cancelar</button>
              <button type="button" class="btn-primary" id="btn-prompt-ok">Aceptar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const msgEl = modal.querySelector('#prompt-message');
      const inputEl = modal.querySelector('#prompt-input');
      const btnOk = modal.querySelector('#btn-prompt-ok');
      const btnCancel = modal.querySelector('#btn-prompt-cancel');

      if (msgEl) msgEl.textContent = message;
      if (inputEl) { inputEl.value = defaultValue; inputEl.placeholder = placeholder; }
      if (btnOk) btnOk.textContent = confirmText;
      if (btnCancel) btnCancel.textContent = cancelText;

      modal.showModal();
      inputEl?.focus();

      const cleanup = () => {
        modal.close();
        btnOk?.removeEventListener('click', onOk);
        btnCancel?.removeEventListener('click', onCancel);
        modal?.removeEventListener('close', onClose);
        inputEl?.removeEventListener('keydown', onKey);
      };

      const onOk = () => { const val = inputEl?.value?.trim(); cleanup(); resolve(val || null); };
      const onCancel = () => { cleanup(); resolve(null); };
      const onClose = () => { cleanup(); resolve(null); };
      const onKey = (e) => { if (e.key === 'Enter') onOk(); };

      btnOk?.addEventListener('click', onOk);
      btnCancel?.addEventListener('click', onCancel);
      modal?.addEventListener('close', onClose);
      inputEl?.addEventListener('keydown', onKey);
    });
  };

  /**
   * Read a CSS custom property from :root
   * @param {string} varName - CSS variable name (e.g. '--color-danger')
   * @param {string} [fallback] - Fallback value if variable is empty
   * @returns {string}
   */
  const getThemeColor = (varName, fallback = '') => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
  };

  /**
   * Standard chart color palette (10 colors)
   * Used by Chart.js instances across all modules
   */
  const CHART_COLORS = [
    '#ff3b30', '#ff9500', '#34c759', '#007aff', '#5856d6',
    '#ff2d55', '#af52de', '#5ac8fa', '#ffcc00', '#30d158'
  ];

  /**
   * Returns chart colors resolved from CSS theme variables with fallbacks
   * @param {number} [count=5] - Number of colors to return
   * @returns {string[]}
   */
  const getChartColors = (count = 5) => {
    const vars = [
      ['--color-danger',  '#ff3b30'],
      ['--color-warning', '#ff9500'],
      ['--color-success', '#34c759'],
      ['--color-info',    '#007aff'],
      ['--color-primary', '#5856d6'],
    ];
    const colors = vars.map(([v, fb]) => getThemeColor(v, fb));
    // Extend with CHART_COLORS if more are needed
    while (colors.length < count) {
      colors.push(CHART_COLORS[colors.length % CHART_COLORS.length]);
    }
    return colors.slice(0, count);
  };

  window.Utils = {
    debounce,
    numberOrNull,
    assertSbOrShowBlockingError,
    calcReplenishment,
    mapSolicitudEstadoUI,
    formatARS,
    generateUUID,
    hide,
    show,
    isHidden,
    escapeHtml,
    confirmAction,
    confirmModal: confirmAction,   // Alias used by cms-members, admin-pagos, etc.
    alertModal,                    // Informational dialog
    promptModal,                   // Text input dialog
    renderStatusBadge,
    setPageState,
    withLoader,
    openModal,
    getThemeColor,
    CHART_COLORS,
    getChartColors,
  };
})();

