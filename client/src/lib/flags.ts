import { nationalityOptions } from "@/lib/nationalities";

const windows1252ReverseMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function windows1252ByteFor(character: string): number | null {
  const codePoint = character.codePointAt(0);

  if (typeof codePoint !== "number") {
    return null;
  }

  if (codePoint <= 0xff) {
    return codePoint;
  }

  return windows1252ReverseMap[codePoint] ?? null;
}

export function normalizeFlagEmoji(value?: string | null): string {
  if (!value) {
    return "";
  }

  const characters = Array.from(value);
  const bytes = characters.map(windows1252ByteFor);

  if (bytes.some((byte) => byte === null)) {
    return value;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes as number[]));
  } catch {
    return value;
  }
}

export function flagEmojiToCountryCode(flagEmoji?: string | null): string {
  const normalized = normalizeFlagEmoji(flagEmoji);
  const codePoints = Array.from(normalized)
    .map((character) => character.codePointAt(0))
    .filter((codePoint): codePoint is number => typeof codePoint === "number");

  if (codePoints.length !== 2) {
    return "";
  }

  const countryCode = codePoints
    .map((codePoint) => String.fromCharCode(codePoint - 127397))
    .join("")
    .toLowerCase();

  return /^[a-z]{2}$/.test(countryCode) ? countryCode : "";
}

export function flagUrlFromEmoji(flagEmoji?: string | null): string {
  const countryCode = flagEmojiToCountryCode(flagEmoji);
  return countryCode ? `https://flagcdn.com/24x18/${countryCode}.png` : "";
}

export function flagUrlForNationality(nationality?: string | null): string {
  const option = nationalityOptions.find(
    (item) => item.value === nationality || item.label === nationality,
  );

  return flagUrlFromEmoji(option?.flag);
}
