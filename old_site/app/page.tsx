import { PageLayout } from './components/page-layout';

export default function Home() {
  return (
    <PageLayout title="incomplete.fun">
      <ul>
        <li><a href="/fib/10">fibonacci</a></li>
        <li><a href="/symmetry">symmetry</a></li>
        <li><a href="/voronoi">voronoi</a></li>
      </ul>
    </PageLayout>
  );
}
