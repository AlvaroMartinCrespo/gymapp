import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const CATEGORIES = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Core",
] as const;
export type Category = (typeof CATEGORIES)[number];

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Catálogo 100 % cerrado: los ejercicios se insertan con el seed (paso 2.3)
export const exercisesCatalog = sqliteTable("exercises_catalog", {
  id: text("id").primaryKey(), // p. ej. 'leg_press'
  name: text("name").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  primaryMeshes: text("primary_meshes", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  secondaryMeshes: text("secondary_meshes", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  defaultCamera: text("default_camera", { enum: ["front", "back"] })
    .notNull()
    .default("front"),
});

export const workoutLogs = sqliteTable(
  "workout_logs",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
  },
  (t) => [uniqueIndex("workout_logs_user_date_uq").on(t.userId, t.date)],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: id(),
    workoutLogId: text("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercisesCatalog.id),
    setNumber: integer("set_number").notNull(),
    weight: real("weight").notNull(), // kg
    reps: integer("reps").notNull(),
    isPr: integer("is_pr", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("workout_sets_log_idx").on(t.workoutLogId),
    index("workout_sets_exercise_idx").on(t.exerciseId),
  ],
);

export const aiAlerts = sqliteTable(
  "ai_alerts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercisesCatalog.id),
    alertType: text("alert_type", { enum: ["STAGNATION", "FATIGUE"] }).notNull(),
    message: text("message").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ai_alerts_user_idx").on(t.userId, t.isRead)],
);

export const socialFeed = sqliteTable(
  "social_feed",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["WORKOUT_SUMMARY", "NEW_PR"] }).notNull(),
    referenceId: text("reference_id").notNull(),
    likesCount: integer("likes_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("social_feed_created_idx").on(t.createdAt)],
);
