import { expect } from '@playwright/test';
import { resolveTemplate, getByPath } from '../../helpers/template.js';
import { getAuthHeaders } from '../../core/auth.js';
import { setVariable } from '../../core/context.js';
import { withRetry, getRetryConfig } from '../../core/retry.js';

async function executeEndpoint(request, endpoint, config, context, authHeaders) {
  const path = resolveTemplate(endpoint.path, context);
  const body = endpoint.body ? resolveTemplate(endpoint.body, context) : undefined;
  const url = `${config.baseUrl}${path}`;
  const headers = endpoint.auth === false ? {} : authHeaders;
  const method = endpoint.method.toLowerCase();

  const res = await request[method](url, { headers, data: body, multipart: endpoint.multipart });
  const status = res.status();
  const expected = endpoint.expectStatus || [200];

  if (endpoint.knownIssue && !expected.includes(status)) {
    return { status, knownIssue: endpoint.knownIssue, skipped: true };
  }

  expect(
    expected,
    `${endpoint.name} returned ${status}. Body: ${await res.text().catch(() => '<unreadable>')}`
  ).toContain(status);

  if (endpoint.saveResponseField) {
    const json = await res.json().catch(() => null);
    if (json) {
      const value = getByPath(json, endpoint.saveResponseField.path);
      if (value !== undefined) {
        setVariable(context, endpoint.saveResponseField.as, value);
      }
    }
  }

  if (endpoint.expectResponseContains) {
    const json = await res.json().catch(() => null);
    for (const [key, val] of Object.entries(endpoint.expectResponseContains)) {
      const actual = getByPath(json, key);
      expect(actual, `Response path "${key}"`).toEqual(resolveTemplate(val, context));
    }
  }

  return { status, response: res };
}

const apiPlugin = {
  id: 'api',
  priority: 10,
  isEnabled: (config) => config.endpoints.length > 0 || config.plugins?.api !== false,

  register({ test, config, context, authHeadersRef }) {
    const retryConfig = getRetryConfig(config);

    for (const endpoint of config.endpoints) {
      const tags = endpoint.tags || [];

      test(`${endpoint.method} ${endpoint.path} - ${endpoint.name}`, { tag: tags }, async ({ request }) => {
        const authHeaders = authHeadersRef.current;

        const result = await withRetry(
          () => executeEndpoint(request, endpoint, config, context, authHeaders),
          { maxRetries: retryConfig.maxRetries, delayMs: retryConfig.delayMs }
        );

        if (result.skipped && result.knownIssue) {
          test.info().annotations.push({ type: 'known-issue', description: result.knownIssue });
          test.fixme(true, result.knownIssue);
        }
      });
    }
  },
};

export default apiPlugin;
