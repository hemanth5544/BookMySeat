---
title: "Closing the gap: how BookMySeat teaches seat races and row locks"
date: "2026-04-19"
description: "A Turborepo cinema demo where naive booking under load can duplicate rows—and where one Sequelize transaction with pessimistic locks makes Postgres the referee."
repo: "https://github.com/hemanth5544/BookMySeat"
image: "docs/assets/bookmyseat-read-write-gap.svg"
---

When I put **[BookMySeat](https://github.com/hemanth5544/BookMySeat)** together, the goal was not another CRUD tutorial. I wanted something you could **feel**: two browsers, one seat, and a backend honest enough to show **where concurrency actually hurts**.

The stack is deliberately small: **Bun** runs an **Elysia** API, **Sequelize** talks to **PostgreSQL**, and a **Next.js** app (Tailwind, Radix-style primitives, Framer Motion on the seat tiles) sits in the same **Turborepo**. The UI is a cinema-style map; the lesson lives in two booking paths exposed as a single `POST /shows/:showId/book` with `mode: "unsafe" | "safe"`.

---

## The story the unsafe path tells

The “bad” implementation is intentionally familiar: **load the seat**, **pause** (configurable delay so races are visible under test), **flip status to booked**, **insert a booking row**. No transaction wraps the whole thing, and nothing pins the row while you decide.

That is textbook **check-then-act**. Two in-flight requests can both observe `available`, sleep through the same window, and each run `UPDATE` plus `INSERT`. The demo does **not** enforce a unique constraint on `bookings.seatId`, so the database will happily store **more than one booking for the same seat**—which is exactly the kind of integrity break you want to surface in a teaching repo rather than hide.

The API also returns an **anomalies** block on `GET /shows/:showId/seats`: seats where `COUNT(bookings)` is greater than one for the same `seatId`. The Next.js page surfaces that after stress runs so you do not have to tail SQL to prove the point.

![Two overlapping read–write timelines for the same seat](./assets/bookmyseat-read-write-gap.svg)

---

## Why wrapping only part of the work is a half-measure

People sometimes hear “use a transaction” and assume the race vanishes. A transaction gives you **atomicity** and a place to **roll back**, but a plain read—depending on isolation—can still be a **non-locking snapshot**. Two transactions can therefore **agree on the past** at the same time unless something forces them to take turns on the **authoritative row** (or you lean on a constraint and a retry story).

So the interesting design question is not “transaction yes/no,” but **which rows are the source of truth for the decision**, and **how you read them** right before you mutate.

---

## What “safe” does in this codebase

The safe path is a single **Sequelize-managed transaction**. Inside it, the handler loads the requested seats with **`lock: t.LOCK.UPDATE`**, which maps to PostgreSQL’s **`SELECT … FOR UPDATE`** behavior on those rows.

Roughly:

1. Open a transaction.
2. `findAll` the target seats **for this show**, with **`FOR UPDATE`** so competitors block on the same inventory.
3. Verify count and `status === "available"` while the lock is held.
4. Update each seat to `booked` and create `bookings` rows **in the same transaction**.
5. Commit.

If another client got there first, the re-check fails and the handler returns a **409-style conflict** instead of silently stacking duplicate bookings. The critical section is short: no artificial sleep in the safe path, because the point is **correctness under contention**, not simulating human latency inside the lock.

---

## Trade-offs you should name out loud

**Throughput on a hot seat** goes down when everyone queues on the same row lock—that is the cost of correctness for a finite resource. For a full auditorium you usually contend **per seat**, which scales better than one global mutex for the entire hall.

If you lock **multiple seats** (for example a cart of four), define a **stable lock order** (sort seat IDs ascending) before acquiring locks so you do not invite deadlocks.

Keep transactions **tight**: no slow external APIs, no user-facing prompts, no “fetch PDF while holding the row.”

---

## Neighbors on the shelf (briefly)

BookMySeat focuses on **pessimistic row locks inside a transaction** because it maps cleanly to “this seat is the thing we are fighting over.”

Other patterns belong in the same mental drawer:

- A **`UNIQUE (seat_id)`** (or composite with show/time) is an excellent **backstop**: the app should still try to do the right thing, but the database refuses double-sell if something slips.
- **Optimistic locking** with a `version` column is pleasant when conflicts are rare; cinemas on opening night are not always that world.
- **Stricter isolation** can catch anomalies but often surfaces as **retries**; you still want an explicit story for **which rows** represent the seat.

---

## How to play with it locally

Clone the repo, create a Postgres database, copy `.env.example` into `apps/server/.env`, run **`npm run db:seed -w server`**, then start **`npm run dev`** (or run the server and web workspaces separately). The UI includes a **stress** control that fires parallel **unsafe** requests against one available seat—afterwards, refresh and watch **anomalies** light up unless you reset the demo.

If you want a deeper dive later—exact isolation-level notes, lock ordering for multi-seat carts, or a k6 script against `/book`—those can be short follow-ups. For now, the implementation in `apps/server/src/book.ts` is the ground truth next to this narrative.
