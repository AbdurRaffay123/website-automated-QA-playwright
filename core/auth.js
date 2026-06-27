import { getByPath } from './config.js';

/**
 * Logs in using the project's configured auth strategy and returns
 * headers to attach to subsequent authenticated requests.
 * Currently supports "bearer-login" (POST credentials, extract token from response).
 * Extend this with more "type" branches (e.g. "api-key", "basic", "cookie")
 * as new projects need them - keep each project's config oblivious to the mechanics.
 */
export async function getAuthHeaders(request, config) {
  const auth = config.auth;
  if (!auth || auth.type === 'none') return {};

  if (auth.type === 'bearer-login') {
    const res = await request.post(`${config.baseUrl}${auth.loginEndpoint}`, {
      data: auth.loginBody,
    });

    if (!res.ok()) {
      throw new Error(
        `Auth login failed (${res.status()}) at ${auth.loginEndpoint}. ` +
        `Check loginBody credentials in the config - the test user may not exist yet.`
      );
    }

    const json = await res.json();
    const token = getByPath(json, auth.tokenPath);
    if (!token) {
      throw new Error(
        `Could not find token at path "${auth.tokenPath}" in login response. ` +
        `Got: ${JSON.stringify(json)}`
      );
    }

    return { [auth.header]: `${auth.headerPrefix}${token}` };
  }

  if (auth.type === 'api-key') {
    return { [auth.header]: auth.value };
  }

  throw new Error(`Unsupported auth type: ${auth.type}`);
}
