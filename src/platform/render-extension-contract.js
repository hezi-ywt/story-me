const RENDER_PLUGIN_MANIFEST_SCHEMA = Object.freeze({
  required: ["id", "version", "commands"],
  commandRequired: ["name", "input", "output", "status", "errors"],
});

function validateRenderPluginManifest(manifest) {
  const errors = [];
  for (const key of RENDER_PLUGIN_MANIFEST_SCHEMA.required) {
    if (!manifest?.[key]) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  if (manifest?.commands && !Array.isArray(manifest.commands)) {
    errors.push("commands must be an array");
  }

  if (Array.isArray(manifest?.commands)) {
    for (const command of manifest.commands) {
      for (const key of RENDER_PLUGIN_MANIFEST_SCHEMA.commandRequired) {
        if (!command?.[key]) {
          errors.push(`Missing command field: ${key}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

class RenderPluginRegistry {
  constructor() {
    this.plugins = new Map();
  }

  register(manifest) {
    const validation = validateRenderPluginManifest(manifest);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }
    this.plugins.set(manifest.id, manifest);
  }

  get(id) {
    return this.plugins.get(id) ?? null;
  }

  list() {
    return [...this.plugins.values()];
  }
}

export { RENDER_PLUGIN_MANIFEST_SCHEMA, RenderPluginRegistry, validateRenderPluginManifest };
