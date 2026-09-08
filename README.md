# incomplete.fun

A static Astro site of mathematical experiments. Interactive pages use plain browser TypeScript.

## Development

Use the existing `devenv shell` for Node and Bun, then run commands from the repository root:

```sh
bun install
bun run dev
bun run check
bun run lint
bun run test
bun run build
bun run preview
```

## Architecture

- `src/pages/`: Astro routes, experiment markup, and page-specific styles. Each interactive page imports its own experiment script; there is no runtime route registry or eager loading of other experiments.
- `src/experiments/`: one browser entry point per experiment, owning its inputs, mathematical state, rendering, and animation.
- `src/shared/`: reusable TypeScript helpers. `markup.ts` handles safe generated markup; `experiment-controls.ts` connects experiments to shared controls with typed callbacks.
- `src/layouts/`: document and page composition. `BaseLayout` owns metadata and global CSS, `PageLayout` wraps regular pages, and `CanvasLayout` composes the canvas shell.
- `src/components/`: reusable markup, including the toolbar, shared experiment controls, and statically rendered equation wallpaper.
- `src/scripts/`: site UI behavior. `canvas-shell.ts` explicitly initializes snapshot export and darkroom for each canvas app. Landing and gallery animations remain available for pages that opt into them.
- `src/data/experiments.ts`: the home page's experiment catalog and preset names.
- `tests/`: focused tests for the shared controls boundary using Node's built-in test runner.

Dependencies flow from routes and layouts into experiments and site UI, then into shared helpers. Experiments do not import one another. Keep mathematics specific to an experiment in its module until there is a concrete reuse case.

## Adding an experiment

1. Add `src/pages/<name>.astro` using `PageLayout` or `CanvasLayout`.
2. Add its browser code in `src/experiments/<name>.ts` and import it in the page's `<script>` block.
3. Add the route, title, and summary to `src/data/experiments.ts`.
4. For shared canvas controls, call `bindExperimentControls(canvas, callbacks)` after initializing the experiment state. Supply only the supported callbacks: `pause`, `reset`, `randomize`, `speed`, and `preset`. Unsupported controls stay disabled. Pause, speed, and a valid URL preset initialize synchronously during binding; the returned function removes listeners when needed.

Shared controls are scoped to the canvas's `.canvas-app`. Preset selection and URL synchronization are owned by the controls helper; experiments interpret preset names. Avoid window events or body attributes for experiment state.

The Fibonacci pages are statically generated at `/fib/0` through `/fib/100`. Change the range in `src/pages/fib/[n].astro` to generate more.
