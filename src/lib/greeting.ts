export function firstName(name: string | null | undefined, email: string): string {
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = email.split("@")[0]?.split(/[._+-]/)[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function greetingHour(now: Date, timeZone = "America/Los_Angeles"): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now),
  );
  return Number.isFinite(hour) ? hour : now.getHours();
}

export function helloPhrase(now: Date, name: string, timeZone = "America/Los_Angeles"): string {
  const hour = greetingHour(now, timeZone);
  const when = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${when}, ${name}.`;
}

export function datePillLabel(now: Date, timeZone = "America/Los_Angeles"): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(now);
}
