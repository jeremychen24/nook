// Small SVG charts for the Stats tab. Each is one series, so one color and no legend;
// thin bars with a rounded end, hairline grid, labels only on the values that matter,
// a tap/hover target per bar (data-tip), and a screen-reader table with every value.

import { fmtMinutes, fmtHour } from './stats.js';

const W = 340;
const BAR = '#bf8540'; // amber, checked for the dark surface with the dataviz validator
const DIM = '#4a4d55';
const GRID = '#30333a';
const INK = '#e9e6e1';
const MUTED = '#8d9199';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Bar growing up from `base` with 4px rounded top corners and a square bottom.
function column(x, top, w, base, color) {
  const r = Math.min(4, (base - top) / 2, w / 2);
  return `<path fill="${color}" d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z"/>`;
}

// Bar growing right from `x0` with a rounded right end.
function row(x0, y, len, h, color) {
  const r = Math.min(4, len / 2, h / 2);
  return `<path fill="${color}" d="M${x0},${y}H${x0 + len - r}Q${x0 + len},${y} ${x0 + len},${y + r}V${y + h - r}Q${x0 + len},${y + h} ${x0 + len - r},${y + h}H${x0}Z"/>`;
}

function niceStep(max) {
  return [15, 30, 60, 120, 180, 240, 360, 480].find(step => max / step <= 3) ?? 600;
}

function table(caption, head, rows) {
  return `<table class="sr-only"><caption>${esc(caption)}</caption><tr><th>${head[0]}</th><th>${head[1]}</th></tr>${
    rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
}

// Minutes per day for the last seven days; today and the best day get their values on the cap.
export function weekChart(days) {
  const H = 156;
  const left = 32;
  const top = 18;
  const base = 128;
  const max = Math.max(...days.map(d => d.minutes), 1);
  const step = niceStep(max);
  const yMax = Math.ceil(max / step) * step;
  const y = m => base - (m / yMax) * (base - top);
  const band = (W - left) / days.length;
  const best = days.reduce((b, d, i) => (d.minutes > days[b].minutes ? i : b), 0);

  let svg = '';
  for (let m = 0; m <= yMax; m += step) {
    svg += `<line x1="${left}" x2="${W}" y1="${y(m)}" y2="${y(m)}" stroke="${GRID}" stroke-width="1"/>`;
    svg += `<text x="${left - 6}" y="${y(m) + 3.5}" text-anchor="end" font-size="10" fill="${MUTED}" class="num">${m ? fmtMinutes(m) : '0'}</text>`;
  }
  days.forEach((d, i) => {
    const cx = left + band * (i + 0.5);
    const isToday = i === days.length - 1;
    if (d.minutes > 0) svg += column(cx - 11, y(d.minutes), 22, base, BAR);
    if (d.minutes > 0 && (isToday || i === best)) {
      svg += `<text x="${cx}" y="${y(d.minutes) - 5}" text-anchor="middle" font-size="10" fill="${INK}">${fmtMinutes(d.minutes)}</text>`;
    }
    svg += `<text x="${cx}" y="${base + 16}" text-anchor="middle" font-size="11" fill="${isToday ? INK : MUTED}">${isToday ? 'Today' : d.label}</text>`;
    svg += `<rect x="${cx - band / 2}" y="${top - 10}" width="${band}" height="${base - top + 10}" fill="transparent" data-tip="${isToday ? 'Today' : d.label} · ${fmtMinutes(d.minutes)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus minutes per day, last 7 days">${svg}</svg>${
    table('Focus per day, last 7 days', ['Day', 'Focus'], days.map((d, i) => [i === days.length - 1 ? 'Today' : d.label, fmtMinutes(d.minutes)]))}`;
}

// Focus per class over 30 days, longest first, value at each bar's tip.
export function classChart(classes) {
  const rowH = 28;
  const H = classes.length * rowH + 4;
  const labelW = 96;
  const maxLen = W - labelW - 56;
  const max = Math.max(...classes.map(c => c.minutes), 1);
  let svg = '';
  classes.forEach((c, i) => {
    const y = i * rowH + 7;
    const len = Math.max(2, (c.minutes / max) * maxLen);
    const name = c.name.length > 13 ? `${c.name.slice(0, 12)}…` : c.name;
    svg += `<text x="0" y="${y + 11}" font-size="12" fill="${INK}">${esc(name)}</text>`;
    svg += row(labelW, y, len, 14, BAR);
    svg += `<text x="${labelW + len + 6}" y="${y + 11}" font-size="11" fill="${MUTED}">${fmtMinutes(c.minutes)}</text>`;
    svg += `<rect x="0" y="${i * rowH}" width="${W}" height="${rowH}" fill="transparent" data-tip="${esc(c.name)} · ${fmtMinutes(c.minutes)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus by class, last 30 days">${svg}</svg>${
    table('Focus by class, last 30 days', ['Class', 'Focus'], classes.map(c => [c.name, fmtMinutes(c.minutes)]))}`;
}

// When focus sessions start across the day; the best hour is highlighted and the rest stay gray.
export function hourChart(hours, bestHour) {
  const H = 96;
  const top = 6;
  const base = 72;
  const band = W / 24;
  const max = Math.max(...hours, 1);
  let svg = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="${GRID}" stroke-width="1"/>`;
  hours.forEach((m, h) => {
    const cx = band * (h + 0.5);
    if (m > 0) svg += column(cx - 3.5, base - (m / max) * (base - top), 7, base, h === bestHour ? BAR : DIM);
    svg += `<rect x="${cx - band / 2}" y="0" width="${band}" height="${base + 4}" fill="transparent" data-tip="${fmtHour(h)} · ${fmtMinutes(m)}"/>`;
  });
  for (const h of [0, 6, 12, 18]) {
    svg += `<text x="${band * (h + 0.5)}" y="${base + 16}" text-anchor="middle" font-size="10" fill="${MUTED}">${fmtHour(h)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus by time of day">${svg}</svg>${
    table('Focus by starting hour', ['Hour', 'Focus'], hours.map((m, h) => [fmtHour(h), fmtMinutes(m)]).filter((_, h) => hours[h] > 0))}`;
}
