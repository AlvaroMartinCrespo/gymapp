import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const CARDIO_ACTIVITIES = [
  "treadmill",
  "running",
  "walking",
  "stationary_bike",
  "elliptical",
  "rowing",
  "jump_rope",
  "swimming",
] as const;
export type CardioActivity = (typeof CARDIO_ACTIVITIES)[number];

// 'sensor' está reservado al servidor: los clientes solo escriben 'manual' o 'estimated'.
export const CARDIO_DATA_SOURCES = ["manual", "estimated", "sensor"] as const;
export type CardioDataSource = (typeof CARDIO_DATA_SOURCES)[number];

const id = () =>
  uuid("id")
    .primaryKey()
    .defaultRandom();

const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow();

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    rankingsEnabled: boolean("rankings_enabled").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("profiles_username_uq").on(sql`lower(${table.username})`)],
);

export const coachUsage = pgTable(
  "coach_usage",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    requests: integer("requests").notNull(),
    minuteStart: timestamp("minute_start", { withTimezone: true }).notNull(),
    minuteRequests: integer("minute_requests").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

export const exercisesCatalog = pgTable("exercises_catalog", {
  id: text("id").primaryKey(), // p. ej. 'leg_press'
  name: text("name").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  primaryMeshes: jsonb("primary_meshes")
    .$type<string[]>()
    .notNull(),
  secondaryMeshes: jsonb("secondary_meshes")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  defaultCamera: text("default_camera", { enum: ["front", "back"] })
    .notNull()
    .default("front"),
});

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" })
      .default(sql`auth.uid()`),
    date: date("date").notNull().default(sql`current_date`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("workout_logs_user_date_uq").on(t.userId, t.date)],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: id(),
    workoutLogId: uuid("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercisesCatalog.id),
    setNumber: integer("set_number").notNull(),
    weight: numeric("weight", { precision: 8, scale: 2 }).notNull(),
    reps: integer("reps").notNull(),
    isPr: boolean("is_pr").notNull().default(false),
    clientRequestId: uuid("client_request_id"),
  },
  (t) => [
    index("workout_sets_log_idx").on(t.workoutLogId),
    index("workout_sets_exercise_idx").on(t.exerciseId),
    uniqueIndex("workout_sets_number_uq").on(t.workoutLogId, t.exerciseId, t.setNumber),
    uniqueIndex("workout_sets_request_uq").on(t.workoutLogId, t.clientRequestId),
  ],
);

// La fecha vive en workout_logs.date; la sesión cuelga del log del día.
export const cardioSessions = pgTable(
  "cardio_sessions",
  {
    id: id(),
    workoutLogId: uuid("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    activityType: text("activity_type", { enum: CARDIO_ACTIVITIES }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    distanceKm: numeric("distance_km", { precision: 7, scale: 3 }),
    avgHr: smallint("avg_hr"),
    maxHr: smallint("max_hr"),
    calories: integer("calories"),
    dataSource: text("data_source", { enum: CARDIO_DATA_SOURCES }).notNull().default("manual"),
    rpe: smallint("rpe"),
    clientRequestId: uuid("client_request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("cardio_sessions_log_idx").on(t.workoutLogId),
    uniqueIndex("cardio_sessions_request_uq").on(t.workoutLogId, t.clientRequestId),
  ],
);

export const aiAlerts = pgTable(
  "ai_alerts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercisesCatalog.id),
    alertType: text("alert_type", { enum: ["STAGNATION", "FATIGUE"] }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    analysisWeek: date("analysis_week"),
    sourceWorkoutLogId: uuid("source_workout_log_id").references(() => workoutLogs.id, { onDelete: "cascade" }),
    ruleCode: text("rule_code", { enum: ["STAGNATION_V1"] }),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_alerts_user_idx").on(t.userId, t.isRead),
    uniqueIndex("ai_alerts_stagnation_week_uq").on(t.userId, t.exerciseId, t.analysisWeek).where(sql`${t.ruleCode} = 'STAGNATION_V1'`),
  ],
);

export const socialFeed = pgTable(
  "social_feed",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["WORKOUT_SUMMARY", "NEW_PR"] }).notNull(),
    referenceId: uuid("reference_id").notNull(),
    likesCount: integer("likes_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("social_feed_created_idx").on(t.createdAt)],
);
