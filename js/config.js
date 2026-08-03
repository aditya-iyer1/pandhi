/** Local API while developing. */
const LOCAL_API_BASE_URL = 'http://localhost:3000';

/**
 * Production API (Render).
 * After you create the Render web service, set this to its URL
 * (e.g. https://pandhi-api.onrender.com — no trailing slash).
 */
const PROD_API_BASE_URL = 'https://pandhi-api.onrender.com';

const API_BASE_URL =
  typeof location !== 'undefined' &&
  (location.hostname.endsWith('github.io') || location.hostname.endsWith('onrender.com'))
    ? PROD_API_BASE_URL
    : LOCAL_API_BASE_URL;
