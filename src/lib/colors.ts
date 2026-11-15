type ChipTone = { bg: string; fg: string; border: string };

const TONES: Record<string, ChipTone> = {
  blue: { bg: "#D9E6F0", fg: "#2C5278", border: "#C5D6E4" },
  purple: { bg: "#E8E0F2", fg: "#5A4578", border: "#D5CBE4" },
  pink: { bg: "#F3DDE6", fg: "#8A4A62", border: "#E6CDD8" },
  orange: { bg: "#F3E0D0", fg: "#B4522B", border: "#E6D0BC" },
  green: { bg: "#E2EFEC", fg: "#1F5F5B", border: "#CDE0DC" },
  brown: { bg: "#E8DFD4", fg: "#6B5344", border: "#D9CFC3" },
  red: { bg: "#F3D6D4", fg: "#8B3A32", border: "#E6C6C3" },
  gray: { bg: "#E8E4DC", fg: "#625D55", border: "#D9D4CB" },
  yellow: { bg: "#F3ECD4", fg: "#7A6A32", border: "#E6DCBF" },
  default: { bg: "#EFEADF", fg: "#1D1B18", border: "#E3DDD0" },
};

export const OWNER_COLOR: Record<string, string> = {
  "Acme Chief of Staff": "purple",
  "Acme Ops": "blue",
  "Acme Writer": "green",
};

export function toneFor(color: string | null | undefined): ChipTone {
  if (!color) return TONES.default;
  return TONES[color] ?? TONES.default;
}

export function ownerTone(
  name: string | null | undefined,
  explicitColor?: string | null,
): ChipTone {
  return toneFor(explicitColor ?? (name ? OWNER_COLOR[name] : null));
}

export function areaTone(name: string | null | undefined): ChipTone {
  return toneFor(name ? OWNER_COLOR[name] : null);
}
