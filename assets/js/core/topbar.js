/**
 * topbar.js — Global topbar dropdown handler
 * @module core/topbar
 *
 * Unified dropdown behavior for ALL pages via event delegation.
 * Replaces duplicated dropdown logic in 6+ module-specific JS files.
 *
 * HTML contract:
 *   .dropdown-container > button (trigger) + .dropdown-menu.hidden
 *
 * IDs handled:
 *   #btn-notifications -> #notifications-menu
 *   #user-avatar       -> #user-menu
 */
(function () {
  'use strict';

  var HIDDEN = 'hidden';

  /** Close every open dropdown and sync aria-expanded */
  function closeAll() {
    document.querySelectorAll('.dropdown-menu').forEach(function (menu) {
      menu.classList.add(HIDDEN);
    });
    document.querySelectorAll('.dropdown-container > button').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  /** Toggle one dropdown; close all others first */
  function toggleDropdown(trigger) {
    var container = trigger.closest('.dropdown-container');
    if (!container) return;
    var menu = container.querySelector('.dropdown-menu');
    if (!menu) return;

    var wasHidden = menu.classList.contains(HIDDEN);
    closeAll();

    if (wasHidden) {
      menu.classList.remove(HIDDEN);
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  // -- Event delegation (document level) --

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.dropdown-container > button');

    if (trigger) {
      toggleDropdown(trigger);
      return;
    }

    // Click inside an open menu — let links/buttons work naturally
    if (e.target.closest('.dropdown-menu')) return;

    // Click anywhere else — close all
    closeAll();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();
