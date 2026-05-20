# incomplete.fun

Astro version of the site. The canvas experiments are implemented with plain browser TypeScript, not React islands.

## Commands

Run these from `site/`:

```sh
pnpm dev
pnpm build
pnpm preview
```

## Routes

- `/`
- `/symmetry`
- `/voronoi`
- `/escape`
- `/fib/0` through `/fib/100`

The Fibonacci route is statically generated. Increase the range in `src/pages/fib/[n].astro` if more numbered pages are needed.
