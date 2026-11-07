import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, unlinkSync, lstatSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const components = ["mods/review", "mods/review-tabs", "tools/review-backend"];
function fixture(t, initialized = true) {
  const root = mkdtempSync(join(tmpdir(), "changes setup "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "herdr-app"), source = join(app, "vendor/herdr-changes");
  const template = join(root, "template"), bin = join(root, "bin"), log = join(root, "calls");
  const script = join(app, "integrations/changes/setup.sh");
  mkdirSync(join(app, "integrations/changes"), { recursive: true });
  mkdirSync(join(app, "vendor"), { recursive: true });
  mkdirSync(bin);
  writeFileSync(log, "");
  copyFileSync(new URL("../integrations/changes/setup.sh", import.meta.url), script);
  const checkout = initialized ? source : template;
  for (const component of components) {
    mkdirSync(join(checkout, component), { recursive: true });
    mkdirSync(join(app, component, ".."), { recursive: true });
    symlinkSync(`../vendor/herdr-changes/${component}`, join(app, component));
  }
  writeFileSync(join(checkout, ".git"), "gitdir: initialized-fixture\n");
  writeFileSync(join(checkout, "mods/review/main.js"), "unsaved development edit\n");
  writeFileSync(join(checkout, "tools/review-backend/build.sh"), '#!/bin/sh\nprintf "build\\n" >> "$LOG"\nexit "${BUILD_EXIT:-0}"\n');
  writeFileSync(join(app, "settings.json"), '{"personal":"unchanged"}\n');
  const tool = (name, text) => writeFileSync(join(bin, name), `#!/bin/sh\n${text}\n`, { mode: 0o755 });
  tool("git", 'printf "git %s\\n" "$*" >> "$LOG"\ncp -R "$TEMPLATE" "$SOURCE"');
  tool("herdr-app", 'printf "herdr-app %s\\n" "$*" >> "$LOG"');
  tool("touch", 'printf "touch %s\\n" "$*" >> "$LOG"');
  return {
    app, source,
    run(extra = {}, args = []) {
      const result = spawnSync("sh", [script, ...args], { encoding: "utf8", env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, LOG: log, TEMPLATE: template, SOURCE: source, ...extra,
      } });
      return { ...result, calls: readFileSync(log, "utf8") };
    },
  };
}

test("Changes setup builds the existing single checkout without resetting edits or touching personal settings", t => {
  const f = fixture(t), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.calls.includes("git "), "initialized checkouts are not checked out or reset");
  assert.equal(readFileSync(join(f.source, "mods/review/main.js"), "utf8"), "unsaved development edit\n");
  assert.equal(readFileSync(join(f.app, "settings.json"), "utf8"), '{"personal":"unchanged"}\n');
  assert.ok(components.every(component => lstatSync(join(f.app, component)).isSymbolicLink()));
  assert.match(result.calls, /build\nherdr-app check .*\/mods\/review\nherdr-app check .*\/mods\/review-tabs\ntouch -h /);
});

test("Changes setup initializes a missing pinned submodule before building/checking/reloading", t => {
  const f = fixture(t, false), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /^git -C .* submodule update --init -- herdr-app\/vendor\/herdr-changes\nbuild\n/);
  assert.ok(!result.calls.includes("--remote"), "restore uses the pinned commit, not an unpinned branch tip");
  assert.match(result.calls, /touch -h .*\/mods\/review .*\/mods\/review-tabs\n$/);
});

test("Changes setup refuses copied software or wrong links instead of overwriting them", t => {
  for (const copied of [true, false]) {
    const f = fixture(t), live = join(f.app, "mods/review");
    unlinkSync(live);
    if (copied) {
      mkdirSync(live);
      writeFileSync(join(live, "personal.txt"), "preserve me");
    } else symlinkSync("review-tabs", live);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, copied ? /Expected a tracked symlink/ : /Wrong symlink target/);
    assert.equal(result.calls, "", "validation precedes builds and reloads");
    if (copied) assert.equal(readFileSync(join(live, "personal.txt"), "utf8"), "preserve me");
  }
});

test("Changes setup stops on build failure without reloading the working app", t => {
  const f = fixture(t), result = f.run({ BUILD_EXIT: "1" });
  assert.notEqual(result.status, 0);
  assert.equal(result.calls, "build\n");
  assert.ok(components.every(component => lstatSync(join(f.app, component)).isSymbolicLink()));
});

test("Changes setup rejects unexpected arguments without side effects", t => {
  const result = fixture(t).run({}, ["--update"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.calls, "");
});
