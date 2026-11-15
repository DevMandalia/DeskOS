import { ownerTone } from "@/lib/colors";

export function OwnerChip({
  name,
  color,
  prefix = "Raised by",
}: {
  name: string | null;
  color?: string | null;
  prefix?: string;
}) {
  const tone = ownerTone(name, color);
  return (
    <span className="raised-by">
      {prefix ? <span className="raised-by-label">{prefix}</span> : null}
      <span
        className="owner-chip"
        style={{
          background: tone.bg,
          color: tone.fg,
          borderColor: tone.border,
        }}
      >
        {name ?? "Unknown"}
      </span>
    </span>
  );
}
