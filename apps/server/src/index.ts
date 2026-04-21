import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "./db";
import { bookSafe, bookUnsafe } from "./book";
import { Booking, Seat, Show } from "./models/index";

const port = Number(process.env.SERVER_PORT ?? 3001);

await sequelize.authenticate().catch((e) => {
  console.error("Postgres connection failed:", e.message);
  console.error("Ensure DB is running and apps/server/.env is set.");
  process.exit(1);
});

const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  )
  .get("/health", () => ({ ok: true }))
  .get("/shows", async () => {
    const show = await Show.findOne({ order: [["createdAt", "ASC"]] });
    if (!show) return { shows: [] as { id: string; title: string }[] };
    return { shows: [{ id: show.id, title: show.title }] };
  })
  .get("/shows/:showId/seats", async ({ params, set }) => {
    const show = await Show.findByPk(params.showId);
    if (!show) {
      set.status = 404;
      return { error: "show_not_found" };
    }
    const seats = await Seat.findAll({
      where: { showId: params.showId },
      order: [
        ["row", "ASC"],
        ["blockIndex", "ASC"],
        ["number", "DESC"],
      ],
    });
    const dupRows = (await sequelize.query<{ seatId: string; c: string }>(
      `SELECT b."seatId", COUNT(*)::text AS c FROM bookings AS b
       INNER JOIN seats AS s ON s.id = b."seatId"
       WHERE s."showId" = :showId
       GROUP BY b."seatId" HAVING COUNT(*) > 1`,
      { replacements: { showId: params.showId }, type: QueryTypes.SELECT }
    )) as { seatId: string; c: string }[];

    return {
      show: { id: show.id, title: show.title },
      seats: seats.map((s) => ({
        id: s.id,
        row: s.row,
        number: s.number,
        blockIndex: s.blockIndex,
        category: s.category,
        priceCents: s.priceCents,
        status: s.status,
        isRecliner: s.isRecliner,
      })),
      anomalies: {
        seatsWithMultipleBookings: dupRows.map((r) => ({ seatId: r.seatId, count: Number(r.c) })),
      },
    };
  })
  .get("/shows/:showId/anomalies", async ({ params, set }) => {
    const show = await Show.findByPk(params.showId);
    if (!show) {
      set.status = 404;
      return { error: "show_not_found" };
    }
    const dupRows = (await sequelize.query<{ seatId: string; c: string }>(
      `SELECT b."seatId", COUNT(*)::text AS c FROM bookings AS b
       INNER JOIN seats AS s ON s.id = b."seatId"
       WHERE s."showId" = :showId
       GROUP BY b."seatId" HAVING COUNT(*) > 1`,
      { replacements: { showId: params.showId }, type: QueryTypes.SELECT }
    )) as { seatId: string; c: string }[];
    return {
      duplicateBookingSeats: dupRows.map((r) => ({ seatId: r.seatId, bookingCount: Number(r.c) })),
    };
  })
  .post(
    "/shows/:showId/book",
    async ({ params, body, set }) => {
      const show = await Show.findByPk(params.showId);
      if (!show) {
        set.status = 404;
        return { ok: false, error: "show_not_found" };
      }
      const mode = body.mode === "safe" ? "safe" : "unsafe";
      if (body.seatIds.length === 0) {
        set.status = 400;
        return { ok: false, error: "no_seats" };
      }
      if (mode === "unsafe") {
        const result = await bookUnsafe(params.showId, body.seatIds, body.clientId, body.artificialDelayMs ?? 0);
        if (!result.ok) {
          set.status = result.error === "not_found" ? 404 : 409;
          return result;
        }
        return { ok: true, mode };
      }
      const result = await bookSafe(params.showId, body.seatIds, body.clientId);
      if (!result.ok) {
        set.status = result.error === "not_found" ? 404 : 409;
        return result;
      }
      return { ok: true, mode };
    },
    {
      body: t.Object({
        seatIds: t.Array(t.String()),
        clientId: t.String(),
        mode: t.Union([t.Literal("unsafe"), t.Literal("safe")]),
        artificialDelayMs: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/shows/:showId/reset-demo",
    async ({ params, set }) => {
      const show = await Show.findByPk(params.showId);
      if (!show) {
        set.status = 404;
        return { error: "show_not_found" };
      }
      await sequelize.transaction(async (t) => {
        const seatIds = (
          await Seat.findAll({
            where: { showId: params.showId },
            attributes: ["id"],
            transaction: t,
          })
        ).map((s) => s.id);
        if (seatIds.length) {
          await Booking.destroy({ where: { seatId: { [Op.in]: seatIds } }, transaction: t });
        }
        await Seat.update({ status: "available" }, { where: { showId: params.showId }, transaction: t });
      });
      // Re-seed occupied cluster
      const toBook = await Seat.findAll({
        where: {
          showId: params.showId,
          row: ["G", "H", "I", "J", "K", "L"],
          blockIndex: 0,
          number: [1, 2, 3],
        },
      });
      for (const s of toBook) {
        await s.update({ status: "booked" });
        await Booking.create({ seatId: s.id, clientId: "seed", mode: "seed" });
      }
      return { ok: true };
    }
  )
  .listen(port);

console.log(`BookMySeat API at http://localhost:${port}`);

export type App = typeof app;
