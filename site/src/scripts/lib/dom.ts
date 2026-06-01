export function q<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

export function qAll<T extends HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}
