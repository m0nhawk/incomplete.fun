export {};

const select = document.querySelector<HTMLSelectElement>('[data-theme-select]');
const saved = localStorage.getItem('incomplete-theme') || 'default';

document.documentElement.dataset.theme = saved;
if (select) select.value = saved;

select?.addEventListener('change', () => {
  const theme = select.value;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('incomplete-theme', theme);
});
