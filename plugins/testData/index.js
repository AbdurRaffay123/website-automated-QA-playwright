import { cleanupTaggedData } from '../../core/cleanup.js';

const testDataPlugin = {
  id: 'testData',
  priority: 5,
  isEnabled: (config) => config.testData?.factories?.length > 0,

  register({ test, config, context, authHeadersRef }) {
    const factories = config.testData?.factories || [];

    for (const factory of factories) {
      test(`TestData - create ${factory.name}`, { tag: factory.tags || ['test-data'] }, async ({ request }) => {
        const authHeaders = authHeadersRef.current;
        const { resolveTemplate, getByPath } = await import('../../helpers/template.js');
        const { setVariable, trackCreatedRecord } = await import('../../core/context.js');

        const path = resolveTemplate(factory.create.path, context);
        const body = factory.create.body ? resolveTemplate(factory.create.body, context) : undefined;

        const res = await request[factory.create.method.toLowerCase()](`${config.baseUrl}${path}`, {
          headers: authHeaders,
          data: body,
        });

        const expected = factory.create.expectStatus || [200, 201];
        if (!expected.includes(res.status())) {
          throw new Error(`Factory "${factory.name}" create failed with ${res.status()}`);
        }

        const json = await res.json().catch(() => null);
        if (factory.create.saveAs && json) {
          const value = getByPath(json, factory.create.savePath || 'data.uuid');
          setVariable(context, factory.create.saveAs, value);
          trackCreatedRecord(context, { type: factory.name, id: value });
        }
      });
    }

    if (config.hooks?.afterAll?.includes('cleanup') || config.testData?.cleanupAfterRun) {
      test.afterAll(async ({ request }) => {
        const authHeaders = authHeadersRef.current;
        await cleanupTaggedData(request, config, authHeaders);
      });
    }
  },
};

export default testDataPlugin;
