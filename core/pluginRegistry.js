/**
 * Plugin-based architecture: each capability registers itself and declares
 * which config keys it consumes. The runner loads only plugins whose config
 * sections are present (or always-on plugins like api/ui when legacy keys exist).
 */

const plugins = new Map();

export function registerPlugin(plugin) {
  if (!plugin.id || !plugin.register) {
    throw new Error('Plugin must have id and register() function');
  }
  plugins.set(plugin.id, plugin);
}

export function getPlugin(id) {
  return plugins.get(id);
}

export function getAllPlugins() {
  return [...plugins.values()];
}

/**
 * Returns plugins that should run for this config, sorted by priority.
 */
export function getActivePlugins(config, options = {}) {
  const { only = null, tags = null } = options;
  const active = [];

  for (const plugin of plugins.values()) {
    if (only && !only.includes(plugin.id)) continue;
    if (plugin.isEnabled && !plugin.isEnabled(config)) continue;
    active.push(plugin);
  }

  active.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  return active;
}

export async function loadPlugins() {
  // Core plugins — order matters for priority
  const modules = [
    '../plugins/api/index.js',
    '../plugins/ui/index.js',
    '../plugins/workflows/index.js',
    '../plugins/forms/index.js',
    '../plugins/validators/index.js',
    '../plugins/tables/index.js',
    '../plugins/navigation/index.js',
    '../plugins/uiHealth/index.js',
    '../plugins/network/index.js',
    '../plugins/performance/index.js',
    '../plugins/visual/index.js',
    '../plugins/responsive/index.js',
    '../plugins/roles/index.js',
    '../plugins/files/index.js',
    '../plugins/notifications/index.js',
    '../plugins/search/index.js',
    '../plugins/dashboard/index.js',
    '../plugins/accessibility/index.js',
    '../plugins/links/index.js',
    '../plugins/persistence/index.js',
    '../plugins/testData/index.js',
  ];

  for (const mod of modules) {
    const plugin = await import(mod);
    if (plugin.default) registerPlugin(plugin.default);
  }
}
