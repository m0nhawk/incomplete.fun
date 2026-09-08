import assert from "node:assert/strict";
import { test } from "node:test";
import { bindExperimentControls } from "../src/shared/experiment-controls.ts";
// A small DOM boundary double using real EventTargets and abortable listeners.
class Control extends EventTarget {
  disabled = true;
  value = "";
  textContent = "pause";
  options = [
    { value: "" },
    { value: "quiet lattice" },
    { value: "golden bloom" },
  ];
}
function fixture() {
  const pause = new Control(),
    reset = new Control(),
    randomize = new Control();
  const speed = new Control(),
    preset = new Control();
  speed.value = "1";
  const controls = new Map([
    ['[data-control-action="pause"]', pause],
    ['[data-control-action="reset"]', reset],
    ['[data-control-action="randomize"]', randomize],
    ["[data-control-speed]", speed],
    ["[data-preset-atlas]", preset],
  ]);
  const panel = { querySelector: (selector) => controls.get(selector) ?? null };
  const app = { querySelector: () => panel };
  const canvas = { closest: () => app };
  return { canvas, pause, reset, randomize, speed, preset };
}
function click(control) {
  control.dispatchEvent(new Event("click"));
}
test("callbacks and pause state stay within their experiment", () => {
  const a = fixture(),
    b = fixture();
  const statesA = [],
    statesB = [];
  let resets = 0,
    randomizations = 0;
  bindExperimentControls(a.canvas, {
    pause: (value) => statesA.push(value),
    reset: () => resets++,
    randomize: () => randomizations++,
  });
  bindExperimentControls(b.canvas, { pause: (value) => statesB.push(value) });
  click(a.pause);
  click(a.reset);
  click(a.randomize);
  assert.deepEqual(statesA, [false, true]);
  assert.deepEqual(statesB, [false]);
  assert.equal(a.pause.textContent, "play");
  assert.equal(b.pause.textContent, "pause");
  assert.equal(resets, 1);
  assert.equal(randomizations, 1);
  assert.equal(a.speed.disabled, true);
  assert.equal(b.reset.disabled, true);
  click(a.pause);
  assert.deepEqual(statesA, [false, true, false]);
});
test("speed initializes synchronously and updates independently of animation frames", () => {
  const f = fixture(),
    values = [];
  f.speed.value = "0.5";
  bindExperimentControls(f.canvas, { speed: (value) => values.push(value) });
  for (const value of ["0", "2", "10", "invalid"]) {
    f.speed.value = value;
    f.speed.dispatchEvent(new Event("input"));
  }
  assert.deepEqual(values, [0.5, 0, 2, 2, 1]);
  assert.equal(f.speed.disabled, false);
});
test("preset initialization and custom selection preserve unrelated URL state", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  let location = new URL(
    "https://incomplete.fun/fourier?preset=quiet-lattice&keep=yes#drawing",
  );
  const historyState = { retained: true };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get location() {
        return location;
      },
      history: {
        state: historyState,
        replaceState(state, _title, url) {
          assert.equal(state, historyState);
          location = new URL(url);
        },
      },
    },
  });
  try {
    const f = fixture(),
      presets = [];
    bindExperimentControls(f.canvas, {
      preset: (value) => presets.push(value),
    });
    assert.equal(f.preset.value, "quiet lattice");
    assert.deepEqual(presets, ["quiet lattice"]);
    f.preset.value = "golden bloom";
    f.preset.dispatchEvent(new Event("change"));
    assert.equal(location.searchParams.get("preset"), "golden-bloom");
    f.preset.value = "";
    f.preset.dispatchEvent(new Event("change"));
    assert.equal(location.searchParams.has("preset"), false);
    assert.equal(location.searchParams.get("keep"), "yes");
    assert.equal(location.hash, "#drawing");
    assert.deepEqual(presets, ["quiet lattice", "golden bloom"]);
    location.searchParams.set("preset", "unknown");
    const other = fixture();
    bindExperimentControls(other.canvas, {
      preset: () => assert.fail("unknown preset applied"),
    });
    assert.equal(other.preset.value, "");
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("cleanup detaches callbacks and permits rebinding", () => {
  const f = fixture();
  let oldCalls = 0,
    newCalls = 0;
  const dispose = bindExperimentControls(f.canvas, { reset: () => oldCalls++ });
  click(f.reset);
  dispose();
  dispose();
  assert.equal(f.reset.disabled, true);
  click(f.reset);
  bindExperimentControls(f.canvas, { reset: () => newCalls++ });
  click(f.reset);
  assert.equal(oldCalls, 1);
  assert.equal(newCalls, 1);
  const detached = { closest: () => null };
  assert.doesNotThrow(() => bindExperimentControls(detached, {})());
});
