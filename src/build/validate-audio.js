/**
 * validate-audio.js — Validation rules for episode audio URLs.
 *
 * Allows valid HTTPS public podcast enclosure URLs (including media.rss.com, rss.com, etc.)
 * while rejecting malformed, non-HTTPS, credential-bearing, or signed/private CloudFront URLs.
 */

const SIGNED_QUERY_PARAMS = [
  'signature',
  'expires',
  'key-pair-id',
  'policy',
  'x-amz-signature',
  'x-amz-expires',
  'x-amz-credential',
  'x-amz-date',
  'x-amz-security-token',
];

/**
 * Validates the syntax, protocol, and shape of an audio URL.
 *
 * @param {string} url - Audio URL to validate
 * @returns {{ valid: boolean; reason?: string }}
 */
export function validateAudioUrlShape(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, reason: 'Audio URL is empty or not a string' };
  }

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return { valid: false, reason: `Malformed audio URL: "${trimmed}" (${err.message})` };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Insecure or invalid audio URL protocol: "${parsed.protocol}" (must be https:)`,
    };
  }

  // Reject URLs containing credentials
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Audio URL must not contain embedded credentials' };
  }

  // Reject signed / temporary / private CloudFront and AWS SigV4 query parameters
  const queryKeys = Array.from(parsed.searchParams.keys()).map((k) => k.toLowerCase());
  for (const signedParam of SIGNED_QUERY_PARAMS) {
    if (queryKeys.includes(signedParam)) {
      return {
        valid: false,
        reason: `Forbidden signed/private CloudFront URL containing query parameter "${signedParam}". Public permanent enclosure URLs must be used.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Smoke-check helper to verify that a public audio URL responds with 2xx/3xx
 * and an audio-compatible content type or redirect.
 *
 * Used for post-deployment verification and smoke checks. Live HTTP availability
 * is not a dependency for unit tests.
 *
 * @param {string} url - The URL to check
 * @param {object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @param {typeof fetch} [options.fetchImpl=globalThis.fetch]
 * @returns {Promise<{ ok: boolean; status: number; contentType: string; finalUrl: string; error?: string }>}
 */
export async function smokeCheckAudioEndpoint(
  url,
  { timeoutMs = 5000, fetchImpl = globalThis.fetch } = {}
) {
  const shapeCheck = validateAudioUrlShape(url);
  if (!shapeCheck.valid) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      finalUrl: url,
      error: shapeCheck.reason,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Perform HEAD or GET with redirect follow
    let response = await fetchImpl(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FamilyGuyGuys-SmokeChecker/1.0',
      },
    });

    // If HEAD is method not allowed (405) or forbidden (403), try GET with Range header for 1 byte
    if (response.status === 405 || response.status === 403) {
      response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'FamilyGuyGuys-SmokeChecker/1.0',
          Range: 'bytes=0-0',
        },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const status = response.status;
    const ok = status >= 200 && status < 400;

    return {
      ok,
      status,
      contentType,
      finalUrl: response.url || url,
      error: ok ? undefined : `HTTP status ${status} (${response.statusText})`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      finalUrl: url,
      error: err.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}
