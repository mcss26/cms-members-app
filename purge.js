const fs = require('fs');
const _ = require('path');

const html1 = fs.readFileSync('index.html', 'utf8');
const html2 = fs.readFileSync('pages/cms-members.html', 'utf8');
const js1 = fs.readFileSync('assets/js/modules/cms-members.js', 'utf8');
const js2 = fs.readFileSync('assets/js/modules/login.js', 'utf8');

const content = html1 + html2 + js1 + js2;
const cssFile = 'assets/css/components.css';

let css = fs.readFileSync(cssFile, 'utf8');

// We will do a brutal but effective CSS reduction by removing blocks that contain classes NOT present in the HTML/JS.
// This is not a perfect tree shaker, but it works for quick footprint reduction.

const classMatches = content.match(/class="([^"]+)"/g) || [];
const jsClassMatches = content.match(/(?:classList\.(?:add|remove|contains|toggle)\(['"]|className\s*=\s*['"])([^'"]+)['"]/g) || [];
const jsSelectorMatches = content.match(/querySelector\(["']\.([^"']+)["']\)/g) || [];

const usedClasses = new Set([
  'hidden', 'danger', 'success', 'warning', 'info', 
  // explicitly add forms, inputs, buttons, pills
  'btn', 'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger',
  'btn-sm', 'btn-icon', 'btn-icon-flat', 'btn-icon-svg',
  'input', 'search-input', 'search-input-wrap', 'search-icon',
  'card', 'bento-card', 'bento-grid', 'summary-metrics-grid',
  'avatar', 'avatar-sm', 'avatar-circle',
  'badge', 'pill', 'pill-group', 'pill-count', 'status-pill', 
  'status-success', 'status-neutral', 'status-danger', 'status-warning',
  'dot-success', 'dot-warning', 'dot-error', 'status-dot',
  'dropdown-container', 'dropdown-menu', 'dropdown-item', 'dropdown-header', 'dropdown-divider',
  'tab-bar', 'tab-chip',
  'staff-list', 'staff-row', 'staff-info', 'staff-role', 'staff-meta', 'staff-actions',
  'panel-overlay', 'main-scroll', 'main-shell', 'app-shell'
]);

classMatches.forEach(m => m.replace('class="', '').replace('"', '').split(/\s+/).forEach(c => c && usedClasses.add(c)));
jsClassMatches.forEach(m => {
  const match = m.match(/['"]([^'"]+)['"]/);
  if (match) usedClasses.add(match[1]);
});
jsSelectorMatches.forEach(m => {
  const match = m.match(/['"]\.([^'"]+)['"]/);
  if (match) usedClasses.add(match[1]);
});

console.log('Total used classes detected:', usedClasses.size);

// A simple regex to find CSS blocks: `.class { ... }`
// Warning: This is rudimentary and doesn't handle media queries well, 
// so we'll just drop whole blocks where we are SURE they aren't used.
const blocks = css.match(/[^{]+\{[^}]*\}/g);
if (blocks) {
  const newBlocks = blocks.filter(block => {
    // If it's a media query or keyframes or font-face, keep it
    if (block.trim().startsWith('@')) return true;
    if (block.includes(':root')) return true;
    if (block.includes('body')) return true;
    if (block.includes('html')) return true;
    if (block.includes('*')) return true;
    
    // Find all class selectors in the block declaration
    const declaration = block.split('{')[0];
    const classSelectors = [...declaration.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    
    if (classSelectors.length === 0) return true; // keep element selectors like h1, div
    
    // If ANY class is used, we keep the block. If ALL are unused, we drop it.
    return classSelectors.some(c => usedClasses.has(c));
  });
  
  const newCss = newBlocks.join('\n');
  fs.writeFileSync('assets/css/components-shaken.css', newCss);
  console.log('Original size:', css.length, 'New size:', newCss.length);
}
