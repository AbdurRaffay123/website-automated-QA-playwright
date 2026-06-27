import fs from 'fs';
import path from 'path';
import { resolveTemplate, getByPath } from '../helpers/template.js';

/**
 * Loads and normalizes a project config file.
 * Usage: PROJECT=anil-erp npx playwright test
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
  return normalizeConfig(config, projectName);
}

function normalizeConfig(config, projectName) {
  if (!config.baseUrl) throw new Error(`Config "${projectName}" is missing baseUrl`);

  // Legacy arrays — always present with defaults
  config.endpoints = config.endpoints || [];
  config.pages = config.pages || [];
  config.buttonChecks = config.buttonChecks || [];
  config.cleanupTargets = config.cleanupTargets || [];

  // New capability sections — optional, default to empty
  config.modules = config.modules || [];
  config.workflows = config.workflows || [];
  config.forms = config.forms || [];
  config.validations = config.validations || [];
  config.tables = config.tables || [];
  config.navigation = config.navigation || {};
  config.roles = config.roles || [];
  config.responsive = config.responsive || {};
  config.performance = config.performance || {};
  config.visual = config.visual || {};
  config.files = config.files || [];
  config.notifications = config.notifications || [];
  config.search = config.search || [];
  config.dashboards = config.dashboards || [];
  config.accessibility = config.accessibility || {};
  config.links = config.links || {};
  config.persistence = config.persistence || [];
  config.plugins = config.plugins || {};
  config.hooks = config.hooks || {};
  config.tags = config.tags || [];
  config.retry = config.retry || {};

  // Default responsive breakpoints
  if (!config.responsive.breakpoints) {
    config.responsive.breakpoints = {
      desktop: { width: 1920, height: 1080 },
      laptop: { width: 1366, height: 768 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 375, height: 812 },
    };
  }

  // Default performance thresholds
  if (!config.performance.thresholds) {
    config.performance.thresholds = {
      pageLoadMs: 5000,
      apiResponseMs: 2000,
      jsBundleBytes: 2097152,
      imageBytes: 512000,
    };
  }

  return config;
}

// Re-export for backward compatibility
export { resolveTemplate, getByPath } from '../helpers/template.js';
