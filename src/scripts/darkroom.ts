export function initDarkroom(app: HTMLElement) {
  const button = app.querySelector<HTMLButtonElement>("[data-darkroom]");

  button?.addEventListener("click", async () => {
    const on = !document.body.classList.contains("is-darkroom");
    document.body.classList.toggle("is-darkroom", on);
    button.textContent = on ? "exit darkroom" : "darkroom";
    if (on && app?.requestFullscreen)
      await app.requestFullscreen().catch(() => undefined);
    if (!on && document.fullscreenElement)
      await document.exitFullscreen().catch(() => undefined);
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("is-darkroom");
      if (button) button.textContent = "darkroom";
    }
  });
}
