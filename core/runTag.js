import crypto from 'crypto';

export const RUN_TAG_PREFIX = 'qa-test-';

let cachedRunTag;

/**
 * One random tag per test process so every test in a run shares it.
 * Example: qa-test-7f3a9c12
 */
export function getRunTag() {
  if (!cachedRunTag) {
    cachedRunTag = `${RUN_TAG_PREFIX}${crypto.randomBytes(4).toString('hex')}`;
  }
  return cachedRunTag;
}
