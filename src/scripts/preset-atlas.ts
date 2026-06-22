export {};

const select = document.querySelector<HTMLSelectElement>('[data-preset-atlas]');

if (select) {
  const preset = new URLSearchParams(window.location.search).get('preset');
  const option = Array.from(select.options).find((item) => item.value.toLowerCase().replaceAll(' ', '-') === preset);
  if (option) {
    select.value = option.value;
    document.body.dataset.preset = option.value;
  }
}

select?.addEventListener('change', () => {
  const preset = select.value;
  if (!preset) return;
  const url = new URL(window.location.href);
  url.searchParams.set('preset', preset.toLowerCase().replaceAll(' ', '-'));
  window.history.replaceState({}, '', url);
  document.body.dataset.preset = preset;
  window.dispatchEvent(new CustomEvent('incomplete:preset', { detail: { preset } }));
});
