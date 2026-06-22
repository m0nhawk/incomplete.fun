# incomplete.fun

Astro version of the site. The canvas experiments are implemented with plain browser TypeScript, not React islands.

## Commands

Run these from the repository root:

```sh
bun run dev
bun run build
bun run preview
```

## Routes

- `/`
- `/padic`
- `/groups`
- `/tropical`
- `/cellular`
- `/surreal`
- `/symmetry`
- `/voronoi`
- `/fib/0` through `/fib/100`

The Fibonacci route is statically generated. Increase the range in `src/pages/fib/[n].astro` if more numbered pages are needed.
