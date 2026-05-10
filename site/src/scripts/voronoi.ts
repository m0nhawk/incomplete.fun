export {};

type Metric = "euclidean" | "manhattan" | "chebyshev" | "minkowski3" | "minkowski05";

interface Site {
  id: string;
  x: number;
  y: number;
  metric: Metric;
  r: number;
  g: number;
  b: number;
}

const METRIC_LABEL: Record<Metric, string> = {
  euclidean: "L2",
  manhattan: "L1",
  chebyshev: "L∞",
  minkowski3: "L3",
  minkowski05: "L½",
};

const METRIC_FORMULA: Record<Metric, string> = {
  euclidean: "sqrt(dx² + dy²)",
  manhattan: "dx + dy",
  chebyshev: "max(dx, dy)",
  minkowski3: "(dx³ + dy³)^(1/3)",
  minkowski05: "(sqrt(dx) + sqrt(dy))²",
};

const METRIC_GENERIC_CALC: Record<Metric, string> = {
  euclidean: "sqrt(x² + y²)",
  manhattan: "x + y",
  chebyshev: "max(x, y)",
  minkowski3: "(x³ + y³)^(1/3)",
  minkowski05: "(sqrt(x) + sqrt(y))²",
};

const METRIC_INDEX: Record<Metric, number> = {
  euclidean: 0,
  manhattan: 1,
  chebyshev: 2,
  minkowski3: 3,
  minkowski05: 4,
};

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

const int MAX = 64;

uniform vec2  u_res;
uniform float u_dpr;
uniform int   u_n;
uniform vec2  u_sites[MAX];
uniform vec3  u_colors[MAX];
uniform int   u_metrics[MAX];

out vec4 fragColor;

float vdist(int m, float ax, float ay) {
  if (m == 0) return sqrt(ax*ax + ay*ay);
  if (m == 1) return ax + ay;
  if (m == 2) return max(ax, ay);
  if (m == 3) return pow(ax*ax*ax + ay*ay*ay, 1.0/3.0);
  float s = sqrt(ax) + sqrt(ay); return s*s;
}

vec2 vdist_grad(int m, vec2 dp) {
  float ax = abs(dp.x), ay = abs(dp.y);
  float sx = sign(dp.x), sy = sign(dp.y);
  if (m == 0) {
    float d = sqrt(ax*ax + ay*ay);
    return d < 1e-7 ? vec2(0.0) : dp / d;
  }
  if (m == 1) return vec2(sx, sy);
  if (m == 2) {
    if (ax > ay) return vec2(sx, 0.0);
    if (ay > ax) return vec2(0.0, sy);
    return vec2(sx, sy) * 0.5;
  }
  if (m == 3) {
    float d3 = ax*ax*ax + ay*ay*ay;
    float d  = pow(d3, 1.0/3.0);
    return d < 1e-7 ? vec2(0.0) : vec2(sx*ax*ax, sy*ay*ay) / (d*d);
  }
  float sax = sqrt(max(ax, 1e-7)), say = sqrt(max(ay, 1e-7));
  float sum = sqrt(ax) + sqrt(ay);
  return vec2(ax < 1e-7 ? 0.0 : sx * sum / sax,
              ay < 1e-7 ? 0.0 : sy * sum / say);
}

void main() {
  if (u_n == 0) { fragColor = vec4(0.0); return; }

  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);

  float d1 = 1e9, d2 = 1e9;
  int owner = 0, owner2 = 0;

  for (int i = 0; i < MAX; i++) {
    if (i >= u_n) break;
    float d = vdist(u_metrics[i], abs(p.x - u_sites[i].x), abs(p.y - u_sites[i].y));
    if (d < d1) { d2 = d1; owner2 = owner; d1 = d; owner = i; }
    else if (d < d2) { d2 = d; owner2 = i; }
  }

  float gap = d2 - d1;
  vec2 g1 = vdist_grad(u_metrics[owner],  p - u_sites[owner]);
  vec2 g2 = vdist_grad(u_metrics[owner2], p - u_sites[owner2]);
  float grad = max(length(g2 - g1), 1e-4);
  float borderDist = gap / grad;
  float border = smoothstep(0.0, 1.5 * u_dpr, borderDist);
  fragColor = vec4(u_colors[owner] * mix(0.22, 1.0, border), 1.0);
}
`;

const glCanvas = document.querySelector<HTMLCanvasElement>("#voronoi-gl");
const markerCanvas = document.querySelector<HTMLCanvasElement>("#voronoi-markers");
const stage = document.querySelector<HTMLDivElement>("#voronoi-stage");
const clearButton = document.querySelector<HTMLButtonElement>("#voronoi-clear");
const help = document.querySelector<HTMLElement>("#voronoi-help");
const coords = document.querySelector<HTMLElement>("#voronoi-coords");
const distances = document.querySelector<HTMLElement>("#voronoi-distances");
const empty = document.querySelector<HTMLElement>("#voronoi-empty");
const metricButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".metric-button"));

if (glCanvas && markerCanvas && stage && clearButton && help && coords && distances && empty) {
  const gl = glCanvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
  const markerCtx = markerCanvas.getContext("2d");

  if (gl && markerCtx) {
    let nextId = 0;
    let siteCount = 0;
    let sites: Site[] = [];
    let selectedId: string | null = null;
    let currentMetric: Metric = "euclidean";
    let mousePos: { x: number; y: number } | null = null;
    let drag: {
      id: string;
      startMouseX: number;
      startMouseY: number;
      origX: number;
      origY: number;
      moved: boolean;
    } | null = null;
    let mouseDownOnSite = false;

    const prog = gl.createProgram();
    if (!prog) throw new Error("Unable to create WebGL program");

    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      res: gl.getUniformLocation(prog, "u_res"),
      dpr: gl.getUniformLocation(prog, "u_dpr"),
      n: gl.getUniformLocation(prog, "u_n"),
      sites: gl.getUniformLocation(prog, "u_sites"),
      colors: gl.getUniformLocation(prog, "u_colors"),
      metrics: gl.getUniformLocation(prog, "u_metrics"),
    };

    function compileShader(glContext: WebGL2RenderingContext, type: number, src: string) {
      const shader = glContext.createShader(type);
      if (!shader) throw new Error("Unable to create WebGL shader");
      glContext.shaderSource(shader, src);
      glContext.compileShader(shader);
      return shader;
    }

    function metricDist(m: Metric, ax: number, ay: number): number {
      switch (m) {
        case "euclidean": return Math.sqrt(ax * ax + ay * ay);
        case "manhattan": return ax + ay;
        case "chebyshev": return Math.max(ax, ay);
        case "minkowski3": return Math.cbrt(ax * ax * ax + ay * ay * ay);
        case "minkowski05": {
          const s = Math.sqrt(ax) + Math.sqrt(ay);
          return s * s;
        }
      }
    }

    function fmt(n: number): string {
      return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
    }

    function metricCalculation(m: Metric, dx: number, dy: number): string {
      const d = metricDist(m, dx, dy);
      const x = fmt(dx);
      const y = fmt(dy);
      const v = fmt(d);
      switch (m) {
        case "euclidean": return `sqrt(${x}² + ${y}²) = ${v}`;
        case "manhattan": return `${x} + ${y} = ${v}`;
        case "chebyshev": return `max(${x}, ${y}) = ${v}`;
        case "minkowski3": return `(${x}³ + ${y}³)^(1/3) = ${v}`;
        case "minkowski05": return `(sqrt(${x}) + sqrt(${y}))² = ${v}`;
      }
    }

    function hslToRgb(h: number, s: number, l: number): [number, number, number] {
      s /= 100;
      l /= 100;
      const k = (n: number) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }

    function renderGL() {
      const dpr = window.devicePixelRatio || 1;

      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.uniform2f(uniforms.res, glCanvas.width, glCanvas.height);
      gl.uniform1f(uniforms.dpr, dpr);
      gl.uniform1i(uniforms.n, sites.length);

      if (sites.length > 0) {
        const sv = new Float32Array(sites.length * 2);
        const cv = new Float32Array(sites.length * 3);
        const mv = new Int32Array(sites.length);
        for (let i = 0; i < sites.length; i++) {
          sv[i * 2] = sites[i].x * dpr;
          sv[i * 2 + 1] = sites[i].y * dpr;
          cv[i * 3] = sites[i].r / 255;
          cv[i * 3 + 1] = sites[i].g / 255;
          cv[i * 3 + 2] = sites[i].b / 255;
          mv[i] = METRIC_INDEX[sites[i].metric];
        }
        gl.uniform2fv(uniforms.sites, sv);
        gl.uniform3fv(uniforms.colors, cv);
        gl.uniform1iv(uniforms.metrics, mv);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function renderMarkers() {
      const dpr = window.devicePixelRatio || 1;

      markerCtx.clearRect(0, 0, markerCanvas.width, markerCanvas.height);
      markerCtx.save();
      markerCtx.scale(dpr, dpr);

      for (const site of sites) {
        if (site.id === selectedId) {
          markerCtx.beginPath();
          markerCtx.arc(site.x, site.y, 11, 0, Math.PI * 2);
          markerCtx.strokeStyle = "#fff";
          markerCtx.lineWidth = 2.5;
          markerCtx.stroke();
          markerCtx.beginPath();
          markerCtx.arc(site.x, site.y, 11, 0, Math.PI * 2);
          markerCtx.strokeStyle = "rgba(0,0,0,0.4)";
          markerCtx.lineWidth = 1;
          markerCtx.stroke();
        }

        markerCtx.beginPath();
        markerCtx.arc(site.x, site.y, 6, 0, Math.PI * 2);
        markerCtx.fillStyle = "rgba(0,0,0,0.45)";
        markerCtx.fill();

        markerCtx.beginPath();
        markerCtx.arc(site.x, site.y, 4, 0, Math.PI * 2);
        markerCtx.fillStyle = "#fff";
        markerCtx.fill();

        markerCtx.font = "bold 11px ui-monospace, monospace";
        markerCtx.fillStyle = "rgba(0,0,0,0.7)";
        markerCtx.fillText(METRIC_LABEL[site.metric], site.x + 9, site.y + 4);
      }

      markerCtx.restore();
    }

    function render() {
      renderGL();
      renderMarkers();
      renderControls();
      renderHover();
      empty.style.display = sites.length === 0 ? "flex" : "none";
    }

    function resizeCanvases() {
      const dpr = window.devicePixelRatio || 1;
      const w = stage.clientWidth;
      const h = stage.clientHeight;

      for (const canvas of [glCanvas, markerCanvas]) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      render();
    }

    function getPos(e: MouseEvent) {
      const rect = glCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    function findNear(x: number, y: number, r = 14): Site | null {
      let best: Site | null = null;
      let bestD = r;
      for (const site of sites) {
        const d = Math.hypot(site.x - x, site.y - y);
        if (d < bestD) {
          bestD = d;
          best = site;
        }
      }
      return best;
    }

    function activeMetric() {
      if (!selectedId) return currentMetric;
      return sites.find((site) => site.id === selectedId)?.metric ?? currentMetric;
    }

    function renderControls() {
      const active = activeMetric();
      for (const button of metricButtons) {
        button.classList.toggle("is-active", button.dataset.metric === active);
      }
      help.textContent = selectedId ? "drag · change metric · right-click removes" : "click to place · right-click removes";
    }

    function renderHover() {
      coords.style.visibility = mousePos ? "visible" : "hidden";
      coords.textContent = mousePos ? `(${Math.round(mousePos.x)}, ${Math.round(mousePos.y)})` : "(0, 0)";
      distances.replaceChildren();

      if (sites.length === 0) return;

      const hover = mousePos
        ? sites.map((site) => ({
          site,
          d: metricDist(site.metric, Math.abs(mousePos!.x - site.x), Math.abs(mousePos!.y - site.y)),
        }))
        : null;
      const hoverMin = hover ? Math.min(...hover.map((item) => item.d)) : Infinity;
      const entries = hover ?? sites.map((site) => ({ site, d: null as number | null }));

      for (const { site, d } of entries) {
        const winner = d !== null && d === hoverMin;
        const content = mousePos
          ? metricCalculation(site.metric, Math.abs(mousePos.x - site.x), Math.abs(mousePos.y - site.y))
          : METRIC_GENERIC_CALC[site.metric];

        const entry = document.createElement("span");
        entry.className = `distance-entry${winner ? " is-winner" : ""}`;
        entry.title = mousePos
          ? `dx=${fmt(Math.abs(mousePos.x - site.x))}, dy=${fmt(Math.abs(mousePos.y - site.y))}; ${METRIC_LABEL[site.metric]}: ${METRIC_FORMULA[site.metric]}`
          : `${METRIC_LABEL[site.metric]}: ${METRIC_FORMULA[site.metric]}`;

        const dot = document.createElement("span");
        dot.className = "distance-dot";
        dot.style.background = `rgb(${site.r}, ${site.g}, ${site.b})`;
        dot.style.boxShadow = winner ? "0 0 0 1.5px var(--fg)" : "none";

        const label = document.createElement("span");
        label.className = "distance-label";
        label.textContent = METRIC_LABEL[site.metric];

        const value = document.createElement("span");
        value.className = "distance-value";
        value.textContent = content;

        entry.append(dot, label, value);
        if (winner) {
          const marker = document.createElement("span");
          marker.textContent = "◀";
          marker.style.color = "var(--accent)";
          marker.style.flexShrink = "0";
          entry.append(marker);
        }

        distances.append(entry);
      }
    }

    function setSelected(id: string | null) {
      selectedId = id;
      renderControls();
      renderMarkers();
    }

    stage.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const { x, y } = getPos(e);
      const near = findNear(x, y);

      if (near) {
        setSelected(near.id);
        drag = { id: near.id, startMouseX: x, startMouseY: y, origX: near.x, origY: near.y, moved: false };
        mouseDownOnSite = true;
      } else {
        setSelected(null);
        mouseDownOnSite = false;
        drag = null;
      }
    });

    stage.addEventListener("mousemove", (e) => {
      const { x, y } = getPos(e);
      mousePos = { x, y };

      if (!drag) {
        stage.style.cursor = findNear(x, y) ? "grab" : "crosshair";
        renderHover();
        return;
      }

      const dx = x - drag.startMouseX;
      const dy = y - drag.startMouseY;
      if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        drag.moved = true;
        stage.style.cursor = "grabbing";
      }
      if (!drag.moved) return;

      const nx = Math.max(0, Math.min(glCanvas.clientWidth, drag.origX + dx));
      const ny = Math.max(0, Math.min(glCanvas.clientHeight, drag.origY + dy));
      sites = sites.map((site) => site.id === drag?.id ? { ...site, x: nx, y: ny } : site);
      render();
    });

    stage.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      stage.style.cursor = "crosshair";

      if (drag) {
        drag = null;
        return;
      }

      if (!mouseDownOnSite) {
        const { x, y } = getPos(e);
        const hue = (siteCount * 137.508) % 360;
        const [r, g, b] = hslToRgb(hue, 60, 68);
        const id = String(nextId++);
        siteCount++;
        sites = [...sites, { id, x, y, metric: currentMetric, r, g, b }];
        setSelected(id);
        render();
      }
    });

    stage.addEventListener("mouseleave", () => {
      mousePos = null;
      renderHover();
    });

    stage.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const { x, y } = getPos(e);
      const near = findNear(x, y);
      if (!near) return;
      if (selectedId === near.id) selectedId = null;
      sites = sites.filter((site) => site.id !== near.id);
      render();
    });

    for (const button of metricButtons) {
      button.addEventListener("click", () => {
        const metric = button.dataset.metric as Metric | undefined;
        if (!metric) return;
        currentMetric = metric;
        if (selectedId) {
          sites = sites.map((site) => site.id === selectedId ? { ...site, metric } : site);
        }
        render();
      });
    }

    clearButton.addEventListener("click", () => {
      selectedId = null;
      siteCount = 0;
      sites = [];
      render();
    });

    resizeCanvases();
    const observer = new ResizeObserver(resizeCanvases);
    observer.observe(stage);
  }
}
