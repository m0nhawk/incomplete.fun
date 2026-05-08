'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

type Metric = 'euclidean' | 'manhattan' | 'chebyshev' | 'minkowski3' | 'minkowski05';

const METRICS: Metric[] = ['euclidean', 'manhattan', 'chebyshev', 'minkowski3', 'minkowski05'];
const METRIC_LABEL: Record<Metric, string> = {
  euclidean:   'L2',
  manhattan:   'L1',
  chebyshev:   'L∞',
  minkowski3:  'L3',
  minkowski05: 'L½',
};
const METRIC_DESC: Record<Metric, string> = {
  euclidean:   'euclidean (circular)',
  manhattan:   'manhattan (diamond)',
  chebyshev:   'chebyshev (square)',
  minkowski3:  'minkowski p=3 (rounded square)',
  minkowski05: 'minkowski p=½ (star)',
};

interface Site {
  x: number; y: number;
  metric: Metric;
  r: number; g: number; b: number;
}

function metricDist(m: Metric, ax: number, ay: number): number {
  switch (m) {
    case 'euclidean':   return Math.sqrt(ax * ax + ay * ay);
    case 'manhattan':   return ax + ay;
    case 'chebyshev':   return Math.max(ax, ay);
    case 'minkowski3':  return Math.cbrt(ax * ax * ax + ay * ay * ay);
    case 'minkowski05': { const s = Math.sqrt(ax) + Math.sqrt(ay); return s * s; }
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function VoronoiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sitesRef = useRef<Site[]>([]);
  const [sites, setSitesState] = useState<Site[]>([]);
  const [currentMetric, setCurrentMetric] = useState<Metric>('euclidean');
  const siteCount = useRef(0);
  const [computing, setComputing] = useState(false);

  const setSites = useCallback((updater: Site[] | ((prev: Site[]) => Site[])) => {
    setSitesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sitesRef.current = next;
      return next;
    });
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const currentSites = sitesRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentSites.length === 0) return;

    const owners = new Int32Array(cssW * cssH);
    const imageData = new ImageData(cssW, cssH);
    const data = imageData.data;

    for (let py = 0; py < cssH; py++) {
      for (let px = 0; px < cssW; px++) {
        let minDist = Infinity;
        let owner = 0;
        for (let i = 0; i < currentSites.length; i++) {
          const s = currentSites[i];
          const d = metricDist(s.metric, Math.abs(px - s.x), Math.abs(py - s.y));
          if (d < minDist) { minDist = d; owner = i; }
        }
        owners[py * cssW + px] = owner;
        const idx = (py * cssW + px) * 4;
        data[idx]     = currentSites[owner].r;
        data[idx + 1] = currentSites[owner].g;
        data[idx + 2] = currentSites[owner].b;
        data[idx + 3] = 255;
      }
    }

    // darken cell borders
    for (let py = 1; py < cssH - 1; py++) {
      for (let px = 1; px < cssW - 1; px++) {
        const o = owners[py * cssW + px];
        if (
          owners[(py - 1) * cssW + px] !== o ||
          owners[(py + 1) * cssW + px] !== o ||
          owners[py * cssW + (px - 1)] !== o ||
          owners[py * cssW + (px + 1)] !== o
        ) {
          const idx = (py * cssW + px) * 4;
          data[idx]     = data[idx]     * 0.25;
          data[idx + 1] = data[idx + 1] * 0.25;
          data[idx + 2] = data[idx + 2] * 0.25;
        }
      }
    }

    // scale up to physical canvas via offscreen
    const offscreen = new OffscreenCanvas(cssW, cssH);
    offscreen.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    // draw site markers
    ctx.save();
    ctx.scale(dpr, dpr);
    for (const site of currentSites) {
      ctx.beginPath();
      ctx.arc(site.x, site.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(site.x, site.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.font = 'bold 11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
      const label = METRIC_LABEL[site.metric];
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(label, site.x + 9, site.y + 4);
    }
    ctx.restore();
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    render();
  }, [render]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) observer.observe(canvasRef.current.parentElement);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    sitesRef.current = sites;
    if (sites.length === 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    setComputing(true);
    // defer to allow React to flush the computing indicator
    setTimeout(() => {
      render();
      setComputing(false);
    }, 0);
  }, [sites, render]);

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hue = (siteCount.current * 137.508) % 360;
    const [r, g, b] = hslToRgb(hue, 60, 68);
    siteCount.current++;

    setSites(prev => [...prev, { x, y, metric: currentMetric, r, g, b }]);
  }, [currentMetric, setSites]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSites(prev => prev.filter(s => Math.hypot(s.x - x, s.y - y) > 12));
  }, [setSites]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap', fontSize: '0.85rem', fontFamily: 'var(--mono)',
      }}>
        <a href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>←</a>
        <span style={{ fontWeight: 'bold' }}>voronoi</span>
        <span style={{ color: 'var(--border)' }}>|</span>

        {METRICS.map(m => (
          <button
            key={m}
            onClick={() => setCurrentMetric(m)}
            title={METRIC_DESC[m]}
            style={{
              background: currentMetric === m ? 'var(--accent)' : 'none',
              border: `1px solid ${currentMetric === m ? 'var(--accent)' : 'var(--border)'}`,
              color: currentMetric === m ? '#fff' : 'var(--fg)',
              fontFamily: 'var(--mono)', fontSize: '0.8rem',
              padding: '0.15rem 0.55rem', cursor: 'pointer', borderRadius: '2px',
            }}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}

        {computing && (
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>computing…</span>
        )}

        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
          right-click removes
        </span>
        <button
          onClick={() => { setSites([]); siteCount.current = 0; }}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
            fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.1rem 0.6rem', cursor: 'pointer',
          }}
        >
          clear
        </button>
      </div>

      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <canvas ref={canvasRef} style={{ display: 'block', cursor: 'crosshair' }} />
        {sites.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '0.4rem',
            color: 'var(--muted)', fontFamily: 'var(--mono)', pointerEvents: 'none',
          }}>
            <span>click to place points</span>
            <span style={{ fontSize: '0.75rem' }}>each point uses its own distance metric</span>
          </div>
        )}
      </div>
    </div>
  );
}
