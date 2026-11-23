/** A blank of a recipe still in the text: its name and where it stands, braces included. */
export type Blank = { name: string; from: number; to: number };

const BLANK = /\{([^{}\n]{1,60})\}/g;

/** The blanks a text still has, in their order. */
export function blanksIn(text: string): Blank[] {
  return [...text.matchAll(BLANK)].map((match) => {
    const from = match.index ?? 0;
    return { name: (match[1] ?? "").trim(), from, to: from + match[0].length };
  });
}

/** The first blank from a place of the text on; none when every blank stands before it. */
export function blankAfter(text: string, at: number): Blank | undefined {
  return blanksIn(text).find((blank) => blank.from >= at);
}

/** The last blank that ends before a place of the text; none when every blank comes after it. */
export function blankBefore(text: string, at: number): Blank | undefined {
  return blanksIn(text)
    .filter((blank) => blank.to <= at)
    .at(-1);
}

/** What is left to fill, in one line under the box; null when nothing is. */
export function blanksLeft(blanks: readonly Blank[]): string | null {
  if (blanks.length === 0) return null;
  const names = [...new Set(blanks.map((blank) => blank.name))];
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` e mais ${names.length - 3}` : "";
  const count = blanks.length === 1 ? "Falta 1 campo" : `Faltam ${blanks.length} campos`;
  return `${count} entre chaves: ${shown}${more}. Tab leva ao próximo.`;
}
