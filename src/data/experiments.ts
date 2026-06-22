export interface Experiment {
  href: string;
  title: string;
  summary: string;
}

export const experiments: Experiment[] = [
  { href: '/cellular', title: 'cellular automata lab', summary: 'local rules, seeds, histories' },
  { href: '/complex', title: 'complex dynamics', summary: 'mandelbrot, julia, orbit traces' },
  { href: '/continued-fractions', title: 'continued fractions', summary: 'expansions, convergents, errors' },
  { href: '/chu-spaces', title: 'Chu spaces', summary: 'dual tables, tests, morphisms' },
  { href: '/dual', title: 'dual numbers', summary: 'nilpotents, tangents, automatic differentiation' },
  { href: '/fib/10', title: 'fibonacci', summary: 'static bigint sequence sample' },
  { href: '/fourier', title: 'Fourier epicycle sketcher', summary: 'draw, decompose, replay with epicycles' },
  { href: '/groups', title: 'finite groups', summary: 'tables, classes, quotients' },
  { href: '/hyperbolic', title: 'hyperbolic tessellation explorer', summary: 'poincaré disk, {p,q} tilings, geodesics' },
  { href: '/knot', title: 'knot diagrams', summary: 'crossings and polynomial sketches' },
  { href: '/lsystem', title: 'L-system garden', summary: 'rewrite rules, turtle paths, fractal plants' },
  { href: '/modular', title: 'modular multiplication circles', summary: 'residue chords, primitive roots, cycles' },
  { href: '/padic', title: 'p-adics', summary: 'digits, inverses, hensel lifts' },
  { href: '/penrose', title: 'Penrose tiling studio', summary: 'inflation, matching rules, aperiodic tiles' },
  { href: '/reaction-diffusion', title: 'reaction-diffusion lab', summary: 'gray-scott patterns, feed/kill map' },
  { href: '/surreal', title: 'surreal numbers', summary: 'cuts and finite birthdays' },
  { href: '/symmetry', title: 'symmetry', summary: 'rotational mirror drawing' },
  { href: '/tropical', title: 'tropical geometry', summary: 'min-plus arithmetic and envelopes' },
  { href: '/voronoi', title: 'voronoi', summary: 'distance fields with mixed metrics' },
];
