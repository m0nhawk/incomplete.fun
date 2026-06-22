export {};

const layer = document.querySelector<HTMLElement>('[data-equation-wallpaper]');
const formulas = (layer?.dataset.formulas || 'π,e,i,∞,∑,∫,φ').split(',').map((s) => s.trim()).filter(Boolean);

if (layer) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 28; i++) {
    const span = document.createElement('span');
    span.textContent = formulas[i % formulas.length];
    span.style.left = `${(i * 37) % 101}%`;
    span.style.top = `${(i * 53) % 101}%`;
    span.style.animationDelay = `${-(i * 1.7)}s`;
    span.style.animationDuration = `${18 + (i % 7) * 3}s`;
    span.style.fontSize = `${0.8 + (i % 5) * 0.28}rem`;
    fragment.append(span);
  }
  layer.append(fragment);
}
