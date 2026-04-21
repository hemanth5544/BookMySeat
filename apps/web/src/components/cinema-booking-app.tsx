"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Armchair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { bookSeats, fetchSeats, fetchShows, resetDemo, type SeatDto, type SeatsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const CATEGORY_ORDER = ["classic", "extra_legroom", "prime", "recliner"] as const;

const CATEGORY_TITLE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  classic: "CLASSIC ROWS (177.96 + GST)",
  extra_legroom: "EXTRA LEGROOM ROWS (236.56 + GST)",
  prime: "PRIME ROWS (295.46 + GST)",
  recliner: "RECLINER ROWS (472.96 + GST)",
};

function clientKey() {
  if (typeof window === "undefined") return "ssr";
  const k = "bms_client";
  let v = window.localStorage.getItem(k);
  if (!v) {
    v = `c_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(k, v);
  }
  return v;
}

function blocksForRow(seats: SeatDto[], row: string) {
  const rowSeats = seats.filter((s) => s.row === row);
  const blockIndexes = [...new Set(rowSeats.map((s) => s.blockIndex))].sort((a, b) => a - b);
  return blockIndexes.map((bi) =>
    rowSeats.filter((s) => s.blockIndex === bi).sort((a, b) => b.number - a.number)
  );
}

function rowsForCategory(seats: SeatDto[], category: string) {
  const subset = seats.filter((s) => s.category === category);
  return [...new Set(subset.map((s) => s.row))].sort();
}

export function CinemaBookingApp() {
  const [showId, setShowId] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<SeatsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [bookingMode, setBookingMode] = React.useState<"unsafe" | "safe">("safe");
  const [stressRunning, setStressRunning] = React.useState(false);
  const [clientId] = React.useState(() => clientKey());

  const load = React.useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    try {
      const d = await fetchSeats(showId);
      setPayload(d);
    } catch {
      toast.error("Could not load seats. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  React.useEffect(() => {
    fetchShows()
      .then((s) => setShowId(s[0]?.id ?? null))
      .catch(() => {
        toast.error("Could not reach API. Check NEXT_PUBLIC_API_URL.");
        setShowId(null);
      });
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const seats = payload?.seats ?? [];

  const toggleSeat = (seat: SeatDto) => {
    if (seat.status === "booked") return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(seat.id)) n.delete(seat.id);
      else n.add(seat.id);
      return n;
    });
  };

  const visual = (seat: SeatDto) => {
    if (seat.status === "booked") return "booked" as const;
    if (selected.has(seat.id)) return "selected" as const;
    return "available" as const;
  };

  const onBook = async () => {
    if (!showId || selected.size === 0) return;
    const ids = [...selected];
    const res = await bookSeats(showId, ids, clientId, bookingMode, bookingMode === "unsafe" ? 160 : undefined);
    if (!res.ok) {
      toast.error(res.error === "conflict" ? "Seat no longer available." : "Booking failed.");
    } else {
      toast.success(`Booked with ${bookingMode} mode`);
    }
    setSelected(new Set());
    await load();
    const fresh = await fetchSeats(showId);
    if (fresh.anomalies.seatsWithMultipleBookings.length > 0) {
      toast.warning(
        `Data integrity: ${fresh.anomalies.seatsWithMultipleBookings.length} seat(s) have duplicate booking rows (unsafe concurrent path).`
      );
    }
  };

  const onStress = async () => {
    if (!showId || !payload) return;
    const target = payload.seats.find((s) => s.status === "available");
    if (!target) {
      toast.message("No available seat to stress-test. Reset demo first.");
      return;
    }
    setStressRunning(true);
    const n = 10;
    const delay = 180;
    try {
      const results = await Promise.all(
        Array.from({ length: n }, (_, i) =>
          bookSeats(showId, [target.id], `${clientId}_stress_${i}`, "unsafe", delay)
        )
      );
      const ok = results.filter((r) => r.ok).length;
      await load();
      const after = await fetchSeats(showId);
      const dup = after.anomalies.seatsWithMultipleBookings.find((x) => x.seatId === target.id);
      toast.message(`Unsafe stress: ${ok}/${n} returned OK. Duplicate rows on seat: ${dup ? dup.count : 0}`);
    } finally {
      setStressRunning(false);
    }
  };

  const onReset = async () => {
    if (!showId) return;
    try {
      await resetDemo(showId);
      setSelected(new Set());
      await load();
      toast.success("Demo reset.");
    } catch {
      toast.error("Reset failed.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-foreground">BookMySeat</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Select seats</h1>
            <p className="text-sm text-muted-foreground">{payload?.show.title ?? "Loading…"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onReset()}>
              Reset demo
            </Button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="relative mx-auto max-w-3xl text-center">
            <svg viewBox="0 0 520 48" className="mx-auto h-12 w-full text-screen" preserveAspectRatio="none" aria-hidden>
              <path d="M 8 40 Q 260 2 512 40" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.45em] text-muted-foreground">SCREEN</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-border bg-seat-available shadow-sm dark:border-muted-foreground/40" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded bg-accent shadow-sm" />
              Selected
            </span>
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded bg-seat-occupied shadow-inner" />
              Occupied
            </span>
          </div>

          {loading && !payload ? (
            <div className="flex justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !showId ? (
            <p className="py-16 text-center text-muted-foreground">No show in database. Run the seed script.</p>
          ) : (
            <div className="space-y-10">
              {CATEGORY_ORDER.map((cat) => {
                const rows = rowsForCategory(seats, cat);
                if (rows.length === 0) return null;
                return (
                  <section key={cat} className="space-y-3">
                    <h2 className="text-center text-[11px] font-bold uppercase tracking-wide text-foreground">
                      {CATEGORY_TITLE[cat]}
                    </h2>
                    <div className="space-y-2">
                      {rows.map((row) => {
                        const blocks = blocksForRow(seats, row);
                        const isPrime = cat === "prime";
                        const aisle = isPrime ? "gap-6 sm:gap-10" : "gap-10 sm:gap-16";
                        return (
                          <div key={`${cat}-${row}`} className="flex items-center justify-center gap-2 sm:gap-3">
                            <span className="w-4 text-right text-xs font-semibold text-muted-foreground">{row}</span>
                            <div className={cn("flex flex-1 justify-center", aisle)}>
                              {blocks.map((block, bi) => (
                                <div key={bi} className="flex flex-wrap justify-center gap-1">
                                  {block.map((seat) => (
                                    <SeatCell
                                      key={seat.id}
                                      seat={seat}
                                      state={visual(seat)}
                                      onPick={() => toggleSeat(seat)}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                            <span className="w-4 text-left text-xs font-semibold text-muted-foreground">{row}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="mx-auto mt-10 max-w-xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-foreground">Concurrency demo</p>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Unsafe</strong> uses read → delay → write without row locks (can
              create duplicate <code className="rounded bg-muted px-1">bookings</code> for one seat).
              <strong className="text-foreground"> Safe</strong> uses a transaction with{" "}
              <code className="rounded bg-muted px-1">SELECT … FOR UPDATE</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={bookingMode === "safe" ? "default" : "outline"}
                onClick={() => setBookingMode("safe")}
              >
                Safe book
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookingMode === "unsafe" ? "default" : "outline"}
                onClick={() => setBookingMode("unsafe")}
              >
                Unsafe book
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onBook()} disabled={selected.size === 0 || loading}>
                Confirm selection ({selected.size})
              </Button>
              <Button type="button" variant="secondary" onClick={() => void onStress()} disabled={stressRunning || loading}>
                {stressRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stress (unsafe)
                  </>
                ) : (
                  "Stress test (unsafe ×10)"
                )}
              </Button>
            </div>
            {payload && payload.anomalies.seatsWithMultipleBookings.length > 0 && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Integrity check: {payload.anomalies.seatsWithMultipleBookings.length} seat(s) have multiple booking
                rows.
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function SeatCell({
  seat,
  state,
  onPick,
}: {
  seat: SeatDto;
  state: "available" | "selected" | "booked";
  onPick: () => void;
}) {
  const disabled = state === "booked";
  return (
    <motion.button
      type="button"
      layout
      disabled={disabled}
      onClick={onPick}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className={cn(
        "relative flex h-8 min-w-[2rem] items-center justify-center rounded-md border text-[11px] font-semibold",
        state === "available" && "border-border bg-seat-available text-foreground shadow-sm dark:border-muted-foreground/35",
        state === "selected" && "border-accent bg-accent text-accent-foreground shadow-md",
        state === "booked" && "cursor-not-allowed border-transparent bg-seat-occupied text-muted-foreground"
      )}
      aria-pressed={state === "selected"}
      aria-label={`Seat ${seat.row}${seat.number}`}
    >
      {seat.isRecliner ? <Armchair className="h-4 w-4" /> : seat.number}
    </motion.button>
  );
}
