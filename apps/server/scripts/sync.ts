import { sequelize } from "../src/db";
import { Booking, Seat, Show } from "../src/models";

await sequelize.authenticate();
await sequelize.sync({ alter: true });
console.log("Database synced.");
await sequelize.close();
