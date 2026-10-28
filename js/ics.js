// Calendar file (iCalendar, .ics) for planned sessions, so they land in Apple Calendar
// (or any calendar app) with an alert five minutes before each one.

const pad = n => String(n).padStart(2, '0');

// Times are written in UTC so the calendar app converts them to the phone's time zone.
const utc = ms => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
};

const text = s => s.replace(/[\\;,]/g, c => `\\${c}`).replace(/\n/g, '\\n');

// Lines over 75 characters are folded onto continuation lines that start with a space.
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join('\r\n');
}

export function buildIcs(sessions, now = Date.now()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nook//Study plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const s of sessions) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@nook`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(s.at)}`,
      `DTEND:${utc(s.at + (s.end - s.start) * 60000)}`,
      `SUMMARY:${text(s.label === 'Focus' ? 'Focus session' : `Focus · ${s.label}`)}`,
      'DESCRIPTION:Planned in Nook',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Focus session in 5 minutes',
      'TRIGGER:-PT5M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
