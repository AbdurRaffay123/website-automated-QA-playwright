import { logNetwork } from '../core/context.js';

/**
 * Network monitoring and verification during UI actions.
 */
export function startNetworkMonitor(page, context, options = {}) {
  const {
    allowedFailures = [],
    trackPayloads = true,
    allowedStatuses = [200, 201, 204],
  } = options;

  const requests = new Map();

  page.on('request', (request) => {
    const entry = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      timestamp: Date.now(),
    };

    if (trackPayloads && ['POST', 'PUT', 'PATCH'].includes(request.method())) {
      try {
        entry.postData = request.postDataJSON?.() ?? request.postData();
      } catch { /* ignore */ }
    }

    requests.set(request, entry);
    logNetwork(context, { ...entry, phase: 'request' });
  });

  page.on('response', async (response) => {
    const request = response.request();
    const entry = requests.get(request) || { url: response.url(), method: request.method() };

    entry.status = response.status();
    entry.statusText = response.statusText();
    entry.duration = Date.now() - (entry.timestamp || Date.now());

    if (trackPayloads) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          entry.responseBody = await response.json();
        }
      } catch { /* ignore non-json */ }
    }

    context.lastRequest = { url: entry.url, method: entry.method, postData: entry.postData };
    context.lastResponse = { status: entry.status, body: entry.responseBody };

    logNetwork(context, { ...entry, phase: 'response' });

    const isApiCall = entry.url.includes('/api/') || entry.resourceType === 'fetch' || entry.resourceType === 'xhr';
    const isAllowedFailure = allowedFailures.some((pattern) => entry.url.includes(pattern));

    if (isApiCall && !isAllowedFailure && entry.status >= 400) {
      context.networkErrors = context.networkErrors || [];
      context.networkErrors.push({
        url: entry.url,
        status: entry.status,
        method: entry.method,
      });
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    logNetwork(context, {
      url: request.url(),
      method: request.method(),
      phase: 'failed',
      error: failure?.errorText,
    });
    context.networkErrors = context.networkErrors || [];
    context.networkErrors.push({
      url: request.url(),
      error: failure?.errorText,
      phase: 'failed',
    });
  });

  return {
    getErrors: () => context.networkErrors || [],
    clearErrors: () => { context.networkErrors = []; },
  };
}

export function verifyNetworkAction(context, expectation) {
  const logs = context.networkLog || [];
  const matching = logs.filter(
    (entry) =>
      entry.phase === 'response' &&
      (!expectation.method || entry.method === expectation.method) &&
      (!expectation.urlPattern || entry.url.includes(expectation.urlPattern))
  );

  if (matching.length === 0) {
    throw new Error(`No network request matched: ${JSON.stringify(expectation)}`);
  }

  const last = matching[matching.length - 1];

  if (expectation.expectStatus) {
    const expected = Array.isArray(expectation.expectStatus) ? expectation.expectStatus : [expectation.expectStatus];
    if (!expected.includes(last.status)) {
      throw new Error(`Expected status ${expected}, got ${last.status} for ${last.url}`);
    }
  }

  if (expectation.expectPayloadContains) {
    const payload = JSON.stringify(last.postData || last.responseBody || '');
    for (const [key, value] of Object.entries(expectation.expectPayloadContains)) {
      if (!payload.includes(String(value))) {
        throw new Error(`Payload missing "${key}": "${value}"`);
      }
    }
  }

  return last;
}

export function assertNoNetworkErrors(context, options = {}) {
  const errors = context.networkErrors || [];
  const ignored = options.ignore || [];
  const filtered = errors.filter((e) => !ignored.some((pattern) => e.url?.includes(pattern)));

  if (filtered.length > 0) {
    throw new Error(
      `Network errors detected:\n${filtered.map((e) => `  ${e.method || ''} ${e.url} → ${e.status || e.error}`).join('\n')}`
    );
  }
}
