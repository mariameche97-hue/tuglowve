import { pgTable, serial, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial().primaryKey(),
  name: text().notNull(),
  category: text(),
  stock: integer().notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  price: numeric({ precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial().primaryKey(),
  name: text().notNull(),
  phone: text(),
  instagram: text(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial().primaryKey(),
  clientName: text("client_name").notNull(),
  date: text().notNull(),
  items: jsonb().notNull().default([]),
  total: numeric({ precision: 10, scale: 2 }).notNull().default("0"),
  paid: numeric({ precision: 10, scale: 2 }).notNull().default("0"),
  history: jsonb().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});
