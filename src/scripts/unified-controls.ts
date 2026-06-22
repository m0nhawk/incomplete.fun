export {};

const panel = document.querySelector<HTMLElement>('[data-control-panel]');

panel?.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-control-action]');
  if (!button) return;
  const action = button.dataset.controlAction;
  if (action === 'pause') {
    const paused = document.body.toggleAttribute('data-paused');
    button.textContent = paused ? 'play' : 'pause';
    window.dispatchEvent(new CustomEvent('incomplete:pause', { detail: { paused } }));
  }
  if (action === 'reset') window.dispatchEvent(new CustomEvent('incomplete:reset'));
  if (action === 'randomize') window.dispatchEvent(new CustomEvent('incomplete:randomize'));
});
