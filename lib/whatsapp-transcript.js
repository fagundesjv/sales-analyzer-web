// WhatsApp text exports from Android and iOS in the Brazilian date format.
export function parseWhatsAppExport(text) {
  const messages = [];
  let current;
  for (const input of text.split(/\r?\n/)) {
    const line = input.replace(/[\u200e\u200f\ufeff]/g, "");
    const header =
      /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:-\s*)?(.*)$/.exec(
        line,
      );
    if (!header) {
      if (current) current.text += "\n" + line;
      continue;
    }
    current = null;
    const [, dd, mm, yy, hh, min, ss, body] = header;
    const sender = /^([^:]{1,110}):\s*(.*)$/.exec(body);
    if (!sender) continue;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const date = new Date(
      year,
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss || 0),
    );
    if (
      date.getMonth() !== Number(mm) - 1 ||
      date.getDate() !== Number(dd) ||
      date.getHours() !== Number(hh)
    )
      continue;
    current = {
      sender: sender[1].trim(),
      text: sender[2],
      sentAt: date.toISOString(),
    };
    messages.push(current);
  }
  return messages
    .filter((m) => m.text.trim())
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}
