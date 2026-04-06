CREATE TABLE "invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by_id" integer NOT NULL,
	"used_by_id" integer,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"google_id" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_by_id" integer,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;