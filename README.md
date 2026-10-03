# TUGLOW.VE — Beauty & Cosmetics Suite

Internal management tool for TUGLOW.VE, a beauty and cosmetics business. It covers a sales dashboard, inventory
tracking, client records, and sales/collections (installment payments, WhatsApp status messages, and printable
sales receipts).

## Key technologies

- Static frontend: plain HTML, CSS, and vanilla JavaScript (`public/`)
- Netlify Functions (TypeScript) for the API (`netlify/functions/`)
- Netlify Database (managed Postgres) with Drizzle ORM for persistence (`db/`)

## Running locally

```bash
npm install
npx netlify dev --port 8889
```

This starts the site and API functions locally, including the local Netlify Database emulation. Open
`http://localhost:8889`.

## Data model

- `products` — inventory items (name, category, stock, minimum stock, price)
- `clients` — customer records (name, phone/WhatsApp, Instagram)
- `sales` — sales/invoices with line items, total, amount paid, and a payment history

Schema lives in `db/schema.ts`; any change to it requires a new migration via
`npx drizzle-kit generate --name <description>`.
