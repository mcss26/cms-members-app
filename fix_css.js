const fs = require('fs');

function parseCssBlocks(css) {
    const blocks = [];
    let currentBlock = '';
    let depth = 0;
    let i = 0;

    // Remove comments to simplify parsing
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    while (i < css.length) {
        const char = css[i];
        
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                currentBlock += char;
                blocks.push(currentBlock.trim());
                currentBlock = '';
                i++;
                continue;
            }
        }
        
        if (depth === 0 && char.trim() === '' && currentBlock.trim() === '') {
            // skip leading whitespace for new blocks
        } else {
            currentBlock += char;
        }
        i++;
    }
    
    // Some lines might be orphaned (e.g. variables outside blocks, though in CSS they are usually inside :root)
    return blocks;
}

function processCssFiles() {
    const srcDir = 'c:/Users/siste/Documents/Members/cms-members-app';
    const outDir = 'c:/Users/siste/Documents/Members/protoype';

    function read(src) {
        return fs.readFileSync(srcDir + '/' + src, 'utf8');
    }

    const allowedClasses = [
        'hidden', 'skip-link', 'is-leaving', 'initial-load',
        'btn', 'btn:hover', 'btn:active', 'btn:disabled', 'btn-primary', 'btn-success', 'btn-secondary', 'btn-ghost', 'glass-button', 'btn-danger', 'btn-sm', 'btn-icon', 'btn-icon-flat', 'btn-icon-svg',
        'input', 'input-full', 'input:focus', 'input:disabled', 'input-compact', 'select.input',
        'badge', 'status-pill', 'status-success', 'status-warning', 'status-neutral', 'status-dot', 'dot-success', 'dot-warning', 'dot-error',
        'modal-overlay', 'modal-body', 'modal', 'modal-content', 'modal-footer', 'modal-title',
        'toast', 'toast-container', 'toast-success', 'toast-error', 'toast-info', 'toast-warning', 'toast-close', 'toast-message', 'toast-icon', 'toast.show',
        'tab-bar', 'tab-chip', 'tab-chip:hover', 'tab-chip.active', 'pill', 'pill.is-active', 'pill-count', 'pill-group',
        'staff-dashboard', 'dashboard-header', 'dashboard-title', 'dashboard-subtitle', 'dashboard-title-soft', 'dashboard-subtitle-soft', 'actions-bar', 'header-actions', 'action-bar', 'staff-list', 'staff-row', 'staff-info', 'staff-name', 'staff-actions', 'table-viewport', 'table-shell', 'table-scroll',
        'state-block', 'state-block.loading', 'state-loader', 'state-title', 'state-desc', 'empty-state', 'page-card-loading', 'page-card-empty', 'page-card-error', 'is-visible', 'spinner',
        'danger', 'muted', 'text-xs', 'text-sm', 'font-bold', 'font-mono', 'opacity-60', 'mt-xs', 'mt-4',
        'form-group',
        'panel-overlay', 'panel-overlay.open', 'slide-panel',
        'cms-members .cms-dashboard', 'cms-members .cms-tabs', 'cms-members .cms-bulk-row', 'cms-members .cms-list', 'cms-members .view-container', 'cms-members .tab-chip.active', 'cms-members .filter-bar-compact',
        'app-shell', 'page-card-wrap', 'page-card', 'page-card:hover', '#module-content', 'nav-progress-bar',
        'page-shell', 'admin-shell', 'admin-scroll .page-card', 'admin-scroll .staff-dashboard', 'admin-scroll .staff-list.table-viewport',
        'accent', 'accent-green', 'accent-red', 'accent-yellow', 'text-primary', 'border-green', 'border-neutral', 'text-green',
        'row-flex', 'align-center', 'gap-8', 'gap-16', 'overflow-visible', 'show',
        'search-input-wrap', 'search-input', 'search-icon'
    ];

    let appCss = "/* app.css - Fixed auto-generated subset */\n\n";

    // Re-extract base
    const baseCss = read('assets/css/base.css');
    const baseBlocks = parseCssBlocks(baseCss);
    baseBlocks.forEach(b => {
        if (b.includes('body {') || b.includes('body.initial-load') || b.includes('body.is-leaving') || b.includes('body,') || b.includes('* {') || b.includes('*,') || b.includes('a {') || b.includes('a:') || b.includes('.hidden') || b.includes('.skip-link') || b.startsWith('@keyframes fadeIn')) {
            appCss += b + "\n\n";
        }
    });

    const comps = read('assets/css/components.css');
    const compBlocks = parseCssBlocks(comps);
    
    compBlocks.forEach(block => {
        const firstLine = block.split('{')[0].trim();
        
        if (firstLine.startsWith('@keyframes')) {
            if (firstLine.includes('fadeIn') || firstLine.includes('shimmer') || firstLine.includes('spin') || firstLine.includes('slideUp') || firstLine.includes('cardEntrance') || firstLine.includes('modal-enter')) {
                appCss += block + "\n\n";
            }
            return;
        }

        if (firstLine.startsWith('@media')) {
            // Need to see if inner blocks match our selectors.
            // For simplicity, we just keep media queries that contain allowed classes.
            // But since components.css has many complex media queries, let's keep it if any allowed class is inside.
            let keep = false;
            allowedClasses.forEach(c => {
                if (block.includes('.' + c + ' ') || block.includes('.' + c + '{') || block.includes('.' + c + ',') || block.includes('.' + c + ':')) {
                    keep = true;
                }
            });
            if (keep) {
                appCss += block + "\n\n";
            }
            return;
        }

        const selectors = firstLine.split(',').map(s => s.trim());
        const shouldKeep = selectors.some(sel => {
            return allowedClasses.some(a => {
                return sel === '.' + a || sel === '#' + a || sel === a || sel.includes('.' + a + ' ') || sel.includes('.' + a + ':');
            });
        });

        if (shouldKeep) {
            const blocked = ['admin-proveedores', 'admin-categorias', 'admin-sku', 'admin-pos', 'admin-tarifario', 'admin-solicitudes', 'admin-ajustes', 'admin-pagos', 'admin-stock', 'role-tabs', 'module-grid', 'tab-btn', 'bar-dashboard', 'qr-', 'status-card', 'reconcile-', 'minimalist-grid', 'night-modal', 'dashboard-content', 'calendar-placeholder', 'switch', 'alert', 'analysis-panel', 'admin-container', 'w-70', 'cell-pad', 'grid-2', 'scroll-cap-sm', 'actions-grid-2', 'action-section'];
            const isBlocked = blocked.some(b => firstLine.includes('.' + b));
            if (!isBlocked) {
                appCss += block + "\n\n";
            }
        }
    });

    const lay = read('assets/css/layout.css');
    const layBlocks = parseCssBlocks(lay);
    layBlocks.forEach(block => {
        const firstLine = block.split('{')[0].trim();
        
        if (firstLine.startsWith('@media')) {
            let keep = false;
            allowedClasses.forEach(c => {
                if (block.includes('.' + c + ' ') || block.includes('.' + c + '{') || block.includes('.' + c + ',') || block.includes('.' + c + ':')) {
                    keep = true;
                }
            });
            if (keep) appCss += block + "\n\n";
            return;
        }

        const selectors = firstLine.split(',').map(s => s.trim());
        const shouldKeep = selectors.some(sel => {
            return allowedClasses.some(a => {
                return sel === '.' + a || sel === '#' + a || sel === a || sel.includes('.' + a + ' ') || sel.includes('.' + a + ':');
            });
        });

        if (shouldKeep) {
            appCss += block + "\n\n";
        }
    });

    fs.writeFileSync(outDir + '/assets/css/app.css', appCss);
    console.log("Successfully fixed app.css with proper block parsing.");
}

processCssFiles();
