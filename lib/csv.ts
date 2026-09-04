// Minimal RFC-4180-ish CSV parser: quoted fields, "" escapes, CRLF or LF,
// commas inside quotes. Enough for the small operator-supplied files we import
// (conflict lists). No dependency.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawAny = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      sawAny = true;
    } else if (c === "\r") {
      // handled by the \n branch
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawAny = false;
    } else {
      field += c;
      sawAny = true;
    }
  }
  if (sawAny || field.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
