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
  id: string;
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

let nextId = 0;

export function VoronoiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sitesRef = useRef<Site[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const [sites, setSitesState] = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentMetric, setCurrentMetric] = useState<Metric>('euclidean');
  const siteCount = useRef(0);

  const dragRef = useRef<{
    id: string;
    startMouseX: number; startMouseY: number;
    origX: number; origY: number;
    moved: boolean;
  } | null>(null);
  const mouseDownOnSite = useRef(false);

  // Commit new sites to both ref and state
  const commitSites = useCallback((newSites: Site[]) => {
    sitesRef.current = newSites;
    setSitesState(newSites);
  }, []);

  // fast=true: compute at half resolution for smooth dragging
  const render = useCallback((fast = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const currentSites = sitesRef.current;
    const selId = selectedIdRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentSites.length === 0) return;

    const scale = fast ? 2 : 1;
    const cW = Math.ceil(cssW / scale);
    const cH = Math.ceil(cssH / scale);

    const owners = new Int32Array(cW * cH);
    const imageData = new ImageData(cW, cH);
    const data = imageData.data;

    for (let py = 0; py < cH; py++) {
      for (let px = 0; px < cW; px++) {
        let minDist = Infinity;
        let owner = 0;
        const wx = px * scale;
        const wy = py * scale;
        for (let i = 0; i < currentSites.length; i++) {
          const s = currentSites[i];
          const d = metricDist(s.metric, Math.abs(wx - s.x), Math.abs(wy - s.y));
          if (d < minDist) { minDist = d; owner = i; }
        }
        owners[py * cW + px] = owner;
        const idx = (py * cW + px) * 4;
        data[idx]     = currentSites[owner].r;
        data[idx + 1] = currentSites[owner].g;
        data[idx + 2] = currentSites[owner].b;
        data[idx + 3] = 255;
      }
    }

    // darken cell borders
    for (let py = 1; py < cH - 1; py++) {
      for (let px = 1; px < cW - 1; px++) {
        const o = owners[py * cW + px];
        if (
          owners[(py - 1) * cW + px] !== o ||
          owners[(py + 1) * cW + px] !== o ||
          owners[py * cW + (px - 1)] !== o ||
          owners[py * cW + (px + 1)] !== o
        ) {
          const idx = (py * cW + px) * 4;
          data[idx]     *= 0.25;
          data[idx + 1] *= 0.25;
          data[idx + 2] *= 0.25;
        }
      }
    }

    const offscreen = new OffscreenCanvas(cW, cH);
    offscreen.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = fast ? 'low' : 'high';
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    // draw site markers
    ctx.save();
    ctx.scale(dpr, dpr);

    for (const site of currentSites) {
      const isSelected = site.id === selId;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(site.x, site.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(site.x, site.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(site.x, site.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(site.x, site.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(METRIC_LABEL[site.metric], site.x + 9, site.y + 4);
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
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    render(false);
  }, [sites, render]);

  const getPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findNear = (x: number, y: number, r = 14): Site | null => {
    let best: Site | null = null;
    let bestD = r;
    for (const s of sitesRef.current) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  };

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

    const { x, y } = getPos(e);
    const near = findNear(x, y);

    if (near) {
      selectedIdRef.current = near.id;
      setSelectedId(near.id);
      dragRef.current = { id: near.id, startMouseX: x, startMouseY: y, origX: near.x, origY: near.y, moved: false };
      mouseDownOnSite.current = true;
      render(false);
    } else {
      selectedIdRef.current = null;
      setSelectedId(null);
      mouseDownOnSite.current = false;
      dragRef.current = null;
    }
  }, [render]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;

    // update cursor based on proximity to a site (when not dragging)
    if (!dragRef.current) {
      const canvas = canvasRef.current;
      if (canvas && (e.target as HTMLElement).tagName === 'CANVAS') {
        const { x, y } = getPos(e);
        container!.style.cursor = findNear(x, y) ? 'grab' : 'crosshair';
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const drag = dragRef.current;
    const { x, y } = getPos(e);
    const dx = x - drag.startMouseX;
    const dy = y - drag.startMouseY;

    if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      drag.moved = true;
      container!.style.cursor = 'grabbing';
    }
    if (!drag.moved) return;

    const nx = Math.max(0, Math.min(canvas.clientWidth, drag.origX + dx));
    const ny = Math.max(0, Math.min(canvas.clientHeight, drag.origY + dy));
    sitesRef.current = sitesRef.current.map(s => s.id === drag.id ? { ...s, x: nx, y: ny } : s);
    render(true);
  }, [render]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    containerRef.current!.style.cursor = 'crosshair';

    if (dragRef.current) {
      if (dragRef.current.moved) {
        // commit the dragged position and re-render at full res
        setSitesState([...sitesRef.current]);
      }
      dragRef.current = null;
      return;
    }

    if (!mouseDownOnSite.current && (e.target as HTMLElement).tagName === 'CANVAS') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = getPos(e);
      const hue = (siteCount.current * 137.508) % 360;
      const [r, g, b] = hslToRgb(hue, 60, 68);
      const id = String(nextId++);
      siteCount.current++;
      const newSite: Site = { id, x, y, metric: currentMetric, r, g, b };
      const newSites = [...sitesRef.current, newSite];
      selectedIdRef.current = id;
      setSelectedId(id);
      commitSites(newSites);
    }
  }, [currentMetric, commitSites]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    const { x, y } = getPos(e);
    const near = findNear(x, y);
    if (!near) return;
    if (selectedIdRef.current === near.id) {
      selectedIdRef.current = null;
      setSelectedId(null);
    }
    commitSites(sitesRef.current.filter(s => s.id !== near.id));
  }, [commitSites]);

  const applyMetric = useCallback((m: Metric) => {
    setCurrentMetric(m);
    if (selectedIdRef.current) {
      commitSites(sitesRef.current.map(s =>
        s.id === selectedIdRef.current ? { ...s, metric: m } : s
      ));
    }
  }, [commitSites]);

  // Which metric to highlight in the toolbar
  const activeMetric = selectedId
    ? (sites.find(s => s.id === selectedId)?.metric ?? currentMetric)
    : currentMetric;

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
            onClick={() => applyMetric(m)}
            title={METRIC_DESC[m]}
            style={{
              background: activeMetric === m ? 'var(--accent)' : 'none',
              border: `1px solid ${activeMetric === m ? 'var(--accent)' : 'var(--border)'}`,
              color: activeMetric === m ? '#fff' : 'var(--fg)',
              fontFamily: 'var(--mono)', fontSize: '0.8rem',
              padding: '0.15rem 0.55rem', cursor: 'pointer', borderRadius: '2px',
            }}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}

        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
          {selectedId ? 'drag · change metric · right-click removes' : 'click to place · right-click removes'}
        </span>
        <button
          onClick={() => {
            selectedIdRef.current = null;
            setSelectedId(null);
            siteCount.current = 0;
            commitSites([]);
          }}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
            fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.1rem 0.6rem', cursor: 'pointer',
          }}
        >
          clear
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
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
