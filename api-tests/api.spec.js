import { test, expect } from '@playwright/test';
import { loadConfig, resolveTemplate } from '../core/config.js';
import { getAuthHeaders } from '../core/auth.js';
import { getRunTag } from '../core/runTag.js';

const config = loadConfig();

test.describe(`API tests - ${config.projectName}`, () => {
  // shared across steps within this run, so later endpoints can reference
  // values saved by earlier ones (e.g. {{createdContactUuid}}, {{runTag}})
  const context = { runTag: getRunTag() };
  let authHeaders = {};

  test.beforeAll(async ({ request }) => {
    authHeaders = await getAuthHeaders(request, config);
  });

  for (const endpoint of config.endpoints) {
    test(`${endpoint.method} ${endpoint.path} - ${endpoint.name}`, async ({ request }) => {
      const path = resolveTemplate(endpoint.path, context);
      const body = endpoint.body ? resolveTemplate(endpoint.body, context) : undefined;
      const url = `${config.baseUrl}${path}`;

      const headers = endpoint.auth === false ? {} : authHeaders;

      const method = endpoint.method.toLowerCase();
      const res = await request[method](url, {
        headers,
        data: body,
      });

      const status = res.status();
      const expected = endpoint.expectStatus || [200];

      if (endpoint.knownIssue && !expected.includes(status)) {
        // Known issues are tracked but don't hard-fail the suite -
        // they show as a warning in the report instead of red.
        console.warn(
          `[KNOWN ISSUE] ${endpoint.name}: got ${status}, expected one of [${expected}]. ` +
          `Reason: ${endpoint.knownIssue}`
        );
        test.fixme(true, endpoint.knownIssue);
        return;
      }

      expect(
        expected,
        `${endpoint.name} returned ${status}. Body: ${await res.text().catch(() => '<unreadable>')}`
      ).toContain(status);

      // save a field from the response for later steps to use, if configured
      if (endpoint.saveResponseField) {
        const json = await res.json().catch(() => null);
        if (json) {
          const { getByPath } = await import('../core/config.js');
          const value = getByPath(json, endpoint.saveResponseField.path);
          if (value !== undefined) {
            context[endpoint.saveResponseField.as] = value;
          } else {
            console.warn(
              `Could not save "${endpoint.saveResponseField.as}" - path "${endpoint.saveResponseField.path}" not found in response`
            );
          }
        }
      }
    });
  }
});
