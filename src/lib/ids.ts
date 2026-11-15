export function stripId(value: string): string {
  return value.replace(/-/g, "").toLowerCase();
}

export function hyphenateId(value: string): string {
  const h = stripId(value);
  if (h.length !== 32) return value;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function idsEqual(a: string, b: string): boolean {
  return stripId(a) === stripId(b);
}

export function idFromNotionUrl(url: string): string {
  const match = url.match(/([0-9a-f]{32})/i);
  if (!match) {
    const tail = url.split("/").pop() ?? url;
    return hyphenateId(tail.split("?")[0] ?? tail);
  }
  return hyphenateId(match[1]);
}
