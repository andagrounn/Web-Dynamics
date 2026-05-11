/**
 * @description Central configuration file for all third-party API keys and endpoint URLs.
 *              Copy this file to config.js and replace every placeholder with your actual key.
 *              DO NOT commit config.js (your real keys) to source control.
 *
 * @module config
 */
const CONFIG = {
  /**
   * MapQuest API key — used by the Geocoding API to convert addresses to coordinates.
   * Get yours at: https://developer.mapquest.com/
   */
  MAPQUEST_KEY: 'YOUR_MAPQUEST_KEY_HERE',

  /**
   * New York Times API key — used by the Article Search endpoint.
   * Get yours at: https://developer.nytimes.com/
   */
  NYTIMES_KEY: 'YOUR_NYTIMES_API_KEY_HERE',

  /**
   * YouTube Data API v3 key — used for video search results.
   * Get yours at: https://console.cloud.google.com/
   */
  YOUTUBE_KEY: 'YOUR_YOUTUBE_API_KEY_HERE',

  /** Base endpoint URLs for each provider */
  ENDPOINTS: {
    MAPQUEST_GEOCODE:
      'https://www.mapquestapi.com/geocoding/v1/address',
    NYTIMES_SEARCH:
      'https://api.nytimes.com/svc/search/v2/articlesearch.json',
    YOUTUBE_SEARCH:
      'https://www.googleapis.com/youtube/v3/search',
  },
};
