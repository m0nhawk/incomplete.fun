'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface Point { x: number; y: number }

export function SymmetryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const strokeSnapshot = useRef<ImageData | null>(null);

  const [segments, setSegments] = useState(6);
  const [mirror, setMirror] = useState(false);
  const [color, setColor] = useState('#4d9fff');
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    const stored = localStorage.getItem('symmetry-n');
    if (stored) setSegments(Math.max(1, Math.min(36, parseInt(stored) || 6)));
  }, []);

  useEffect(() => {
    localStorage.setItem('symmetry-n', String(segments));
  }, [segments]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) observer.observe(canvasRef.current.parentElement);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;
    const canvas = ctx.canvas;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const angle = (Math.PI * 2) / segments;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawPath = (flip: boolean) => {
      ctx.beginPath();
      const px = (p: Point) => p.x - cx;
      const py = (p: Point) => flip ? -(p.y - cy) : (p.y - cy);

      ctx.moveTo(px(points[0]), py(points[0]));
      for (let i = 0; i < points.length - 1; i++) {
        const mid = {
          x: (px(points[i]) + px(points[i + 1])) / 2,
          y: (py(points[i]) + py(points[i + 1])) / 2,
        };
        ctx.quadraticCurveTo(px(points[i]), py(points[i]), mid.x, mid.y);
      }
      ctx.lineTo(px(points[points.length - 1]), py(points[points.length - 1]));
      ctx.stroke();
    };

    for (let i = 0; i < segments; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * i);
      drawPath(false);
      if (mirror) drawPath(true);
      ctx.restore();
    }
  }, [segments, mirror, color, lineWidth]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    currentPoints.current = [getPoint(e)];
    strokeSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !strokeSnapshot.current) return;
    currentPoints.current.push(getPoint(e));
    ctx.putImageData(strokeSnapshot.current, 0, 0);
    drawStroke(ctx, currentPoints.current);
  }, [drawStroke]);

  const onEnd = useCallback(() => {
    drawing.current = false;
    currentPoints.current = [];
    strokeSnapshot.current = null;
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap', fontSize: '0.85rem', fontFamily: 'var(--mono)',
      }}>
        <a href="/" style={{ color: 'var(--muted)', textDecoration: 'none', marginRight: '0.5rem', fontSize: '1.1rem' }}>←</a>
        <span style={{ fontWeight: 'bold' }}>symmetry</span>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--fg)' }}>
          n=
          <input type="number" min={1} max={36} value={segments}
            onChange={e => setSegments(Math.max(1, Math.min(36, parseInt(e.target.value) || 1)))}
            style={{ width: '3rem', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.1rem 0.3rem' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--fg)' }}>
          <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          mirror
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--fg)' }}>
          color
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: '2rem', height: '1.4rem', border: '1px solid var(--border)', padding: 0, background: 'none', cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--fg)' }}>
          width
          <input type="range" min={1} max={20} value={lineWidth}
            onChange={e => setLineWidth(parseInt(e.target.value))}
            style={{ accentColor: 'var(--accent)', width: '5rem' }}
          />
          <span style={{ color: 'var(--muted)', minWidth: '1.5rem' }}>{lineWidth}</span>
        </label>

        <button onClick={clear} style={{
          background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
          fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.1rem 0.6rem', cursor: 'pointer',
        }}>clear</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        />
      </div>
    </div>
  );
}
