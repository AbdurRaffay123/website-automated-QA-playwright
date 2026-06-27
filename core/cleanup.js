import { getByPath } from './config.js';
import { RUN_TAG_PREFIX } from './runTag.js';

function resolveDeletePath(template, id) {
  return template.replace(/\{\{id\}\}/g, String(id));
}

/**
 * Sweep configured list endpoints for records tagged with RUN_TAG_PREFIX
 * and delete them via each target's deleteEndpointTemplate.
 */
export async function cleanupTaggedData(request, config, authHeaders) {
  const targets = config.cleanupTargets || [];
  const results = [];

  for (const target of targets) {
    const result = {
      name: target.name,
      found: 0,
      deleted: 0,
      failed: 0,
      errors: [],
    };

    try {
      const listUrl = `${config.baseUrl}${target.listEndpoint}`;
      const listRes = await request.get(listUrl, { headers: authHeaders });

      if (!listRes.ok()) {
        result.failed += 1;
        result.errors.push(`List failed with status ${listRes.status()}`);
        results.push(result);
        continue;
      }

      const listJson = await listRes.json();
      const records = getByPath(listJson, target.listResponsePath);

      if (!Array.isArray(records)) {
        result.failed += 1;
        result.errors.push(
          `Expected array at listResponsePath "${target.listResponsePath}", got ${typeof records}`
        );
        results.push(result);
        continue;
      }

      const tagged = records.filter((record) => {
        const value = getByPath(record, target.matchField);
        return typeof value === 'string' && value.includes(RUN_TAG_PREFIX);
      });

      result.found = tagged.length;

      for (const record of tagged) {
        const id = getByPath(record, target.idField);
        if (id === undefined || id === null || id === '') {
          result.failed += 1;
          result.errors.push(`Missing idField "${target.idField}" on tagged record`);
          continue;
        }

        const deletePath = resolveDeletePath(target.deleteEndpointTemplate, id);
        const deleteUrl = `${config.baseUrl}${deletePath}`;
        const deleteRes = await request.delete(deleteUrl, { headers: authHeaders });

        if (deleteRes.ok() || deleteRes.status() === 204) {
          result.deleted += 1;
        } else {
          result.failed += 1;
          const body = await deleteRes.text().catch(() => '<unreadable>');
          result.errors.push(`Delete ${deletePath} failed with ${deleteRes.status()}: ${body}`);
        }
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push(error.message);
    }

    results.push(result);
  }

  return results;
}

export function formatCleanupSummary(results) {
  if (!results.length) {
    return 'No cleanup targets configured.';
  }

  const lines = results.map((result) => {
    const base = `${result.name}: found ${result.found}, deleted ${result.deleted}, failed ${result.failed}`;
    if (!result.errors.length) return base;
    return `${base} (${result.errors[0]})`;
  });

  return lines.join('\n');
}
