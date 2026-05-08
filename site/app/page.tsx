import { PageLayout } from './components/page-layout';

export default function Home() {
  return (
    <PageLayout>
      <h1>Pages</h1>
      <ul>
        <li><a href="/fib/10">Fibonacci</a></li>
        <li><a href="/symmetry">Symmetry canvas</a></li>
        <li><a href="/voronoi">Voronoi (mixed metrics)</a></li>
      </ul>
    </PageLayout>
  );
}
