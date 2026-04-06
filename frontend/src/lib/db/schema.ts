import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	email: text("email").unique().notNull(),
	name: text("name"),
	image: text("image"),
	googleId: text("google_id").unique(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	invitedById: integer("invited_by_id").references((): AnyPgColumn => users.id),
});

export const inviteCodes = pgTable("invite_codes", {
	id: serial("id").primaryKey(),
	code: text("code").unique().notNull(),
	createdById: integer("created_by_id")
		.references(() => users.id)
		.notNull(),
	usedById: integer("used_by_id").references(() => users.id),
	usedAt: timestamp("used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
