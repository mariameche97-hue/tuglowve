CREATE TABLE "clients" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text,
	"instagram" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"category" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"price" numeric(10,2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY,
	"client_name" text NOT NULL,
	"date" text NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"total" numeric(10,2) DEFAULT '0' NOT NULL,
	"paid" numeric(10,2) DEFAULT '0' NOT NULL,
	"history" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
