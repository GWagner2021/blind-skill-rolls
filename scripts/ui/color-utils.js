export function parseHexAlpha(hex) {
    const s = String(hex ?? "").trim();
    const m8 = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
    if (m8)
        return { rgb: "#" + m8[1].toLowerCase(), alpha: parseInt(m8[2], 16) };
    const m6 = s.match(/^#([0-9a-f]{6})$/i);
    if (m6)
        return { rgb: "#" + m6[1].toLowerCase(), alpha: 255 };
    return { rgb: "#000000", alpha: 255 };
}
export function toHexAlpha(rgb, alpha) {
    const base = String(rgb ?? "#000000").replace(/^#/, "").slice(0, 6).padStart(6, "0");
    const a = Math.max(0, Math.min(255, Math.round(Number(alpha) ?? 255)));
    return "#" + base.toLowerCase() + a.toString(16).padStart(2, "0");
}
export function alphaToPercent(alpha) {
    return Math.round((alpha / 255) * 100) + "%";
}
