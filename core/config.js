import fs from 'fs';
import path from 'path';

/**
 * Loads a project config file by name (without .json extension) or full path.
 * Usage: PROJECT=anil-erp npm run test
 */
export function loadConfig() {
  const projectName = process.env.PROJECT;
  if (!projectName) {
    throw new Error(
      'No PROJECT env var set. Run like: PROJECT=anil-erp npx playwright test'
    );
  }

  const configPath = projectName.endsWith('.json')
    ? path.resolve(projectName)
    : path.resolve('configs', `${projectName}.json`);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  // basic validation
  if (!config.baseUrl) throw new Error(`Config "${projectName}" is missing baseUrl`);
  if (!Array.isArray(config.endpoints)) config.endpoints = [];
  if (!Array.isArray(config.pages)) config.pages = [];

  return config;
}

/**
 * Resolve {{placeholders}} in a string/object using a context map.
 * Lets later steps reference values saved by earlier steps (e.g. a created record's UUID).
 */
export function resolveTemplate(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const trimmed = key.trim();
      if (!(trimmed in context)) {
        throw new Error(`Template variable "${trimmed}" was not found in context. Did an earlier step fail to save it?`);
      }
      return context[trimmed];
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, context));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplate(v, context);
    return out;
  }
  return value;
}

/** Reads a dotted path like "data.token" out of a JSON object */
export function getByPath(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}
