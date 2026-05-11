/**
 * @module youtube
 * @description On-Demand Media Player module.
 *
 * Searches the YouTube Data API v3 for the top 5 videos matching a query,
 * injects result cards into the DOM using Template Literals (per the assignment
 * spec), and updates a central <iframe> when a thumbnail is clicked.
 *
 * Template Literal Usage (Assignment Requirement):
 *   buildThumbHTML() generates the full card markup as a template-literal
 *   string. The string is then parsed via DOMParser before DOM insertion,
 *   which provides the template-literal injection pattern the spec requires
 *   while keeping the rendering secure.
 *
 * Flow:
 *  1. User types a topic and clicks Search → handleYTSearch()
 *  2. handleYTSearch() calls fetchVideos() via fetch() + async/await
 *  3. renderThumbnails() calls buildThumbHTML() (template literals) and
 *     inserts the parsed nodes into the DOM
 *  4. User clicks a card → loadPlayer() swaps the iframe src
 */

'use strict';

/* ================================================================
   API LAYER
================================================================ */

/**
 * @description Queries the YouTube Data API v3 for up to 5 video results
 *              matching the supplied search term.
 *
 * @param {string} query  - The search topic (e.g. "JavaScript Tutorial").
 * @param {string} apiKey - A valid YouTube Data API v3 key from config.js.
 * @returns {Promise<Array<Object>>} Resolves to an array of YouTube video
 *          item objects (id + snippet) from the search response.
 * @throws {Error} On non-2xx HTTP status or network failure.
 */
async function fetchVideos(query, apiKey) {
  const url =
    `${CONFIG.ENDPOINTS.YOUTUBE_SEARCH}` +
    `?part=snippet` +
    `&maxResults=5` +
    `&type=video` +
    `&q=${encodeURIComponent(query)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);

  if (response.status === 400) {
    throw new Error('Bad request — check your YouTube API key in config.js.');
  }
  if (response.status === 403) {
    throw new Error('YouTube API key is invalid or quota exceeded.');
  }
  if (!response.ok) {
    throw new Error(`YouTube API error ${response.status}`);
  }

  const data = await response.json();
  return data.items ?? [];
}

/* ================================================================
   TEMPLATE LITERAL HTML BUILDER (Assignment Specification)
================================================================ */

/**
 * @description Builds the complete HTML markup for a single video thumbnail
 *              card using an ES6 Template Literal, as required by the
 *              assignment specification ("Use Template Literals to inject
 *              the video results into the HTML").
 *
 *              Security: attribute values (title, channel) are escaped via
 *              escapeAttr() before interpolation. The videoId is validated
 *              to be alphanumeric-only. Thumbnail URLs originate from
 *              ytimg.com (YouTube's own CDN).
 *
 * @param {Object} video     - A single YouTube search result item object.
 * @param {number} index     - Zero-based index used for staggered animation delay.
 * @returns {string}           Template-literal HTML string for this card.
 */
function buildThumbHTML(video, index) {
  const rawId   = video.id.videoId ?? '';
  // Validate videoId: YouTube IDs are alphanumeric + hyphens/underscores only
  const videoId = /^[\w-]{6,20}$/.test(rawId) ? rawId : '';

  const title   = escapeAttr(video.snippet.title          ?? '');
  const channel = escapeAttr(video.snippet.channelTitle   ?? '');
  const thumb   = video.snippet.thumbnails.high?.url
               ?? video.snippet.thumbnails.medium?.url
               ?? video.snippet.thumbnails.default?.url
               ?? '';

  // ── ES6 Template Literal ─────────────────────────────────────
  return `
    <div
      class="yt-thumb"
      data-video-id="${videoId}"
      role="button"
      tabindex="0"
      aria-label="Play: ${title}"
      style="animation-delay:${index * 80}ms"
    >
      <img src="${thumb}" alt="${title}" loading="lazy" />
      <div class="yt-thumb__info">
        <p class="yt-thumb__title">${title}</p>
        <p style="font-size:0.65rem;color:var(--text-3);margin-top:0.25rem">${channel}</p>
      </div>
    </div>`;
  // ── End Template Literal ──────────────────────────────────────
}

/* ================================================================
   RENDER
================================================================ */

/**
 * @description Renders thumbnail cards for up to 5 videos.
 *              Template literal strings from buildThumbHTML() are parsed
 *              via DOMParser (safe HTML parser) then appended to the DOM.
 *
 * @param {Array<Object>} videos - Array of YouTube search result item objects.
 * @returns {void}
 */
function renderThumbnails(videos) {
  const container = document.getElementById('ytThumbnails');
  container.textContent = ''; // clear safely

  if (!videos.length) {
    const msg = document.createElement('p');
    msg.className = 'yt-empty';
    msg.textContent = 'No videos found. Try a different search term.';
    container.appendChild(msg);
    return;
  }

  const parser   = new DOMParser();
  const fragment = document.createDocumentFragment();

  videos.forEach((video, index) => {
    // Build card string via template literal, then parse it safely
    const htmlString = buildThumbHTML(video, index);
    const parsed     = parser.parseFromString(
      `<div id="wrap">${htmlString}</div>`,
      'text/html'
    );
    const card = parsed.getElementById('wrap').firstElementChild;
    if (!card) return;

    card.addEventListener('click', () => loadPlayer(card.dataset.videoId, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') loadPlayer(card.dataset.videoId, card);
    });

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/* ================================================================
   PLAYER
================================================================ */

/**
 * @description Updates the central <iframe> to embed and autoplay the
 *              selected YouTube video. Hides the placeholder graphic.
 *
 * @param {string}      videoId    - The YouTube video ID (alphanumeric, 6-20 chars).
 * @param {HTMLElement} activeCard - The thumbnail card that was clicked.
 * @returns {void}
 */
function loadPlayer(videoId, activeCard) {
  if (!videoId) return;

  const iframe      = document.getElementById('ytPlayer');
  const placeholder = document.getElementById('ytPlaceholder');

  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  iframe.classList.remove('hidden');
  placeholder.style.display = 'none';

  // Highlight the active thumbnail card
  document.querySelectorAll('.yt-thumb').forEach((c) => c.classList.remove('active'));
  activeCard.classList.add('active');
}

/* ================================================================
   SPINNER
================================================================ */

/**
 * @description Shows or hides the YouTube loading spinner overlay.
 *
 * @param {boolean} visible - True to show the spinner; false to hide it.
 * @returns {void}
 */
function setYTSpinner(visible) {
  document.getElementById('ytSpinner').classList.toggle('hidden', !visible);
}

/* ================================================================
   SEARCH HANDLER
================================================================ */

/**
 * @description Orchestrates the full YouTube search flow:
 *              validates the API key and query, shows the spinner,
 *              awaits the fetch, renders thumbnails, then hides the spinner.
 *
 * @returns {Promise<void>}
 */
async function handleYTSearch() {
  const input  = document.getElementById('ytSearchInput');
  const button = document.getElementById('ytSearchBtn');
  const query  = input.value.trim();

  if (!query) return;

  const key = CONFIG.YOUTUBE_KEY;
  if (!key || key.includes('YOUR_')) {
    const container = document.getElementById('ytThumbnails');
    container.textContent = '';
    const msg = document.createElement('p');
    msg.className = 'yt-empty';
    msg.textContent = '⚠ Add your YouTube API key to config.js to enable video search.';
    container.appendChild(msg);
    return;
  }

  // Reset the player before a new search
  const iframe = document.getElementById('ytPlayer');
  iframe.src = '';
  iframe.classList.add('hidden');
  document.getElementById('ytPlaceholder').style.display = '';

  setYTSpinner(true);
  document.getElementById('ytThumbnails').textContent = '';
  button.disabled = true;

  try {
    const videos = await fetchVideos(query, key);
    renderThumbnails(videos);
  } catch (err) {
    const container = document.getElementById('ytThumbnails');
    container.textContent = '';
    const msg = document.createElement('p');
    msg.className = 'yt-empty';
    msg.style.color = 'var(--danger)';
    msg.textContent = `⚠ ${err.message}`;
    container.appendChild(msg);
  } finally {
    setYTSpinner(false);
    button.disabled = false;
  }
}

/* ================================================================
   UTILITIES
================================================================ */

/**
 * @description Escapes characters that are unsafe inside HTML attribute
 *              values (used inside template literal interpolations).
 *
 * @param {string} str - Raw string from the YouTube API response.
 * @returns {string}     Escaped string safe for HTML attribute interpolation.
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

/* ================================================================
   INITIALISATION
================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ytSearchBtn')
    .addEventListener('click', handleYTSearch);

  document.getElementById('ytSearchInput')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleYTSearch();
    });
});
