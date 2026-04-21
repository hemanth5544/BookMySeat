const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SeatDto = {
  id: string;
  row: string;
  number: number;
  blockIndex: number;
  category: string;
  priceCents: number;
  status: "available" | "booked";
  isRecliner: boolean;
};

export type SeatsResponse = {
  show: { id: string; title: string };
  seats: SeatDto[];
  anomalies: { seatsWithMultipleBookings: { seatId: string; count: number }[] };
};

export async function fetchShows(): Promise<{ id: string; title: string }[]> {
  const r = await fetch(`${base()}/shows`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load shows");
  const j = (await r.json()) as { shows: { id: string; title: string }[] };
  return j.shows;
}

export async function fetchSeats(showId: string): Promise<SeatsResponse> {
  const r = await fetch(`${base()}/shows/${showId}/seats`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load seats");
  return r.json() as Promise<SeatsResponse>;
}

export async function bookSeats(
  showId: string,
  seatIds: string[],
  clientId: string,
  mode: "unsafe" | "safe",
  artificialDelayMs?: number
): Promise<{ ok: boolean; error?: string; mode?: string }> {
  const r = await fetch(`${base()}/shows/${showId}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seatIds, clientId, mode, artificialDelayMs }),
  });
  const j = (await r.json()) as { ok: boolean; error?: string; mode?: string };
  if (!r.ok) return { ok: false, error: j.error ?? "request_failed" };
  return j;
}

export async function resetDemo(showId: string): Promise<void> {
  const r = await fetch(`${base()}/shows/${showId}/reset-demo`, { method: "POST" });
  if (!r.ok) throw new Error("Reset failed");
}
