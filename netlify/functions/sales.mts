import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sales, products } from "../../db/schema.js";

type SaleItem = { productId: number; name: string; qty: number; price: number; subtotal: number };

async function restoreStock(items: SaleItem[]) {
  for (const it of items) {
    const [prod] = await db.select().from(products).where(eq(products.id, it.productId));
    if (prod) {
      await db.update(products).set({ stock: prod.stock + it.qty }).where(eq(products.id, it.productId));
    }
  }
}

async function consumeStock(items: SaleItem[]) {
  for (const it of items) {
    const [prod] = await db.select().from(products).where(eq(products.id, it.productId));
    if (prod) {
      await db.update(products).set({ stock: prod.stock - it.qty }).where(eq(products.id, it.productId));
    }
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  if (req.method === "GET") {
    const all = await db.select().from(sales).orderBy(sales.id);
    return Response.json(all);
  }

  if (req.method === "POST" && !action) {
    const body = await req.json();
    const items: SaleItem[] = body.items || [];
    if (!items.length) return Response.json({ error: "Se requieren productos" }, { status: 400 });

    for (const it of items) {
      const [prod] = await db.select().from(products).where(eq(products.id, it.productId));
      const disp = prod ? prod.stock : 0;
      if (it.qty > disp) {
        return Response.json({ error: `Stock insuficiente para ${it.name}. Disponible: ${disp}` }, { status: 400 });
      }
    }

    const total = items.reduce((a, b) => a + b.subtotal, 0);
    const [created] = await db
      .insert(sales)
      .values({
        clientName: String(body.clientName || "").trim(),
        date: body.date || new Date().toLocaleDateString("es-ES"),
        items,
        total: String(total),
        paid: "0",
        history: [],
      })
      .returning();

    await consumeStock(items);
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT" && action === "payment") {
    if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
    const body = await req.json();
    const amount = parseFloat(body.amount);
    const date = body.date;
    if (isNaN(amount) || amount <= 0) return Response.json({ error: "Monto inválido" }, { status: 400 });

    const [sale] = await db.select().from(sales).where(eq(sales.id, parseInt(id)));
    if (!sale) return Response.json({ error: "Venta no encontrada" }, { status: 404 });

    const total = parseFloat(sale.total);
    const paid = parseFloat(sale.paid);
    if (amount > total - paid) return Response.json({ error: "El abono supera la deuda pendiente" }, { status: 400 });

    const history = Array.isArray(sale.history) ? sale.history : [];
    history.push({ f: date, m: amount });

    const [updated] = await db
      .update(sales)
      .set({ paid: String(paid + amount), history })
      .where(eq(sales.id, parseInt(id)))
      .returning();
    return Response.json(updated);
  }

  if (req.method === "PUT" && !action) {
    if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
    const body = await req.json();
    const newItems: SaleItem[] = body.items || [];
    if (!newItems.length) return Response.json({ error: "Se requieren productos" }, { status: 400 });

    const [sale] = await db.select().from(sales).where(eq(sales.id, parseInt(id)));
    if (!sale) return Response.json({ error: "Venta no encontrada" }, { status: 404 });

    const oldItems = (Array.isArray(sale.items) ? sale.items : []) as SaleItem[];
    await restoreStock(oldItems);

    for (const it of newItems) {
      const [prod] = await db.select().from(products).where(eq(products.id, it.productId));
      const disp = prod ? prod.stock : 0;
      if (it.qty > disp) {
        await consumeStock(oldItems);
        return Response.json({ error: `Stock insuficiente para ${it.name}. Disponible: ${disp}` }, { status: 400 });
      }
    }

    await consumeStock(newItems);
    const total = newItems.reduce((a, b) => a + b.subtotal, 0);

    const [updated] = await db
      .update(sales)
      .set({ clientName: String(body.clientName || "").trim(), items: newItems, total: String(total) })
      .where(eq(sales.id, parseInt(id)))
      .returning();
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
    const [sale] = await db.select().from(sales).where(eq(sales.id, parseInt(id)));
    if (sale) {
      const items = (Array.isArray(sale.items) ? sale.items : []) as SaleItem[];
      await restoreStock(items);
      await db.delete(sales).where(eq(sales.id, parseInt(id)));
    }
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/sales",
};
