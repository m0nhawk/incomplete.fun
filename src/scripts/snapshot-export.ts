export function initSnapshotExport(app: HTMLElement) {
  function download(name: string, href: string): void {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  }

  app.querySelector("[data-export-png]")?.addEventListener("click", () => {
    const canvas = app.querySelector<HTMLCanvasElement>(
      ".canvas-stage canvas, canvas",
    );
    if (canvas)
      download("incomplete-fun-snapshot.png", canvas.toDataURL("image/png"));
    else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2200"><rect width="100%" height="100%" fill="white"/><text x="80" y="140" font-family="monospace" font-size="72">${document.title}</text><text x="80" y="240" font-family="monospace" font-size="36">${location.href}</text></svg>`;
      download(
        "incomplete-fun-poster.svg",
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      );
    }
  });

  app.querySelector("[data-copy-url]")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(location.href);
  });
}
