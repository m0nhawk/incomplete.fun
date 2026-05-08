interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  accent?: string;
}

export function PageLayout({ children, title, back = false, accent }: PageLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
        fontSize: '0.85rem', fontFamily: 'var(--mono)',
      }}>
        {back && <a href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>←</a>}
        {title && <span style={{ fontWeight: 'bold' }}>{title}</span>}
      </div>
      <main
        className="page"
        style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}
      >
        {children}
      </main>
    </div>
  );
}
