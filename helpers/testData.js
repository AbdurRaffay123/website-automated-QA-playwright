import crypto from 'crypto';

let counter = 0;

/**
 * Generate unique test values to avoid duplicate data conflicts.
 */
export function generateUniqueValue(context, type = 'string') {
  counter += 1;
  const tag = context.runTag || context.variables?.runTag || 'qa';
  const suffix = `${tag}-${counter}-${crypto.randomBytes(3).toString('hex')}`;

  switch (type) {
    case 'email':
      return `${suffix}@example.com`;
    case 'phone':
      return `+1${Date.now().toString().slice(-10)}`;
    case 'number':
      return counter + Math.floor(Math.random() * 1000);
    case 'uuid':
      return crypto.randomUUID();
    case 'name':
      return `QA Test ${suffix}`;
    default:
      return suffix;
  }
}

export function buildTestData(fieldDefs, context) {
  const data = {};
  for (const field of fieldDefs) {
    if (field.value !== undefined) {
      data[field.name] = field.value;
    } else if (field.generate) {
      data[field.name] = generateUniqueValue(context, field.generate);
    }
  }
  return data;
}
