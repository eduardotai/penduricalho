export function shadeColor(color: string, amount: number): string {
  if (!color.startsWith("#")) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const f = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }
  if (color.startsWith("rgb(")) {
    const nums = color.slice(4, -1).split(",").map((n) => parseInt(n.trim(), 10));
    return `rgba(${nums[0]},${nums[1]},${nums[2]},${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}
