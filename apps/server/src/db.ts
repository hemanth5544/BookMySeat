import { Sequelize } from "sequelize";

const host = process.env.DB_HOST ?? "localhost";
const port = Number(process.env.DB_PORT ?? 5432);
const database = process.env.DB_NAME ?? "bookmyseat";
const username = process.env.DB_USER ?? "postgres";
const password = process.env.DB_PASSWORD ?? "";

export const sequelize = new Sequelize(database, username, password, {
  host,
  port,
  dialect: "postgres",
  logging: false,
});
