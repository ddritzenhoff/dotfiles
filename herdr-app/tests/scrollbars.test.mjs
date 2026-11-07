import assert from "node:assert/strict";
import { test } from "node:test";
import { FocusScrollbars, scrollbarsForFocus } from "../mods/my-status/scrollbars.js";

function fixture(initial = { zoom: 1, sounds: { enabled: true } }) {
  const state = { text: JSON.stringify(initial), writes: 0 };
  const write = async (next, expected) => {
    assert.equal(state.text, expected, "stale snapshot");
    state.text = next;
    state.writes++;
  };
  const controller = new FocusScrollbars(async () => state.text, write);
  const apply = async show => {
    if (controller.request(show)) await controller.flush();
  };
  return { state, controller, apply, write };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("hides for reported agents and known agent programs; shows for ordinary terminals", () => {
  const terminals = [
    { address: "t1", program: { agent: true } },
    { address: "t2", program: { shell: true } },
    { address: "remote/t3" },
  ];
  assert.equal(scrollbarsForFocus({ terminal: "t1" }, [], terminals), false);
  assert.equal(scrollbarsForFocus({ terminal: "t2" }, [], terminals), true);
  assert.equal(scrollbarsForFocus({ terminal: "remote/t3" }, [{ address: "remote/t3" }], terminals), false);
  assert.equal(scrollbarsForFocus({ terminal: "t2", shown: "t1" }, [], terminals), false);
  assert.equal(scrollbarsForFocus(null, [], terminals), null);
  assert.equal(scrollbarsForFocus({ terminal: null }, [], terminals), null);
  assert.equal(scrollbarsForFocus({ terminal: "missing" }, [], terminals), null);
});

test("focus switches update only the scrollbar flag, with no writes on routine redraws", async () => {
  const { controller, state, apply } = fixture();
  await apply(false);
  assert.deepEqual(JSON.parse(state.text), { zoom: 1, sounds: { enabled: true }, pane_scrollbars: false });
  for (let i = 0; i < 20; i++) await apply(false);
  assert.equal(state.writes, 1);
  await apply(null);
  assert.equal(state.writes, 1);
  await apply(true);
  assert.equal(JSON.parse(state.text).pane_scrollbars, true);
  await controller.restore();
  assert.deepEqual(JSON.parse(state.text), { zoom: 1, sounds: { enabled: true } });
  assert.equal(controller.request(false), false);
});

test("shell focus with default settings needs no write", async () => {
  const { state, apply, controller } = fixture();
  await apply(true);
  assert.equal(state.writes, 0);
  await controller.restore();
  assert.equal(state.writes, 0);
});

test("restores a previously explicit preference", async () => {
  const { state, apply, controller } = fixture({ pane_scrollbars: false, zoom: 2 });
  await apply(true);
  await controller.restore();
  assert.deepEqual(JSON.parse(state.text), { pane_scrollbars: false, zoom: 2 });
});

test("compare-and-swap retries preserve simultaneous settings edits", async () => {
  const { state, controller, apply, write } = fixture();
  let first = true;
  controller.write = async (next, expected) => {
    if (first) {
      first = false;
      state.text = JSON.stringify({ zoom: 1.5, font: "Example" });
      throw new Error("stale snapshot");
    }
    await write(next, expected);
  };
  await apply(false);
  assert.deepEqual(JSON.parse(state.text), { zoom: 1.5, font: "Example", pane_scrollbars: false });
  await controller.restore();
  assert.deepEqual(JSON.parse(state.text), { zoom: 1.5, font: "Example" });
});

test("a focus change during a read skips an obsolete write", async () => {
  const { state, controller, apply } = fixture();
  const gate = deferred();
  let first = true;
  controller.read = async () => {
    if (first) { first = false; await gate.promise; }
    return state.text;
  };
  const task = apply(false);
  assert.equal(controller.request(true), false); // Existing task handles newest focus.
  gate.resolve();
  await task;
  assert.equal(state.writes, 0);
});

test("cleanup does not overwrite a later manual choice", async () => {
  const { state, controller, apply } = fixture();
  await apply(false);
  state.text = JSON.stringify({ zoom: 2, pane_scrollbars: true });
  await controller.restore();
  assert.deepEqual(JSON.parse(state.text), { zoom: 2, pane_scrollbars: true });
});

test("cleanup wins even if a native write was already in flight", async () => {
  const { state, controller, apply, write } = fixture();
  const started = deferred();
  const gate = deferred();
  let first = true;
  controller.write = async (next, expected) => {
    if (first) { first = false; started.resolve(); await gate.promise; }
    await write(next, expected);
  };
  const task = apply(false);
  await started.promise;
  await controller.restore();
  gate.resolve();
  await task;
  assert.deepEqual(JSON.parse(state.text), { zoom: 1, sounds: { enabled: true } });
});

test("invalid settings are never overwritten or retried on every redraw", async () => {
  const { state, controller, apply } = fixture();
  state.text = "{";
  await assert.rejects(apply(false), SyntaxError);
  assert.equal(state.text, "{");
  assert.equal(state.writes, 0);
  assert.equal(controller.request(false), false);
});
