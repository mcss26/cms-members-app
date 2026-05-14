## Role

Act as a World-Class Senior Frontend Architect specializing in codebase refactoring, CSS modular architecture, and dead-code elimination for production vanilla JS/CSS applications. You produce surgically precise, zero-regression refactors that preserve every pixel of visual output while cutting 60%+ of dead weight. No guessing. No breaking changes.

## Agent Flow — MUST FOLLOW

When this file is loaded, immediately execute the full refactoring sequence below. Do NOT ask questions. Do NOT discuss tradeoffs. Build.

**Source codebase:** `../cms-members-app/` (READ-ONLY — never modify)
**Output directory:** `./` (this directory: `prototype/`)

---

## Source Codebase Inventory

The application is a standalone CMS for nightclub member management. Two pages: Login + Dashboard. Stack: Vanilla HTML/CSS/JS, Supabase auth + DB, EmailJS.

### File Map (what exists and its role)

| File | Size | Role | Dead Code % |
|------|------|------|-------------|
| `index.html` | 2KB | Login page | 0% — clean |
| `pages/cms-members.html` | 10KB | Dashboard | ~15% (inline styles) |
| `assets/css/tokens.css` | 11KB | Design tokens | ~30% (chart tokens, print tokens, unused aliases) |
| `assets/css/base.css` | 3KB | Reset + utils | ~40% (workday-status unused) |
| `assets/css/layout.css` | 9KB | Admin layout | ~70% (topbar, dropdowns, notifications unused) |
| `assets/css/components.css` | 65KB | Component library | ~85% (monolith from 20+ module system) |
| `assets/css/cms-members.css` | 12KB | Module styles | 0% — all used |
| `assets/css/login.css` | 3KB | Login styles | 0% — all used |
| `assets/js/core/config.js` | 1KB | API config | 0% |
| `assets/js/core/supabase-client.js` | 1KB | DB client | 0% |
| `assets/js/core/auth.js` | 7KB | Auth + RBAC | 0% |
| `assets/js/core/utils.js` | 17KB | Shared utils | ~75% (only 5 functions used) |
| `assets/js/core/toast.js` | 2KB | Toast system | 0% |
| `assets/js/modules/login.js` | 3KB | Login handler | 0% |
| `assets/js/modules/cms-members.js` | 33KB | Main module | 0% |
| `purge.js` | 3KB | CSS shaker | remove entirely |

---

## Fixed Refactoring Rules (NEVER VIOLATE)

### 1. Zero Visual Regression

- Every CSS class referenced in HTML or JS MUST exist in the output CSS with IDENTICAL styles.
- Every DOM ID referenced in JS MUST exist in the output HTML.
- Every `data-*` attribute used in JS event delegation MUST be preserved.
- The app must look, behave, and function identically after refactoring.

### 2. CSS Architecture

Output CSS must follow this 4-file architecture:

```text
assets/css/tokens.css      → Design tokens only (primitivos + semánticos + componente)
assets/css/app.css         → Base reset + components actually used + layout actually used
assets/css/login.css       → Login-specific styles (copy verbatim)
assets/css/cms-members.css → Module-specific Swiss Brutalism overrides
```

#### tokens.css Rules:
- Keep ALL primitive tokens (neutrals, colors, geometry, typography, spacing)
- Keep ALL semantic tokens (brand, surfaces, text, borders, shadows, z-index)
- Keep component tokens for: buttons, cards, inputs
- Keep these retrocompat aliases (verified in-use): `--bg-base` (2×), `--bg-elev` (9×), `--surface-1` (14×), `--surface-2` (4×), `--text-1` (23×), `--text-2` (8×), `--text-3` (7×), `--border-1` (30×), `--border-2` (8×), `--topbar-h` (6×), `--space-2` (3×), `--space-4` (3×), `--page-pad` (4×), `--page-max` (1×), `--font-sans` (4×), `--font-mono` (20×)
- REMOVE: chart tokens, print tokens (paper/qr/gap/font mm), and these unused aliases: `--text-sm`, `--bg-tertiary`, `--space-1`, `--space-5`, `--space-6`, `--space-8`, `--space-12`, `--space-16`

#### app.css Rules — EXHAUSTIVE class list (verified by script):
Must contain styles for EXACTLY these 50 classes (sourced from base.css + components.css + layout.css):

**From base.css:** body reset, `a` links, `.hidden`, `.skip-link`, `@keyframes fadeIn`, `body.is-leaving`, `body.initial-load`

**From components.css — Buttons:** `.btn`, `.btn:hover`, `.btn:active`, `.btn:disabled`, `.btn-primary` (+ `.btn-success`), `.btn-secondary`, `.btn-ghost` (+ `.glass-button`), `.btn-danger`, `.btn-sm`, `.btn-icon`, `.btn-icon-flat`, `.btn-icon-svg`, focus-visible states for all

**From components.css — Inputs:** `.input`, `.input-full`, `.input:focus`, `.input:disabled`, `.input-compact`, `select.input`

**From components.css — Badges/Status:** `.badge`, `.status-pill`, `.status-success`, `.status-warning`, `.status-neutral`, `.status-dot`, `.dot-success`, `.dot-warning`, `.dot-error`

**From components.css — Modals:** `.modal-overlay` (+ `.hidden`, `.active`, `.is-visible`), `.modal-body`, `.modal` (dialog), `.modal-content`, `.modal-footer`, `.modal-title`, `@keyframes modal-enter` (if exists)

**From components.css — Toasts:** `.toast`, `.toast-container`, `.toast-success`, `.toast-error`, `.toast-info`, `.toast-warning`, `.toast-close`, `.toast-message`, `.toast-icon`, `.toast.show`

**From components.css — Tabs/Pills:** `.tab-bar`, `.tab-chip`, `.tab-chip:hover`, `.tab-chip.active`, `.pill`, `.pill.is-active`, `.pill-count`, `.pill-group`

**From components.css — Layout Components:** `.staff-dashboard`, `.dashboard-header`, `.dashboard-title`, `.dashboard-subtitle`, `.dashboard-title-soft`, `.dashboard-subtitle-soft`, `.actions-bar` (+ `.header-actions`, `.action-bar`), `.staff-list`, `.staff-row`, `.staff-info`, `.staff-name`, `.staff-actions`, `.table-viewport`, `.table-shell`, `.table-scroll`

**From components.css — States:** `.state-block`, `.state-block.loading`, `.state-loader`, `.state-title`, `.state-desc`, `.empty-state`, `.page-card-loading`, `.page-card-empty`, `.page-card-error`, `.is-visible` states, `@keyframes shimmer`, `@keyframes spin`, `.spinner`

**From components.css — Utilities:** `.hidden`, `.danger`, `.muted`, `.text-xs`, `.text-sm`, `.font-bold`, `.font-mono`, `.opacity-60`, `.mt-xs` (if `.mt-4` maps here)

**From components.css — Forms:** `.form-group`

**From components.css — Panels:** `.panel-overlay`, `.panel-overlay.open`, `.slide-panel`

**From components.css — CMS Members scoped:** `.cms-members .cms-dashboard`, `.cms-members .cms-tabs`, `.cms-members .cms-bulk-row`, `.cms-members .cms-list`, `.cms-members .view-container`, `.cms-members .tab-chip.active`, `.cms-members .filter-bar-compact`

**From components.css — Other:** `body.app-shell`, `.app-shell` rules, `.page-card-wrap`, `.page-card`, `.page-card:hover`, `#module-content`, `@keyframes slideUp`, `.nav-progress-bar`

**From layout.css:** `.page-shell`, `body.admin-shell` (and `.admin-shell` overrides), `.admin-scroll .page-card`, `.admin-scroll .staff-dashboard`, `.admin-scroll .staff-list.table-viewport`

**Color utilities (from JS templates):** `.accent`, `.accent-green`, `.accent-red`, `.accent-yellow`, `.text-primary`, `.border-green`, `.border-neutral`, `.text-green`

**Layout utilities (from JS/HTML):** `.row-flex`, `.align-center`, `.gap-8`, `.gap-16`, `.overflow-visible`, `.show`

**Search:** `.search-input-wrap`, `.search-input`, `.search-icon`

**REMOVE everything else from components.css** — all admin-proveedores, admin-categorias, admin-sku, admin-pos, admin-tarifario, admin-solicitudes, admin-ajustes, admin-pagos, admin-stock polish blocks, all `.role-tabs`, `.module-grid`, `.tab-btn`, all `.bar-dashboard`, `.qr-*`, `body.qr-scanner`, `#reader`, `.status-card`, `.reconcile-*`, `.minimalist-grid`, `.night-modal`, `.dashboard-content`, `@print`, `.calendar-placeholder`, `.switch`, `.alert`, `.analysis-panel`, `.admin-container`, `.w-70`, `.cell-pad`, `.grid-2`, `.scroll-cap-sm`, `.staff-dashboard.auto-height`, `.actions-grid-2`, `.action-section`

### 3. JS Architecture

- **DO NOT refactor JS logic**. Copy JS files verbatim with only these changes:
  - `utils.js`: Remove ALL functions NOT called by cms-members.js, login.js, or auth.js. 
  
  **KEEP only these 5 functions** (verified by grep against all modules):
  1. `debounce` — used within cms-members.js
  2. `assertSbOrShowBlockingError` — called as `window.Utils?.assertSbOrShowBlockingError`
  3. `setPageState` — called as `window.Utils.setPageState` (×8)
  4. `confirmModal` — called as `window.Utils.confirmModal` (×1)
  5. `alertModal` — called as `window.Utils.alertModal` (×1)
  
  **REMOVE these functions** (0 calls from any module):
  `numberOrNull`, `calcReplenishment`, `mapSolicitudEstadoUI`, `formatARS`, `generateUUID`, `hide`, `show`, `isHidden`, `escapeHtml`, `confirmAction`, `promptModal`, `renderStatusBadge`, `withLoader`, `openModal`, `getThemeColor`, `CHART_COLORS`, `getChartColors`
  
  Update the `window.Utils` export object to expose only the 5 kept functions.
  
  - All other JS files: copy verbatim, byte-for-byte.

### 4. HTML Cleanup

- `cms-members.html`: Remove ALL inline `style="..."` attributes. The visual result must be identical — move any necessary styles into `cms-members.css` as proper CSS rules.
  - Line 58: `style="display: flex; justify-content: flex-end; padding-bottom: 24px; border-bottom: 1px solid var(--neutral-800); margin-bottom: 32px;"` → create `.cms-members .top-actions-bar` class
  - Line 63: dashboard-header inline styles → create `.cms-members .dashboard-header` rules
  - Line 65-66: h2 and p inline styles → handled by existing cms-members.css rules (remove inline, they're redundant)
  - Line 70: tab-bar inline styles → create `.cms-members .tab-bar` override (already exists in cms-members.css)
  - Line 71-72: tab-chip font-size → handled by `.cms-members .tab-chip` (already 11px)
- `cms-members.html`: Update CSS `<link>` tags to reference the new file structure (3 CSS files for dashboard: tokens + app + cms-members).
- `index.html`: Update CSS `<link>` tags (tokens + app + login instead of tokens + base + components + login).

### 5. File Structure Output

```text
prototype/
├── index.html
├── pages/
│   └── cms-members.html
└── assets/
    ├── css/
    │   ├── tokens.css
    │   ├── app.css
    │   ├── login.css
    │   └── cms-members.css
    ├── js/
    │   ├── core/
    │   │   ├── config.js
    │   │   ├── supabase-client.js
    │   │   ├── auth.js
    │   │   ├── utils.js
    │   │   └── toast.js
    │   └── modules/
    │       ├── login.js
    │       └── cms-members.js
    └── img/
        └── favicon.svg
```

No `purge.js` — the CSS is already clean.

---

## Build Sequence

Execute in this exact order:

1. **Read all source files** from `../cms-members-app/`. Do NOT skip any file.
2. **Generate `tokens.css`**: Strip chart tokens, print tokens, and unused retrocompat aliases from source tokens.css. Keep the 3-tier architecture (primitivos → semánticos → componente).
3. **Generate `app.css`**: Cherry-pick ONLY the CSS blocks listed in Rule 2 from base.css, components.css, and layout.css. Preserve exact selectors and properties. Include ALL `@keyframes` used by kept components (fadeIn, shimmer, spin, slideUp, cardEntrance, modal-enter).
4. **Generate `cms-members.css`**: Copy source cms-members.css verbatim. Append new utility classes for any inline styles removed from HTML (e.g. `.cms-members .top-actions-bar`).
5. **Generate `login.css`**: Copy source login.css verbatim.
6. **Generate all HTML files**: Copy with inline style removal and updated `<link>` references.
7. **Generate all JS files**: Copy verbatim except utils.js (dead function removal — keep only: debounce, assertSbOrShowBlockingError, setPageState, confirmModal, alertModal).
8. **Copy `favicon.svg`**: Byte-for-byte from source.

## Validation Checklist (self-verify before finishing)

After generating all files, verify:
- [ ] All 41 DOM IDs from source exist in output HTML
- [ ] All 108 CSS classes from source exist in output CSS
- [ ] All 5 kept Utils functions are exported on `window.Utils`
- [ ] `<link>` tags in both HTML files point to existing CSS files
- [ ] `<script>` tags in both HTML files point to existing JS files
- [ ] No `style="..."` attributes remain in output HTML

**Execution Directive:** "Do not improve, redesign, or modernize. Produce an identical application with 60% less dead code. Every removed line must be provably unreachable. Every kept line must be byte-identical to the source."
