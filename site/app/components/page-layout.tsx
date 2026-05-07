interface PageLayoutProps {
  children: React.ReactNode;
  accent?: string;
}

export function PageLayout({ children, accent }: PageLayoutProps) {
  return (
    <main
      className="page"
      style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}
    >
      {children}
    </main>
  );
}
