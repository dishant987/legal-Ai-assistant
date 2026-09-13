CREATE TYPE "public"."finding_kind" AS ENUM('risk', 'obligation', 'inconsistency', 'unusual', 'missing');--> statement-breakpoint
CREATE TYPE "public"."provider_outcome" AS ENUM('ok', 'timeout', 'rate_limited', 'http_error', 'parse_error', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"provider_used" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"verified_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"doc_type" text,
	"jurisdiction_state" text,
	"page_count" integer,
	"cloudinary_public_id" text,
	"stored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"kind" "finding_kind" NOT NULL,
	"severity" "severity" NOT NULL,
	"quote" text NOT NULL,
	"char_start" integer NOT NULL,
	"char_end" integer NOT NULL,
	"plain_text" text NOT NULL,
	"market_note" text,
	"statute_ref" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"party" text NOT NULL,
	"duty" text NOT NULL,
	"due_by" text,
	"consequence" text
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"stage" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"outcome" "provider_outcome" NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_document_id_idx" ON "analyses" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "findings_analysis_id_idx" ON "findings" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "obligations_analysis_id_idx" ON "obligations" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "provider_events_created_at_idx" ON "provider_events" USING btree ("created_at" DESC NULLS LAST);