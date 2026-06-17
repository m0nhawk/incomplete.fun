export interface Experiment {
  href: string;
  title: string;
  summary: string;
}

export const experiments: Experiment[] = [
  { href: '/cellular', title: 'cellular automata lab', summary: 'local rules, seeds, histories' },
  { href: '/complex', title: 'complex dynamics', summary: 'mandelbrot, julia, orbit traces' },
  { href: '/continued-fractions', title: 'continued fractions', summary: 'expansions, convergents, errors' },
  { href: '/dual', title: 'dual numbers', summary: 'nilpotents, tangents, automatic differentiation' },
  { href: '/fib/10', title: 'fibonacci', summary: 'static bigint sequence sample' },
  { href: '/groups', title: 'finite groups', summary: 'tables, classes, quotients' },
  { href: '/knot', title: 'knot diagrams', summary: 'crossings and polynomial sketches' },
  { href: '/padic', title: 'p-adics', summary: 'digits, inverses, hensel lifts' },
  { href: '/surreal', title: 'surreal numbers', summary: 'cuts and finite birthdays' },
  { href: '/symmetry', title: 'symmetry', summary: 'rotational mirror drawing' },
  { href: '/tropical', title: 'tropical geometry', summary: 'min-plus arithmetic and envelopes' },
  { href: '/voronoi', title: 'voronoi', summary: 'distance fields with mixed metrics' },
];
