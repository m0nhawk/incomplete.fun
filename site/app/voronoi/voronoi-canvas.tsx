'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

type Metric = 'euclidean' | 'manhattan' | 'chebyshev' | 'minkowski3' | 'minkowski05';

const METRICS: Metric[] = ['euclidean', 'manhattan', 'chebyshev', 'minkowski3', 'minkowski05'];
const METRIC_LABEL: Record<Metric, string> = {
  euclidean: 'L2', manhattan: 'L1', chebyshev: 'L∞', minkowski3: 'L3', minkowski05: 'L½',
};
const METRIC_DESC: Record<Metric, string> = {
  euclidean:   'euclidean (circular)',
  manhattan:   'manhattan (diamond)',
  chebyshev:   'chebyshev (square)',
  minkowski3:  'minkowski p=3 (rounded square)',
  minkowski05: 'minkowski p=½ (star)',
};
const METRIC_INDEX: Record<Metric, number> = {
  euclidean: 0, manhattan: 1, chebyshev: 2, minkowski3: 3, minkowski05: 4,
};

interface Site {
  id: string;
  x: number; y: number;
  metric: Metric;
  r: number; g: number; b: number;
}

function metricDistJS(m: Metric, ax: number, ay: number): number {
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

// ── WebGL shaders ─────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Fragment shader: per-pixel Voronoi with smooth anti-aliased borders.
// Each site has its own distance metric; boundaries are where two sites tie.
// The gap between d1 (nearest) and d2 (second-nearest) is 0 exactly on the
// boundary and grows away from it — used for smooth border darkening.
const FRAG = `#version 300 es
precision highp float;

const int MAX = 64;

uniform vec2  u_res;
uniform int   u_n;
uniform vec2  u_sites[MAX];
uniform vec3  u_colors[MAX];
uniform int   u_metrics[MAX];

out vec4 fragColor;

float vdist(int m, float ax, float ay) {
  if (m == 0) return sqrt(ax*ax + ay*ay);          // L2  euclidean
  if (m == 1) return ax + ay;                       // L1  manhattan
  if (m == 2) return max(ax, ay);                   // L∞  chebyshev
  if (m == 3) return pow(ax*ax*ax + ay*ay*ay, 1.0/3.0); // L3
  float s = sqrt(ax) + sqrt(ay); return s*s;        // L½  minkowski
}

void main() {
  if (u_n == 0) { fragColor = vec4(0.0); return; }

  // gl_FragCoord origin is bottom-left; sites are top-left CSS coords × dpr
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);

  float d1 = 1e9, d2 = 1e9;
  int owner = 0;

  for (int i = 0; i < MAX; i++) {
    if (i >= u_n) break;
    float d = vdist(u_metrics[i], abs(p.x - u_sites[i].x), abs(p.y - u_sites[i].y));
    if (d < d1) { d2 = d1; d1 = d; owner = i; }
    else if (d < d2) { d2 = d; }
  }

  // Convert gap from metric units to pixel distance by dividing by the gradient
  // magnitude. dFdx/dFdy give adjacent-fragment differences for free on the GPU.
  // Without this, borders widen where the gap opens slowly (oblique boundaries
  // between different metrics) and narrow where it opens fast.
  float gap = d2 - d1;
  float grad = length(vec2(dFdx(gap), dFdy(gap)));
  float borderDist = gap / max(grad, 1e-6);
  float border = smoothstep(0.0, 1.5, borderDist);
  fragColor = vec4(u_colors[owner] * mix(0.22, 1.0, border), 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  return s;
}

let nextId = 0;

export function VoronoiCanvas() {
  // Two stacked canvases: WebGL for Voronoi cells, 2D for site markers.
  const glCanvasRef     = useRef<HTMLCanvasElement>(null);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);

  // WebGL state
  const glRef   = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const uRef    = useRef<Record<string, WebGLUniformLocation | null>>({});

  const sitesRef      = useRef<Site[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const [sites, setSitesState]   = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentMetric, setCurrentMetric] = useState<Metric>('euclidean');
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const siteCount = useRef(0);

  const dragRef = useRef<{
    id: string; startMouseX: number; startMouseY: number;
    origX: number; origY: number; moved: boolean;
  } | null>(null);
  const mouseDownOnSite = useRef(false);

  const commitSites = useCallback((next: Site[]) => {
    sitesRef.current = next;
    setSitesState(next);
  }, []);

  // ── WebGL init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;
    glRef.current = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    progRef.current = prog;

    // Fullscreen quad (two triangles)
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1,
    ]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uRef.current = {
      res:     gl.getUniformLocation(prog, 'u_res'),
      n:       gl.getUniformLocation(prog, 'u_n'),
      sites:   gl.getUniformLocation(prog, 'u_sites'),
      colors:  gl.getUniformLocation(prog, 'u_colors'),
      metrics: gl.getUniformLocation(prog, 'u_metrics'),
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderGL = useCallback(() => {
    const gl   = glRef.current;
    const prog = progRef.current;
    const u    = uRef.current;
    const canvas = glCanvasRef.current;
    if (!gl || !prog || !canvas) return;

    const dpr   = window.devicePixelRatio || 1;
    const sites = sitesRef.current;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1i(u.n, sites.length);

    if (sites.length > 0) {
      const sv = new Float32Array(sites.length * 2);
      const cv = new Float32Array(sites.length * 3);
      const mv = new Int32Array(sites.length);
      for (let i = 0; i < sites.length; i++) {
        sv[i * 2]     = sites[i].x * dpr;
        sv[i * 2 + 1] = sites[i].y * dpr;
        cv[i * 3]     = sites[i].r / 255;
        cv[i * 3 + 1] = sites[i].g / 255;
        cv[i * 3 + 2] = sites[i].b / 255;
        mv[i]         = METRIC_INDEX[sites[i].metric];
      }
      gl.uniform2fv(u.sites,   sv);
      gl.uniform3fv(u.colors,  cv);
      gl.uniform1iv(u.metrics, mv);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, []);

  const renderMarkers = useCallback(() => {
    const canvas = markerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const sites = sitesRef.current;
    const selId = selectedIdRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    for (const site of sites) {
      if (site.id === selId) {
        ctx.beginPath();
        ctx.arc(site.x, site.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(site.x, site.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth   = 1;
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

      ctx.font      = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(METRIC_LABEL[site.metric], site.x + 9, site.y + 4);
    }

    ctx.restore();
  }, []);

  const render = useCallback(() => {
    renderGL();
    renderMarkers();
  }, [renderGL, renderMarkers]);

  // ── Resize ──────────────────────────────────────────────────────────────────
  const resizeCanvases = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const w   = container.clientWidth;
    const h   = container.clientHeight;
    for (const c of [glCanvasRef.current, markerCanvasRef.current]) {
      if (!c) continue;
      c.width        = w * dpr;
      c.height       = h * dpr;
      c.style.width  = `${w}px`;
      c.style.height = `${h}px`;
    }
    render();
  }, [render]);

  useEffect(() => {
    resizeCanvases();
    const obs = new ResizeObserver(resizeCanvases);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [resizeCanvases]);

  useEffect(() => {
    sitesRef.current = sites;
    render();
  }, [sites, render]);

  // ── Interaction helpers ──────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent) => {
    const r = glCanvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const findNear = (x: number, y: number, r = 14): Site | null => {
    let best: Site | null = null, bestD = r;
    for (const s of sitesRef.current) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  };

  // ── Event handlers ───────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const { x, y } = getPos(e);
    const near = findNear(x, y);
    if (near) {
      selectedIdRef.current = near.id;
      setSelectedId(near.id);
      dragRef.current = { id: near.id, startMouseX: x, startMouseY: y, origX: near.x, origY: near.y, moved: false };
      mouseDownOnSite.current = true;
      renderMarkers();
    } else {
      selectedIdRef.current = null;
      setSelectedId(null);
      mouseDownOnSite.current = false;
      dragRef.current = null;
      renderMarkers();
    }
  }, [renderMarkers]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current!;
    const { x, y } = getPos(e);
    setMousePos({ x, y });
    if (!dragRef.current) {
      container.style.cursor = findNear(x, y) ? 'grab' : 'crosshair';
      return;
    }
    const drag = dragRef.current;
    const dx = x - drag.startMouseX, dy = y - drag.startMouseY;
    if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      drag.moved = true;
      container.style.cursor = 'grabbing';
    }
    if (!drag.moved) return;
    const canvas = glCanvasRef.current!;
    const nx = Math.max(0, Math.min(canvas.clientWidth,  drag.origX + dx));
    const ny = Math.max(0, Math.min(canvas.clientHeight, drag.origY + dy));
    sitesRef.current = sitesRef.current.map(s => s.id === drag.id ? { ...s, x: nx, y: ny } : s);
    render();
  }, [render]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    containerRef.current!.style.cursor = 'crosshair';
    if (dragRef.current) {
      if (dragRef.current.moved) setSitesState([...sitesRef.current]);
      dragRef.current = null;
      return;
    }
    if (!mouseDownOnSite.current) {
      const { x, y } = getPos(e);
      const hue = (siteCount.current * 137.508) % 360;
      const [r, g, b] = hslToRgb(hue, 60, 68);
      const id = String(nextId++);
      siteCount.current++;
      const newSite: Site = { id, x, y, metric: currentMetric, r, g, b };
      selectedIdRef.current = id;
      setSelectedId(id);
      commitSites([...sitesRef.current, newSite]);
    }
  }, [currentMetric, commitSites]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const near = findNear(x, y);
    if (!near) return;
    if (selectedIdRef.current === near.id) { selectedIdRef.current = null; setSelectedId(null); }
    commitSites(sitesRef.current.filter(s => s.id !== near.id));
  }, [commitSites]);

  const applyMetric = useCallback((m: Metric) => {
    setCurrentMetric(m);
    if (selectedIdRef.current) {
      commitSites(sitesRef.current.map(s => s.id === selectedIdRef.current ? { ...s, metric: m } : s));
    }
  }, [commitSites]);

  const activeMetric = selectedId
    ? (sites.find(s => s.id === selectedId)?.metric ?? currentMetric)
    : currentMetric;

  // Per-site distances at the current mouse position, for the toolbar annotation.
  const hover = mousePos && sites.length > 0
    ? sites.map(s => ({
        s,
        d: metricDistJS(s.metric, Math.abs(mousePos.x - s.x), Math.abs(mousePos.y - s.y)),
      }))
    : null;
  const hoverMin = hover ? Math.min(...hover.map(h => h.d)) : Infinity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      {/* ── main toolbar row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
        fontSize: '0.85rem', fontFamily: 'var(--mono)',
      }}>
        <a href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>←</a>
        <span style={{ fontWeight: 'bold' }}>voronoi</span>
        <span style={{ color: 'var(--border)' }}>|</span>

        {METRICS.map(m => (
          <button key={m} onClick={() => applyMetric(m)} title={METRIC_DESC[m]} style={{
            background: activeMetric === m ? 'var(--accent)' : 'none',
            border:     `1px solid ${activeMetric === m ? 'var(--accent)' : 'var(--border)'}`,
            color:      activeMetric === m ? '#fff' : 'var(--fg)',
            fontFamily: 'var(--mono)', fontSize: '0.8rem',
            padding: '0.15rem 0.55rem', cursor: 'pointer', borderRadius: '2px',
          }}>
            {METRIC_LABEL[m]}
          </button>
        ))}

        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
          {selectedId ? 'drag · change metric · right-click removes' : 'click to place · right-click removes'}
        </span>
        <button onClick={() => { selectedIdRef.current = null; setSelectedId(null); siteCount.current = 0; commitSites([]); }} style={{
          background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
          fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.1rem 0.6rem', cursor: 'pointer',
        }}>clear</button>
      </div>

      {/* ── hover annotation row (always visible for stable layout) ── */}
      <div style={{
        display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
        gap: '0.3rem 0.75rem',
        padding: '0.35rem 1rem', borderBottom: '1px solid var(--border)',
        fontSize: '0.78rem', fontFamily: 'var(--mono)',
        minHeight: '1.9rem',
      }}>
        {hover && (
          <>
            <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              ({Math.round(mousePos!.x)}, {Math.round(mousePos!.y)})
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            {hover.map(({ s, d }) => {
              const winner = d === hoverMin;
              return (
                <span key={s.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  color: winner ? 'var(--fg)' : 'var(--muted)',
                  fontWeight: winner ? 'bold' : 'normal',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    display: 'inline-block', width: '7px', height: '7px',
                    borderRadius: '50%', flexShrink: 0,
                    background: `rgb(${s.r},${s.g},${s.b})`,
                    boxShadow: winner ? '0 0 0 1.5px var(--fg)' : 'none',
                  }} />
                  <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{METRIC_LABEL[s.metric]}</span>
                  {Math.round(d)}
                  {winner && <span style={{ color: 'var(--accent)' }}>◀</span>}
                </span>
              );
            })}
          </>
        )}
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setMousePos(null)}
        onContextMenu={onContextMenu}
      >
        {/* WebGL canvas: Voronoi cells at full physical resolution */}
        <canvas ref={glCanvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
        {/* 2D canvas: site markers (transparent, non-interactive) */}
        <canvas ref={markerCanvasRef} style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }} />

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
