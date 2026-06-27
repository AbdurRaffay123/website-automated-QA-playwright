import { loadPlugins, getActivePlugins } from './pluginRegistry.js';
import { createTestContext } from './context.js';
import { getAuthHeaders } from './auth.js';

/**
 * Main test runner — loads config, initializes context, and registers all active plugins.
 */
export async function createTestSuite(test, config, options = {}) {
  await loadPlugins();

  const context = createTestContext(config);
  const authHeadersRef = { current: {} };

  const plugins = getActivePlugins(config, options);

  test.describe(`QA Suite - ${config.projectName}`, () => {
    test.beforeAll(async ({ request }) => {
      authHeadersRef.current = await getAuthHeaders(request, config);

      if (config.hooks?.beforeAll) {
        for (const hook of config.hooks.beforeAll) {
          if (hook.type === 'api' && hook.path) {
            const { resolveTemplate } = await import('../helpers/template.js');
            await request[hook.method?.toLowerCase() || 'get'](
              `${config.baseUrl}${resolveTemplate(hook.path, context)}`,
              { headers: authHeadersRef.current, data: hook.body ? resolveTemplate(hook.body, context) : undefined }
            );
          }
        }
      }
    });

    for (const plugin of plugins) {
      test.describe(`[${plugin.id}]`, () => {
        plugin.register({ test, config, context, authHeadersRef, options });
      });
    }
  });

  return { context, plugins };
}

export { loadPlugins, getActivePlugins, createTestContext };
