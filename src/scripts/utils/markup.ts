export type SvgAttributes = Record<string, string | number>;

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function svg(tag: string, attrs: SvgAttributes, children = ""): string {
  const attrText = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(String(value))}"`).join(" ");
  return attrText ? `<${tag} ${attrText}>${children}</${tag}>` : `<${tag}>${children}</${tag}>`;
}
