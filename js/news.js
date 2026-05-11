/**
 * @module news
 * @description Real-Time News Stream module.
 *
 * Fetches live articles from the New York Times Article Search API and
 * renders them as animated glassmorphism cards in a responsive CSS Grid.
 * A loading spinner is shown while the fetch is in progress and hidden
 * once the DOM is fully updated.
 *
 * Flow:
 *  1. User types a query and clicks Search → handleNewsSearch()
 *  2. handleNewsSearch() shows the spinner and calls fetchArticles()
 *  3. fetchArticles() uses fetch() + async/await to hit the NYTimes API
 *  4. renderCards() builds card elements with safe DOM methods and appends them
 *  5. Spinner is hidden after the DOM update
 */

'use strict';

/* ================================================================
   API LAYER
================================================================ */

/**
 * @description Fetches a page of articles from the NYTimes Article Search API
 *              matching the provided search query.
 *
 * @param {string} query   - The keyword(s) to search for (e.g. "Climate").
 * @param {string} apiKey  - A valid NYTimes API key from config.js.
 * @returns {Promise<Array<Object>>} Resolves to an array of NYTimes article
 *          document objects. Returns an empty array on no results.
 * @throws {Error} On non-2xx HTTP status or network failure.
 */
async function fetchArticles(query, apiKey) {
  const url =
    `${CONFIG.ENDPOINTS.NYTIMES_SEARCH}` +
    `?q=${encodeURIComponent(query)}` +
    `&api-key=${encodeURIComponent(apiKey)}` +
    `&page=0` +
    `&sort=relevance`;

  const response = await fetch(url);

  if (response.status === 401) {
    throw new Error('Invalid NYTimes API key. Check config.js.');
  }
  if (response.status === 429) {
    throw new Error('NYTimes rate limit reached. Wait a minute and try again.');
  }
  if (!response.ok) {
    throw new Error(`NYTimes API error ${response.status}`);
  }

  const data = await response.json();
  return data.response?.docs ?? [];
}

/* ================================================================
   RENDER — safe DOM construction (no innerHTML with untrusted data)
================================================================ */

/**
 * @description Creates a single news card DOM element for one article.
 *              All text is set via textContent to prevent XSS.
 *              The "Read More" href is validated to only allow https links.
 *
 * @param {Object} article      - A NYTimes article doc object from the API.
 * @param {number} delayMs      - CSS animation-delay value in milliseconds.
 * @returns {HTMLElement}         A fully constructed <article> DOM node.
 */
function buildCard(article, delayMs) {
  const headline = article.headline?.main          ?? 'Untitled Article';
  const lead     = article.lead_paragraph ?? article.abstract ?? 'No description available.';
  const section  = article.section_name  ?? article.news_desk ?? 'NYTimes';
  const rawUrl   = article.web_url       ?? '';

  // Only allow https:// URLs to prevent javascript: injection
  const safeUrl = rawUrl.startsWith('https://') ? rawUrl : '#';

  // <article class="news-card">
  const card = document.createElement('article');
  card.className = 'news-card';
  card.style.animationDelay = `${delayMs}ms`;
  card.setAttribute('role', 'article');

  // Section tag
  const tag = document.createElement('span');
  tag.className = 'news-card__tag';
  tag.textContent = section;

  // Headline
  const h3 = document.createElement('h3');
  h3.className = 'news-card__headline';
  h3.textContent = headline;

  // Lead paragraph
  const p = document.createElement('p');
  p.className = 'news-card__lead';
  p.textContent = lead;

  // Read More link
  const link = document.createElement('a');
  link.href      = safeUrl;
  link.target    = '_blank';
  link.rel       = 'noopener noreferrer';
  link.className = 'news-card__link';
  link.setAttribute('aria-label', `Read full article: ${headline}`);
  link.textContent = 'Read More ';

  const icon = document.createElement('i');
  icon.className = 'fa fa-arrow-up-right-from-square';
  icon.setAttribute('aria-hidden', 'true');
  link.appendChild(icon);

  card.append(tag, h3, p, link);
  return card;
}

/**
 * @description Renders up to nine article cards into the #newsGrid element.
 *              Each card shows the section tag, headline, lead paragraph,
 *              and a "Read More" link that opens the article in a new tab.
 *
 * @param {Array<Object>} articles - Array of NYTimes article doc objects
 *                                   returned by the Article Search API.
 * @returns {void}
 */
function renderCards(articles) {
  const grid = document.getElementById('newsGrid');
  grid.textContent = ''; // Clear previous results safely

  if (!articles.length) {
    const empty = document.createElement('div');
    empty.className = 'news-empty';
    const msg = document.createElement('p');
    msg.textContent = 'No articles found. Try: Technology, Climate, Sports, Science.';
    empty.appendChild(msg);
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  articles.slice(0, 9).forEach((article, i) => {
    fragment.appendChild(buildCard(article, i * 55));
  });
  grid.appendChild(fragment);
}

/**
 * @description Renders a placeholder state prompting the user to configure
 *              their NYTimes API key in config.js.
 *
 * @returns {void}
 */
function renderKeyPrompt() {
  const grid = document.getElementById('newsGrid');
  grid.textContent = '';

  const empty = document.createElement('div');
  empty.className = 'news-empty';

  const msg = document.createElement('p');
  msg.textContent = '⚠ Add your NYTimes API key to config.js to enable live article search.';

  const sub = document.createElement('p');
  sub.style.cssText = 'margin-top:0.5rem;font-size:0.8rem;color:var(--text-3)';
  sub.textContent = 'Get a free key at developer.nytimes.com';

  empty.append(msg, sub);
  grid.appendChild(empty);
}

/* ================================================================
   SPINNER CONTROL
================================================================ */

/**
 * @description Shows or hides the loading spinner overlay above the news grid.
 *
 * @param {boolean} visible - Pass true to show the spinner; false to hide it.
 * @returns {void}
 */
function setNewsSpinner(visible) {
  document.getElementById('newsSpinner').classList.toggle('hidden', !visible);
}

/* ================================================================
   SEARCH HANDLER
================================================================ */

/**
 * @description Orchestrates the full news-search flow:
 *              validates input and API key, shows the spinner,
 *              awaits the fetch, renders results, then hides the spinner.
 *
 * @returns {Promise<void>}
 */
async function handleNewsSearch() {
  const input  = document.getElementById('newsSearchInput');
  const button = document.getElementById('newsSearchBtn');
  const query  = input.value.trim();

  if (!query) return;

  const key = CONFIG.NYTIMES_KEY;
  if (!key || key.includes('YOUR_')) {
    renderKeyPrompt();
    return;
  }

  // Show spinner, clear previous results, disable button
  setNewsSpinner(true);
  document.getElementById('newsGrid').textContent = '';
  button.disabled = true;

  try {
    const articles = await fetchArticles(query, key);
    renderCards(articles);
  } catch (err) {
    const grid = document.getElementById('newsGrid');
    grid.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'news-empty';
    const errMsg = document.createElement('p');
    errMsg.style.color = 'var(--danger)';
    errMsg.textContent = `⚠ ${err.message}`;
    errDiv.appendChild(errMsg);
    grid.appendChild(errDiv);
  } finally {
    // Always hide spinner once the DOM has been updated
    setNewsSpinner(false);
    button.disabled = false;
  }
}

/* ================================================================
   INITIALISATION
================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('newsSearchBtn')
    .addEventListener('click', handleNewsSearch);

  document.getElementById('newsSearchInput')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleNewsSearch();
    });
});
