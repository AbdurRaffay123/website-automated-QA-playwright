import { generateUniqueValue } from './testData.js';

/**
 * Resolve {{placeholders}} in strings/objects using a context map.
 */
export function resolveTemplate(value, context, options = {}) {
  const vars = context.variables ?? context;

  if (typeof value === 'string') {
    let resolved = value.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const trimmed = key.trim();

      if (trimmed === 'unique' || trimmed.startsWith('unique:')) {
        const type = trimmed === 'unique' ? 'string' : trimmed.split(':')[1];
        const uniqueVal = generateUniqueValue(context, type);
        if (!vars._uniqueCache) vars._uniqueCache = {};
        if (!(trimmed in vars._uniqueCache)) vars._uniqueCache[trimmed] = uniqueVal;
        return vars._uniqueCache[trimmed];
      }

      if (!(trimmed in vars)) {
        if (options.allowMissing) return `{{${trimmed}}}`;
        throw new Error(
          `Template variable "${trimmed}" was not found in context. Did an earlier step fail to save it?`
        );
      }
      return vars[trimmed];
    });
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, context, options));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveTemplate(v, context, options);
    }
    return out;
  }

  return value;
}

/** Reads a dotted path like "data.token" out of a JSON object */
export function getByPath(obj, dottedPath) {
  if (!dottedPath) return obj;
  return dottedPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Sets a value at a dotted path */
export function setByPath(obj, dottedPath, value) {
  const keys = dottedPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
