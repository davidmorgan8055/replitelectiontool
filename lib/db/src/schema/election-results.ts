import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

// A checked singleton primary key ensures every server shares one document.
export const electionResultsTable = pgTable("election_results", {
  id: integer("id").primaryKey().default(1),
  document: jsonb("document").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("election_results_singleton", sql`${table.id} = 1`),
]);
