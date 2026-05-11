/**
 * @module dashboard
 * @description SPA tab-switching shell for the Services Dashboard.
 *
 * Manages sidebar navigation: highlights the active tab button and
 * shows/hides the corresponding panel. Also invalidates the Leaflet
 * map size whenever the map panel is re-activated so tiles render
 * correctly after the container was previously hidden.
 */

'use strict';

(function () {

  /**
   * @description Activates the panel whose id === 'panel-' + panelId and
   *              deactivates all others. Updates sidebar item active states.
   *
   * @param {string} panelId - One of: 'map' | 'news' | 'media' | 'clock'
   * @returns {void}
   */
  function switchPanel(panelId) {
    // Sidebar items
    document.querySelectorAll('.sidebar__item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.panel === panelId);
    });

    // Content panels
    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + panelId);
    });

    // Leaflet needs invalidateSize() whenever its container re-appears
    if (panelId === 'map' && window.dashMap) {
      setTimeout(function () { window.dashMap.invalidateSize(); }, 60);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Wire up each sidebar button
    document.querySelectorAll('.sidebar__item').forEach(function (item) {
      item.addEventListener('click', function () {
        switchPanel(item.dataset.panel);
      });
    });

    // Default: open map tab
    switchPanel('map');
  });

})();
