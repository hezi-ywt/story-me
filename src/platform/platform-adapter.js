class PlatformAdapter {
  async readText(_path) {
    throw new Error("Not implemented");
  }

  async writeText(_path, _content) {
    throw new Error("Not implemented");
  }

  async listEntries(_root, _options = {}) {
    throw new Error("Not implemented");
  }

  watchPath(_root, _onEvent) {
    throw new Error("Not implemented");
  }

  async probeMedia(_path) {
    throw new Error("Not implemented");
  }
}

export { PlatformAdapter };
