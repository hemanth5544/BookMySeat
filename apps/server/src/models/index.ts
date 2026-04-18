import { DataTypes, Model, type Optional } from "sequelize";
import { sequelize } from "../db";

export class Show extends Model {
  declare id: string;
  declare title: string;
}

Show.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
  },
  { sequelize, tableName: "shows", timestamps: true }
);

export type SeatStatus = "available" | "booked";

export class Seat extends Model {
  declare id: string;
  declare showId: string;
  declare row: string;
  declare number: number;
  declare blockIndex: number;
  declare category: string;
  declare priceCents: number;
  declare status: SeatStatus;
  declare isRecliner: boolean;
}

Seat.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    showId: { type: DataTypes.UUID, allowNull: false },
    row: { type: DataTypes.STRING(4), allowNull: false },
    number: { type: DataTypes.SMALLINT, allowNull: false },
    blockIndex: { type: DataTypes.SMALLINT, allowNull: false },
    category: { type: DataTypes.STRING(32), allowNull: false },
    priceCents: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "available" },
    isRecliner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: "seats", timestamps: true }
);

Show.hasMany(Seat, { foreignKey: "showId" });
Seat.belongsTo(Show, { foreignKey: "showId" });

type BookingAttrs = {
  id: string;
  seatId: string;
  clientId: string;
  mode: string;
};

type BookingCreation = Optional<BookingAttrs, "id">;

/** No unique on seatId — unsafe concurrent bookings can create duplicates (demo). */
export class Booking extends Model<BookingAttrs, BookingCreation> {
  declare id: string;
  declare seatId: string;
  declare clientId: string;
  declare mode: string;
}

Booking.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    seatId: { type: DataTypes.UUID, allowNull: false },
    clientId: { type: DataTypes.STRING(64), allowNull: false },
    mode: { type: DataTypes.STRING(16), allowNull: false },
  },
  { sequelize, tableName: "bookings", timestamps: true }
);

Seat.hasMany(Booking, { foreignKey: "seatId" });
Booking.belongsTo(Seat, { foreignKey: "seatId" });
