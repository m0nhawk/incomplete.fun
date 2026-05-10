import { PageLayout } from '../../components/page-layout';

function fib(n: number): bigint {
  if (n <= 0) return 0n;
  if (n === 1) return 1n;
  let a = 0n, b = 1n;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

export default async function Page({ params }: PageProps<'/fib/[n]'>) {
  const { n: raw } = await params;
  const n = parseInt(raw, 10);
  const invalid = isNaN(n) || n < 0;

  return (
    <PageLayout title="fibonacci" back>
      {invalid ? (
        <p>invalid input: <code>{raw}</code></p>
      ) : (
        <p>fib({n}) = <strong>{fib(n).toString()}</strong></p>
      )}
    </PageLayout>
  );
}
