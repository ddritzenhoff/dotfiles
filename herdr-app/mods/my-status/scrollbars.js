// Herdr exposes one global flag, so this follows the focused terminal and
// necessarily affects every pane/window using the same app home.
export function scrollbarsForFocus(focus, agents, terminals) {
  const address = focus?.shown ?? focus?.terminal;
  if (!address) return null; // Dialogs/mods/no focus: retain the last decision.
  const terminal = terminals.find(item => item.address === address);
  if (!terminal) return null; // Reconnecting: do not guess.
  return !(agents.some(agent => agent.address === address) || terminal.program?.agent === true);
}

export class FocusScrollbars {
  constructor(read, write) {
    this.read = read;
    this.write = write;
    this.target = null;
    this.attempted = null;
    this.running = false;
    this.closed = false;
    this.baseline = null;
    this.written = null;
  }

  // The caller starts a task only when this returns true. Re-renders caused
  // by our settings write do not recursively trigger more writes.
  request(show) {
    if (this.closed || show === null) return false;
    this.target = show;
    if (this.running || this.attempted === show) return false;
    this.running = true;
    return true;
  }

  async flush() {
    try {
      while (!this.closed && this.target !== this.attempted) {
        const target = this.target;
        this.attempted = target;
        await this.patch(target);
      }
    } finally {
      this.running = false;
    }
  }

  async patch(show, restoring = false) {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      const source = await this.read();
      if (!restoring && (this.closed || show !== this.target)) return;
      const settings = source === null ? {} : JSON.parse(source);
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new Error("settings.json must contain an object; scrollbar setting left unchanged");
      }
      const hasFlag = Object.prototype.hasOwnProperty.call(settings, "pane_scrollbars");
      if (!this.baseline) this.baseline = { present: hasFlag, value: settings.pane_scrollbars };
      if (restoring) {
        // Preserve manual changes made since our last write.
        if (this.written === null || settings.pane_scrollbars !== this.written) return;
        if (this.baseline.present) settings.pane_scrollbars = this.baseline.value;
        else delete settings.pane_scrollbars;
      } else {
        if ((settings.pane_scrollbars ?? true) === show) return;
        settings.pane_scrollbars = show;
      }
      try {
        // Compare-and-swap protects simultaneous changes from Settings/agents.
        await this.write(`${JSON.stringify(settings, null, 2)}\n`, source);
        if (!restoring) {
          this.written = show;
          // A native write may have been in flight when cleanup started.
          if (this.closed) await this.patch(null, true);
        }
        return;
      } catch (error) {
        failure = error;
        // Re-read before retrying; never overwrite a newer unrelated setting.
      }
    }
    throw failure;
  }

  async restore() {
    this.closed = true;
    if (this.baseline) await this.patch(null, true);
  }
}
