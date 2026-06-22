export {};

const select = document.querySelector<HTMLSelectElement>('[data-preset-atlas]');

select?.addEventListener('change', () => {
  const preset = select.value;
  if (!preset) return;
  const url = new URL(window.location.href);
  url.searchParams.set('preset', preset.toLowerCase().replaceAll(' ', '-'));
  window.history.replaceState({}, '', url);
  document.body.dataset.preset = preset;
  window.dispatchEvent(new CustomEvent('incomplete:preset', { detail: { preset } }));
});
