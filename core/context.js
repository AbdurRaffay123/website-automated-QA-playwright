import { getRunTag } from './runTag.js';

/**
 * Shared runtime context for a test run.
 * Stores template variables, created records, network logs, and performance metrics.
 */
export function createTestContext(config) {
  const context = {
    runTag: getRunTag(),
    variables: { runTag: getRunTag() },
    createdRecords: [],
    networkLog: [],
    performanceLog: [],
    evidence: [],
  };

  // Seed config-level default variables
  if (config.variables) {
    for (const [key, value] of Object.entries(config.variables)) {
      context.variables[key] = typeof value === 'string' ? value : value;
    }
  }

  return context;
}

export function setVariable(context, key, value) {
  context.variables[key] = value;
}

export function getVariable(context, key) {
  return context.variables[key];
}

export function trackCreatedRecord(context, record) {
  context.createdRecords.push(record);
}

export function logNetwork(context, entry) {
  context.networkLog.push({ ...entry, timestamp: Date.now() });
}

export function logPerformance(context, entry) {
  context.performanceLog.push({ ...entry, timestamp: Date.now() });
}

