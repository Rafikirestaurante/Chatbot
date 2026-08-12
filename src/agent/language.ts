const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n"
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (character) => ACCENTS[character] || character)
    .replace(/[¿?¡!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesAny(text: string, expressions: RegExp[]): boolean {
  return expressions.some((expression) => expression.test(text));
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
