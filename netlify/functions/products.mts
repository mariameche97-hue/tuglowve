import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "GET") {
    const all = await db.select().from(products).orderBy(products.id);
    return Response.json(all);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const data = {
      name: String(body.name || "").trim(),
      category: body.category ? String(body.category) : "General",
      stock: parseInt(body.stock) || 0,
      minStock: parseInt(body.minStock) || 0,
      price: String(parseFloat(body.price) || 0),
    };
    if (!data.name) return Response.json({ error: "Nombre requerido" }, { status: 400 });
    const [created] = await db.insert(products).values(data).returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT") {
    if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
    const body = await req.json();
    const data = {
      name: String(body.name || "").trim(),
      category: body.category ? String(body.category) : "General",
      stock: parseInt(body.stock) || 0,
      minStock: parseInt(body.minStock) || 0,
      price: String(parseFloat(body.price) || 0),
    };
    const [updated] = await db.update(products).set(data).where(eq(products.id, parseInt(id))).returning();
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
    await db.delete(products).where(eq(products.id, parseInt(id)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/products",
};
