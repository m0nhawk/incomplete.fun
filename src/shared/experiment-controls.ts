/** Each experiment opts into the controls it implements. No global event bus. */
export interface ExperimentControls {
  pause?: (paused: boolean) => void;
  reset?: () => void;
  randomize?: () => void;
  speed?: (speed: number) => void;
  preset?: (preset: string) => void;
}

export function bindExperimentControls(
  canvas: HTMLCanvasElement,
  controls: ExperimentControls,
): () => void {
  const app = canvas.closest<HTMLElement>(".canvas-app");
  const panel = app?.querySelector<HTMLElement>("[data-control-panel]");
  if (!panel) return () => {};

  const listeners = new AbortController();
  const enabled: (HTMLButtonElement | HTMLInputElement | HTMLSelectElement)[] =
    [];
  const bind = (
    element: HTMLButtonElement | HTMLInputElement | HTMLSelectElement | null,
    event: string,
    callback: () => void,
  ) => {
    if (!element) return;
    element.disabled = false;
    enabled.push(element);
    element.addEventListener(event, callback, { signal: listeners.signal });
  };

  let paused = false;
  const pause = panel.querySelector<HTMLButtonElement>(
    '[data-control-action="pause"]',
  );
  if (controls.pause) {
    controls.pause(paused);
    bind(pause, "click", () => {
      paused = !paused;
      if (pause) pause.textContent = paused ? "play" : "pause";
      controls.pause!(paused);
    });
  }
  for (const action of ["reset", "randomize"] as const) {
    const callback = controls[action];
    if (callback)
      bind(
        panel.querySelector<HTMLButtonElement>(
          `[data-control-action="${action}"]`,
        ),
        "click",
        callback,
      );
  }

  const speed = panel.querySelector<HTMLInputElement>("[data-control-speed]");
  if (speed && controls.speed) {
    const update = () => {
      const value = Number(speed.value);
      controls.speed!(
        Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 1,
      );
    };
    bind(speed, "input", update);
    update();
  }

  const preset = panel.querySelector<HTMLSelectElement>("[data-preset-atlas]");
  if (preset && controls.preset) {
    const slug = (value: string) => value.toLowerCase().replaceAll(" ", "-");
    const initial = new URLSearchParams(window.location.search).get("preset");
    const option = Array.from(preset.options).find(
      (option) => option.value && slug(option.value) === initial,
    );
    if (option) {
      preset.value = option.value;
      controls.preset(option.value);
    }
    bind(preset, "change", () => {
      const url = new URL(window.location.href);
      if (preset.value) url.searchParams.set("preset", slug(preset.value));
      else url.searchParams.delete("preset");
      window.history.replaceState(window.history.state, "", url);
      if (preset.value) controls.preset!(preset.value);
    });
  }

  return () => {
    listeners.abort();
    for (const element of enabled) element.disabled = true;
    if (pause) pause.textContent = "pause";
  };
}
