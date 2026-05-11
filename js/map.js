/**
 * @module map
 * @description Geospatial Intelligence module.
 *
 * Initialises an interactive Leaflet map powered by OpenStreetMap tiles.
 * Geocoding is performed via the MapQuest API when a valid key is present in
 * config.js; otherwise the module automatically falls back to the free
 * Nominatim API so the feature works out-of-the-box during development.
 *
 * Flow:
 *  1. DOMContentLoaded → initMap()
 *  2. User types location and clicks Search → handleMapSearch()
 *  3. handleMapSearch() calls geocodeLocation() via fetch() + async/await
 *  4. On success, flyToLocation() animates the map and drops a pulsing marker
 */

'use strict';

/* ---- Module-level state ---------------------------------------- */
let map;           // Leaflet map instance
let activeMarker;  // Currently displayed marker

/* ================================================================
   PUBLIC API
================================================================ */

/**
 * @description Initialises the Leaflet map centered on the world view.
 *              Attaches OpenStreetMap tiles (no API key required).
 * @returns {void}
 */
function initMap() {
  map = L.map('mapContainer', {
    center: [18.1096, -77.2975], // Jamaica
    zoom: 9,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  // Expose instance so dashboard.js can call invalidateSize() on tab switch
  window.dashMap = map;
}

/* ================================================================
   GEOCODING
================================================================ */

/**
 * @description Converts a human-readable location string into geographic
 *              coordinates using the MapQuest Geocoding API.
 *              Automatically falls back to the Nominatim API when the
 *              MapQuest key has not yet been configured.
 *
 * @param {string} query - The location string to geocode
 *                         (e.g. "Seven Mile Beach, Negril").
 * @returns {Promise<{ lat: number, lng: number, label: string }>}
 *          Resolves to an object containing latitude, longitude, and a
 *          human-readable display label.
 * @throws {Error} When the location cannot be found or the network request fails.
 */
async function geocodeLocation(query) {
  const key = CONFIG.MAPQUEST_KEY;
  const hasKey = key && !key.includes('YOUR_');

  if (hasKey) {
    return geocodeWithMapQuest(query, key);
  }

  // No key configured — use the free Nominatim API
  return geocodeWithNominatim(query);
}

/**
 * @description Geocodes a location using the MapQuest Geocoding API.
 *
 * @param {string} query   - The address/place name to geocode.
 * @param {string} apiKey  - A valid MapQuest API key.
 * @returns {Promise<{ lat: number, lng: number, label: string }>}
 * @throws {Error} On non-2xx HTTP status or missing result.
 */
async function geocodeWithMapQuest(query, apiKey) {
  const url =
    `${CONFIG.ENDPOINTS.MAPQUEST_GEOCODE}` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&location=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MapQuest error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const location = data.results?.[0]?.locations?.[0];

  if (!location || (location.latLng.lat === 0 && location.latLng.lng === 0)) {
    throw new Error(`Location not found: "${query}"`);
  }

  return {
    lat:   location.latLng.lat,
    lng:   location.latLng.lng,
    label: location.adminArea5
      ? `${location.adminArea5}, ${location.adminArea1}`
      : query,
  };
}

/**
 * @description Geocodes a location using the Nominatim Open API (no key required).
 *              Used automatically when the MapQuest key is not yet configured.
 *
 * @param {string} query - The address/place name to geocode.
 * @returns {Promise<{ lat: number, lng: number, label: string }>}
 * @throws {Error} On network failure or when no matching location is found.
 */
async function geocodeWithNominatim(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en-US,en' },
  });

  if (!response.ok) {
    throw new Error(`Geocoding error ${response.status}`);
  }

  const results = await response.json();
  if (!results.length) {
    throw new Error(`Location not found: "${query}"`);
  }

  return {
    lat:   parseFloat(results[0].lat),
    lng:   parseFloat(results[0].lon),
    label: results[0].display_name,
  };
}

/* ================================================================
   MAP INTERACTIONS
================================================================ */

/**
 * @description Animates the map to the specified coordinates and places a
 *              custom pulsing marker with an info popup.
 *
 * @param {number} lat   - Target latitude.
 * @param {number} lng   - Target longitude.
 * @param {string} label - Text to display inside the marker popup.
 * @returns {void}
 */
function flyToLocation(lat, lng, label) {
  if (activeMarker) activeMarker.remove();

  // ── Pin icon (teardrop shape via CSS) ───────────────────────
  const pinIcon = L.divIcon({
    className: '',
    html: '<div class="map-pin">' +
            '<div class="map-pin__ring"></div>' +
            '<div class="map-pin__body"></div>' +
            '<div class="map-pin__shadow"></div>' +
          '</div>',
    iconSize:    [36, 50],
    iconAnchor:  [18, 50],
    popupAnchor: [0, -54],
  });

  // ── Popup built with safe DOM methods (no innerHTML for user data) ──
  const shortLabel = label.length > 80 ? label.slice(0, 78) + '…' : label;

  const popupEl = document.createElement('div');
  popupEl.className = 'map-popup';

  const nameRow = document.createElement('div');
  nameRow.className = 'map-popup__name';
  const nameIcon = document.createElement('i');
  nameIcon.className = 'fa fa-location-dot';
  nameIcon.setAttribute('aria-hidden', 'true');
  const nameText = document.createElement('span');
  nameText.textContent = shortLabel;
  nameRow.append(nameIcon, nameText);

  const coords = document.createElement('div');
  coords.className = 'map-popup__coords';
  coords.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);

  popupEl.append(nameRow, coords);

  // ── Place marker and fly ─────────────────────────────────────
  activeMarker = L.marker([lat, lng], { icon: pinIcon })
    .addTo(map)
    .bindPopup(popupEl, { maxWidth: 280, className: 'map-leaflet-popup' })
    .openPopup();

  map.flyTo([lat, lng], 13, { animate: true, duration: 1.6 });
}

/* ================================================================
   STATUS BAR
================================================================ */

/**
 * @description Updates the map status bar below the search field.
 *
 * @param {string} message              - The message to display.
 * @param {'success'|'error'|''} type   - Controls the text colour class.
 * @returns {void}
 */
function setMapStatus(message, type) {
  const el = document.getElementById('mapStatus');
  el.textContent = message;
  el.className = `map-status ${type}`;
}

/* ================================================================
   SEARCH HANDLER
================================================================ */

/**
 * @description Handles the full search flow: reads the input value,
 *              calls the geocoder, and updates the map and status bar.
 *              Uses ES6 async/await for clean asynchronous control flow.
 *
 * @returns {Promise<void>}
 */
async function handleMapSearch() {
  const input  = document.getElementById('mapSearchInput');
  const button = document.getElementById('mapSearchBtn');
  const query  = input.value.trim();

  if (!query) {
    setMapStatus('Please enter a location to search.', 'error');
    return;
  }

  // Scope all searches to Jamaica
  const jamaicaQuery = query.toLowerCase().includes('jamaica')
    ? query
    : `${query}, Jamaica`;

  setMapStatus('Searching…', '');
  button.disabled = true;

  try {
    const { lat, lng, label } = await geocodeLocation(jamaicaQuery);
    flyToLocation(lat, lng, label);
    setMapStatus(`📍 Found: ${label}`, 'success');
  } catch (err) {
    setMapStatus(`⚠ ${err.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

/* ================================================================
   SUGGESTIONS — Nominatim autocomplete scoped to Jamaica
================================================================ */

let _suggestTimer = null;

/**
 * @description Queries Nominatim for places in Jamaica (countrycodes=jm).
 * @param {string} query - Partial text typed by the user.
 * @returns {Promise<Array<Object>>} Nominatim result objects, or [] on error.
 */
async function fetchSuggestions(query) {
  const url =
    'https://nominatim.openstreetmap.org/search' +
    '?q='            + encodeURIComponent(query) +
    '&countrycodes=jm' +
    '&format=json' +
    '&limit=6' +
    '&addressdetails=1';

  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en' } });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

/**
 * @description Builds and shows the suggestions dropdown using safe DOM methods.
 * @param {Array<Object>} results - Nominatim result objects.
 * @returns {void}
 */
function renderSuggestions(results) {
  const list = document.getElementById('mapSuggestions');
  list.textContent = '';

  if (!results.length) { list.classList.add('hidden'); return; }

  results.forEach((result) => {
    const name   = result.display_name.replace(/,?\s*Jamaica$/, '').trim();
    const addr   = result.address || {};
    const parish = addr.county || addr.state_district || '';
    const typeRaw = result.type || result.class || '';
    const type    = typeRaw ? typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1) : '';
    const meta    = [type, parish].filter(Boolean).join(' · ');

    const li = document.createElement('li');
    li.className = 'map-suggestions__item';
    li.setAttribute('role', 'option');

    // Icon chip
    const iconWrap = document.createElement('span');
    iconWrap.className = 'map-suggestions__icon';
    const iconEl = document.createElement('i');
    iconEl.className = 'fa fa-location-dot';
    iconEl.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(iconEl);

    // Text
    const info    = document.createElement('span');
    info.className = 'map-suggestions__info';

    const nameEl  = document.createElement('div');
    nameEl.className = 'map-suggestions__name';
    nameEl.textContent = name;
    info.appendChild(nameEl);

    if (meta) {
      const metaEl  = document.createElement('div');
      metaEl.className = 'map-suggestions__meta';
      metaEl.textContent = meta;
      info.appendChild(metaEl);
    }

    li.append(iconWrap, info);

    li.addEventListener('click', () => {
      document.getElementById('mapSearchInput').value = name;
      clearSuggestions();
      flyToLocation(parseFloat(result.lat), parseFloat(result.lon), name);
      setMapStatus('📍 Found: ' + name, 'success');
    });

    list.appendChild(li);
  });

  list.classList.remove('hidden');
}

/**
 * @description Hides and empties the suggestions dropdown.
 * @returns {void}
 */
function clearSuggestions() {
  const list = document.getElementById('mapSuggestions');
  if (list) { list.textContent = ''; list.classList.add('hidden'); }
}

/* ================================================================
   INITIALISATION
================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initMap();

  const input  = document.getElementById('mapSearchInput');
  const button = document.getElementById('mapSearchBtn');

  // Live suggestions — debounced 300 ms
  input.addEventListener('input', () => {
    clearTimeout(_suggestTimer);
    const q = input.value.trim();
    if (q.length < 2) { clearSuggestions(); return; }
    _suggestTimer = setTimeout(async () => {
      const results = await fetchSuggestions(q);
      renderSuggestions(results);
    }, 300);
  });

  // Dismiss when clicking outside the search wrapper
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-search-wrap')) clearSuggestions();
  });

  // Search button — clear suggestions then search
  button.addEventListener('click', () => { clearSuggestions(); handleMapSearch(); });

  // Keyboard: Enter to search, Escape to dismiss
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { clearSuggestions(); handleMapSearch(); }
    if (e.key === 'Escape') clearSuggestions();
  });
});
