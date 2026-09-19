ALTER TABLE "obligations" ADD COLUMN "quote" text;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN "char_start" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN "char_end" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "obligations" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;