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
// Focus is amber; timelapse time (from Lapse) passes its own blue, checked against amber for this surface.
export const LAPSE_BAR = '#3987e5';
export function weekChart(days, { color = BAR, what = 'Focus' } = {}) {
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
    if (d.minutes > 0) svg += column(cx - 11, y(d.minutes), 22, base, color);
    if (d.minutes > 0 && (isToday || i === best)) {
      svg += `<text x="${cx}" y="${y(d.minutes) - 5}" text-anchor="middle" font-size="10" fill="${INK}">${fmtMinutes(d.minutes)}</text>`;
    }
    svg += `<text x="${cx}" y="${base + 16}" text-anchor="middle" font-size="11" fill="${isToday ? INK : MUTED}">${isToday ? 'Today' : d.label}</text>`;
    svg += `<rect x="${cx - band / 2}" y="${top - 10}" width="${band}" height="${base - top + 10}" fill="transparent" data-tip="${isToday ? 'Today' : d.label} · ${fmtMinutes(d.minutes)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${what} minutes per day, last 7 days">${svg}</svg>${
    table(`${what} per day, last 7 days`, ['Day', what], days.map((d, i) => [i === days.length - 1 ? 'Today' : d.label, fmtMinutes(d.minutes)]))}`;
}

// Horizontal bars, longest first, value at each bar's tip. rows: { name, minutes, note? };
// the note (e.g. a session count) rides after the value. label names the chart and its table.
export function barList(rows, label, head = 'Name') {
  const rowH = 28;
  const H = rows.length * rowH + 4;
  const labelW = 96;
  const maxLen = W - labelW - 92;
  const max = Math.max(...rows.map(c => c.minutes), 1);
  let svg = '';
  rows.forEach((c, i) => {
    const y = i * rowH + 7;
    const len = Math.max(2, (c.minutes / max) * maxLen);
    const name = c.name.length > 13 ? `${c.name.slice(0, 12)}…` : c.name;
    const value = c.note ? `${fmtMinutes(c.minutes)} · ${c.note}` : fmtMinutes(c.minutes);
    svg += `<text x="0" y="${y + 11}" font-size="12" fill="${INK}">${esc(name)}</text>`;
    svg += row(labelW, y, len, 14, BAR);
    svg += `<text x="${labelW + len + 6}" y="${y + 11}" font-size="11" fill="${MUTED}">${esc(value)}</text>`;
    svg += `<rect x="0" y="${i * rowH}" width="${W}" height="${rowH}" fill="transparent" data-tip="${esc(c.name)} · ${esc(value)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${svg}</svg>${
    table(label, [head, 'Focus'], rows.map(c => [c.name, c.note ? `${fmtMinutes(c.minutes)}, ${c.note}` : fmtMinutes(c.minutes)]))}`;
}

// Amber steps from a little focus to a lot (checked with the dataviz validator for this surface);
// days with none use the empty-cell gray.
const HEAT = ['#6b4f2a', '#946934', '#bc8540', '#e2a65b'];
const HEAT_EMPTY = '#272a30';
const heatStep = m => (m === 0 ? -1 : m < 30 ? 0 : m < 60 ? 1 : m < 120 ? 2 : 3);

// A month of days as a calendar grid, each shaded by how much finished focus it had.
export function monthHeatmap(weeks, todayKey, monthLabel) {
  const cols = 7;
  const gap = 6;
  const cell = (W - gap * (cols - 1)) / cols;
  const top = 18;
  const H = top + weeks.length * (cell + gap) + 22;
  let svg = '';
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
    svg += `<text x="${i * (cell + gap) + cell / 2}" y="11" text-anchor="middle" font-size="10" fill="${MUTED}">${d}</text>`;
  });
  weeks.forEach((week, r) => week.forEach((day, c) => {
    const x = c * (cell + gap);
    const y = top + r * (cell + gap);
    const step = heatStep(day.minutes);
    if (!day.inMonth) return;
    svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="${step < 0 ? HEAT_EMPTY : HEAT[step]}"/>`;
    if (day.key === todayKey) svg += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${cell - 1.5}" height="${cell - 1.5}" rx="5.5" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
    // Day numbers sit inside the fill, so they flip to dark ink on the two brightest steps.
    svg += `<text x="${x + 6}" y="${y + 13}" font-size="10" fill="${step >= 2 ? '#1b1408' : MUTED}">${day.day}</text>`;
    const tip = day.minutes ? `${fmtMinutes(day.minutes)} · ${day.sessions} ${day.sessions === 1 ? 'session' : 'sessions'}` : 'no focus';
    svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="transparent" data-tip="${esc(monthLabel.split(' ')[0])} ${day.day} · ${tip}"/>`;
  }));
  // Legend: less to more
  const ly = H - 12;
  svg += `<text x="${W - 5 * 16 - 34}" y="${ly + 8}" text-anchor="end" font-size="10" fill="${MUTED}">Less</text>`;
  [HEAT_EMPTY, ...HEAT].forEach((color, i) => {
    svg += `<rect x="${W - 5 * 16 - 28 + i * 16}" y="${ly}" width="12" height="12" rx="3" fill="${color}"/>`;
  });
  svg += `<text x="${W}" y="${ly + 8}" text-anchor="end" font-size="10" fill="${MUTED}">More</text>`;
  const days = weeks.flat().filter(d => d.inMonth);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus each day, ${esc(monthLabel)}">${svg}</svg>${
    table(`Focus each day, ${monthLabel}`, ['Day', 'Focus'], days.filter(d => d.minutes).map(d => [`${d.day}`, `${fmtMinutes(d.minutes)}, ${d.sessions} sessions`]))}`;
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
