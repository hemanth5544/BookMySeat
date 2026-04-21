# BookMySeat

**Write-up:** [Safe seat booking narrative](docs/blog-safe-seat-booking.md) (concurrency, row locks, and how this repo demonstrates both paths).

**Problem :** Seat booking in high race condition using Hybird apporach of database locking


concurrent booking (read → delay → write, duplicate `bookings` possible) with **safe** booking (transaction + `SELECT … FOR UPDATE`).

## Prerequisites

- [Bun](https://bun.sh/) (for the API runtime and seed script)
- Node 20+ and npm (for the Next.js app and Turborepo)
- PostgreSQL 14+

## Database

1. Create the database (once):

   ```bash
   createdb -h localhost -p 5432 -U postgres bookmyseat
   ```

2. Copy env files (do not commit real passwords):

   ```bash
   cp .env.example apps/server/.env
   # Edit apps/server/.env with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, SERVER_PORT
   ```

3. Seed layout + sample occupied seats:

   ```bash
   npm run db:seed -w server
   ```

   The seed prints the show UUID (the UI discovers it via `GET /shows`).

## Run


from the repo root:

```bash
npm run dev
```

- UI: [http://localhost:3000](http://localhost:3000)  
- API: [http://localhost:3001](http://localhost:3001) (default `SERVER_PORT`)




## Project layout

- `apps/server` — Bun, Elysia, Sequelize, Postgres
- `apps/web` — Next.js App Router, Tailwind, Radix/shadcn-style UI, Framer Motion, Sonner toasts
