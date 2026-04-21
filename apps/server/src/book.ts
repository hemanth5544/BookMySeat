import type { Transaction } from "sequelize";
import { sequelize } from "./db";
import { Booking, Seat } from "./models";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read–delay–write: concurrent requests can both observe `available` and create duplicate `bookings` rows. */
export async function bookUnsafe(
  showId: string,
  seatIds: string[],
  clientId: string,
  artificialDelayMs: number
): Promise<{ ok: true } | { ok: false; error: "not_found" | "conflict" }> {
  const delayMs = artificialDelayMs > 0 ? artificialDelayMs : 140;
  for (const id of seatIds) {
    const seat = await Seat.findByPk(id);
    if (!seat || seat.showId !== showId) return { ok: false, error: "not_found" };
    if (seat.status !== "available") return { ok: false, error: "conflict" };
    await sleep(delayMs);
    await seat.update({ status: "booked" });
    await Booking.create({ seatId: id, clientId, mode: "unsafe" });
  }
  return { ok: true };
}

/** Same-seat concurrent safety: lock rows, verify, update, insert — all in one transaction. */
export async function bookSafe(
  showId: string,
  seatIds: string[],
  clientId: string
): Promise<{ ok: true } | { ok: false; error: "not_found" | "conflict" }> {
  try {
    await sequelize.transaction(async (t: Transaction) => {
      const seats = await Seat.findAll({
        where: { id: seatIds, showId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (seats.length !== seatIds.length) {
        throw Object.assign(new Error("not_found"), { code: "not_found" as const });
      }
      if (seats.some((s) => s.status !== "available")) {
        throw Object.assign(new Error("conflict"), { code: "conflict" as const });
      }
      for (const s of seats) {
        await s.update({ status: "booked" }, { transaction: t });
        await Booking.create({ seatId: s.id, clientId, mode: "safe" }, { transaction: t });
      }
    });
    return { ok: true };
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "not_found") return { ok: false, error: "not_found" };
    if (code === "conflict") return { ok: false, error: "conflict" };
    throw e;
  }
}
