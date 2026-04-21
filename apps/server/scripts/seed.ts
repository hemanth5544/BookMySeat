import { randomUUID } from "node:crypto";
import { sequelize } from "../src/db";
import { Booking, Seat, Show } from "../src/models";

await sequelize.authenticate();
await sequelize.sync({ alter: true });

await Booking.destroy({ where: {} });
await Seat.destroy({ where: {} });
await Show.destroy({ where: {} });

const showId = randomUUID();
await Show.create({ id: showId, title: "Demo Hindi Feature" });

const classicPrice = 177_96;
const extraPrice = 236_56;
const primePrice = 295_46;
const reclinerPrice = 472_96;

type SeatRow = {
  row: string;
  number: number;
  blockIndex: number;
  category: string;
  priceCents: number;
  isRecliner: boolean;
};

const rows: SeatRow[] = [];

const classicRows = ["A", "B", "C"];
for (const row of classicRows) {
  for (let n = 9; n >= 1; n--) rows.push({ row, number: n, blockIndex: 0, category: "classic", priceCents: classicPrice, isRecliner: false });
  for (let n = 18; n >= 10; n--) rows.push({ row, number: n, blockIndex: 1, category: "classic", priceCents: classicPrice, isRecliner: false });
}

const d = "D";
for (let n = 9; n >= 1; n--) rows.push({ row: d, number: n, blockIndex: 0, category: "extra_legroom", priceCents: extraPrice, isRecliner: false });
for (let n = 18; n >= 10; n--) rows.push({ row: d, number: n, blockIndex: 1, category: "extra_legroom", priceCents: extraPrice, isRecliner: false });

const primeRows = ["E", "F", "G", "H", "I", "J", "K", "L"];
for (const row of primeRows) {
  for (let n = 7; n >= 1; n--) rows.push({ row, number: n, blockIndex: 0, category: "prime", priceCents: primePrice, isRecliner: false });
  for (let n = 14; n >= 8; n--) rows.push({ row, number: n, blockIndex: 1, category: "prime", priceCents: primePrice, isRecliner: false });
  for (let n = 21; n >= 15; n--) rows.push({ row, number: n, blockIndex: 2, category: "prime", priceCents: primePrice, isRecliner: false });
}

const m = "M";
for (let n = 12; n >= 1; n--) rows.push({ row: m, number: n, blockIndex: 0, category: "recliner", priceCents: reclinerPrice, isRecliner: true });

await Seat.bulkCreate(
  rows.map((r) => ({
    showId,
    row: r.row,
    number: r.number,
    blockIndex: r.blockIndex,
    category: r.category,
    priceCents: r.priceCents,
    isRecliner: r.isRecliner,
    status: "available" as const,
  }))
);

// Pre-book a cluster like the reference (prime section)
const toBook = await Seat.findAll({
  where: {
    showId,
    row: ["G", "H", "I", "J", "K", "L"],
    status: "available",
    blockIndex: 0,
    number: [1, 2, 3],
  },
});
for (const s of toBook) {
  await s.update({ status: "booked" });
  await Booking.create({ seatId: s.id, clientId: "seed", mode: "seed" });
}

console.log("Seeded show:", showId);
await sequelize.close();
