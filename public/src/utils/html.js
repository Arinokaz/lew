const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const ATTR_ESCAPE_MAP = {
  "&": "&amp;",
  '"': "&quot;",
};

export function escapeHtml(input) {
  if (input == null) return "";
  return String(input).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

export function escapeAttr(input) {
  if (input == null) return "";
  return String(input).replace(/[&"]/g, (ch) => ATTR_ESCAPE_MAP[ch]);
}