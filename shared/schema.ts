import {
  bigint,
  boolean,
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

const id = (name: string) => int(name).autoincrement().primaryKey();
const money = (name: string) => decimal(name, { precision: 10, scale: 2 });
const metric = (name: string) => decimal(name, { precision: 10, scale: 2 });

// === BRANCHES ===
export const branches = mysqlTable("branches", {
  id: id("id"),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true });
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;

// === USERS ===
export const users = mysqlTable("users", {
  id: id("id"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["owner", "admin", "coach", "member", "dietitian"]).default("member").notNull(),
  branchId: int("branch_id").references(() => branches.id),
  phone: varchar("phone", { length: 50 }),
  status: mysqlEnum("status", ["active", "suspended", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// === MEMBERS ===
export const members = mysqlTable("members", {
  id: id("id"),
  userId: int("user_id").references(() => users.id).notNull(),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  primaryPackageId: int("primary_package_id").references(() => packages.id),
  membershipNumber: varchar("membership_number", { length: 100 }),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  birthDate: date("birth_date"),
  emergencyContact: varchar("emergency_contact", { length: 255 }),
  joinDate: date("join_date"),
  status: mysqlEnum("status", ["active", "expired", "frozen"]).default("active").notNull(),
  notes: text("notes"),
  height: metric("height"),
  weight: metric("weight"),
  fitnessGoal: text("fitness_goal"),
});

export const insertMemberSchema = createInsertSchema(members).omit({ id: true });
export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;

// === COACHES ===
export const coaches = mysqlTable("coaches", {
  id: id("id"),
  userId: int("user_id").references(() => users.id).notNull(),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  specialization: varchar("specialization", { length: 255 }),
  salary: money("salary"),
  hireDate: date("hire_date"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  bio: text("bio"),
});

export const insertCoachSchema = createInsertSchema(coaches).omit({ id: true });
export type Coach = typeof coaches.$inferSelect;
export type InsertCoach = z.infer<typeof insertCoachSchema>;

// === PACKAGES ===
export const packages = mysqlTable("packages", {
  id: id("id"),
  name: varchar("name", { length: 255 }).notNull(),
  tier: mysqlEnum("tier", ["bronze", "silver", "gold"]).default("bronze").notNull(),
  billingCycle: mysqlEnum("billing_cycle", ["1_month", "3_months", "1_year"]).default("1_month").notNull(),
  description: text("description"),
  price: money("price").notNull(),
  durationDays: int("duration_days").notNull(),
  branchId: int("branch_id").references(() => branches.id),
  gymAccessHours: int("gym_access_hours"),
  coachHours: int("coach_hours").default(0),
  dietitianHours: int("dietitian_hours").default(0),
  allowsAllBranches: boolean("allows_all_branches").default(false),
  sessionsPerWeek: int("sessions_per_week"),
  totalClasses: int("total_classes"),
  includesGymAccess: boolean("includes_gym_access").default(true),
  includesClasses: boolean("includes_classes").default(true),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
});

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

// === SUBSCRIPTIONS ===
export const subscriptions = mysqlTable("subscriptions", {
  id: id("id"),
  memberId: int("member_id").references(() => members.id).notNull(),
  packageId: int("package_id").references(() => packages.id).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  remainingClasses: int("remaining_classes"),
  status: mysqlEnum("status", ["active", "expired", "canceled"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// === CLASSES ===
export const classes = mysqlTable("classes", {
  id: id("id"),
  branchId: int("branch_id").references(() => branches.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coachId: int("coach_id").references(() => coaches.id),
  classDate: date("class_date").notNull(),
  startTime: varchar("start_time", { length: 32 }).notNull(),
  endTime: varchar("end_time", { length: 32 }).notNull(),
  capacity: int("capacity").notNull(),
  price: money("price").notNull(),
  priceType: mysqlEnum("price_type", ["per_class", "monthly"]).default("per_class").notNull(),
  priceExtra: money("price_extra"),
  requiresExtraPayment: boolean("requires_extra_payment").default(false),
  status: mysqlEnum("status", ["scheduled", "canceled", "completed"]).default("scheduled").notNull(),
});

export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

// === CLASS BOOKINGS ===
export const classBookings = mysqlTable("class_bookings", {
  id: id("id"),
  classId: int("class_id").references(() => classes.id).notNull(),
  memberId: int("member_id").references(() => members.id).notNull(),
  bookingType: mysqlEnum("booking_type", ["package", "extra_payment"]).notNull(),
  subscriptionId: int("subscription_id").references(() => subscriptions.id),
  paymentId: int("payment_id"),
  status: mysqlEnum("status", ["booked", "attended", "canceled"]).default("booked").notNull(),
  bookedAt: timestamp("booked_at").defaultNow(),
});

export const insertClassBookingSchema = createInsertSchema(classBookings).omit({ id: true, bookedAt: true });
export type ClassBooking = typeof classBookings.$inferSelect;
export type InsertClassBooking = z.infer<typeof insertClassBookingSchema>;

// === PAYMENTS ===
export const payments = mysqlTable("payments", {
  id: id("id"),
  memberId: int("member_id").references(() => members.id).notNull(),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  subscriptionId: int("subscription_id").references(() => subscriptions.id),
  classBookingId: int("class_booking_id").references(() => classBookings.id),
  amount: money("amount").notNull(),
  paymentType: mysqlEnum("payment_type", ["package_purchase", "class_extra", "product_purchase", "other"]).notNull(),
  paymentMethod: mysqlEnum("payment_method", ["cash", "card", "online"]).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("paid").notNull(),
  transactionRef: varchar("transaction_ref", { length: 255 }),
  notes: text("notes"),
  paidAt: timestamp("paid_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, paidAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// === ATTENDANCE ===
export const attendance = mysqlTable("attendance", {
  id: id("id"),
  classId: int("class_id").references(() => classes.id),
  memberId: int("member_id").references(() => members.id).notNull(),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  checkinTime: timestamp("checkin_time").defaultNow(),
  attendanceType: mysqlEnum("attendance_type", ["gym_entry", "class_attendance"]).notNull(),
  markedBy: int("marked_by").references(() => users.id),
  notes: text("notes"),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, checkinTime: true });
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

// === PRODUCTS ===
export const products = mysqlTable("products", {
  id: id("id"),
  branchId: int("branch_id").references(() => branches.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: money("price").notNull(),
  stockQty: int("stock_qty").default(0),
  imageUrl: varchar("image_url", { length: 1024 }),
  category: varchar("category", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// === ORDERS ===
export const orders = mysqlTable("orders", {
  id: id("id"),
  memberId: int("member_id").references(() => members.id).notNull(),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  totalAmount: money("total_amount").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "paid", "failed"]).default("pending").notNull(),
  orderStatus: mysqlEnum("order_status", ["open", "shipped", "closed"]).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = mysqlTable("order_items", {
  id: id("id"),
  orderId: int("order_id").references(() => orders.id).notNull(),
  productId: int("product_id").references(() => products.id).notNull(),
  qty: int("qty").notNull(),
  unitPrice: money("unit_price").notNull(),
  totalPrice: money("total_price").notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// === LEADS (CRM) ===
export const leads = mysqlTable("leads", {
  id: id("id"),
  branchId: int("branch_id").references(() => branches.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  source: mysqlEnum("source", ["walk_in", "social", "website", "referral", "other"]).default("other"),
  status: mysqlEnum("status", ["new", "contacted", "converted", "lost"]).default("new").notNull(),
  assignedTo: int("assigned_to").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export const leadTasks = mysqlTable("lead_tasks", {
  id: id("id"),
  leadId: int("lead_id").references(() => leads.id).notNull(),
  assignedTo: int("assigned_to").references(() => users.id),
  dueDate: date("due_date"),
  status: mysqlEnum("status", ["open", "done", "canceled"]).default("open").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadTaskSchema = createInsertSchema(leadTasks).omit({ id: true, createdAt: true });
export type LeadTask = typeof leadTasks.$inferSelect;
export type InsertLeadTask = z.infer<typeof insertLeadTaskSchema>;

// === DIET PLANS (Dietitian) ===
export const dietPlans = mysqlTable("diet_plans", {
  id: id("id"),
  memberId: int("member_id").references(() => members.id).notNull(),
  dietitianId: int("dietitian_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  calories: int("calories"),
  protein: metric("protein"),
  carbs: metric("carbs"),
  fats: metric("fats"),
  notes: text("notes"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDietPlanSchema = createInsertSchema(dietPlans).omit({ id: true, createdAt: true });
export type DietPlan = typeof dietPlans.$inferSelect;
export type InsertDietPlan = z.infer<typeof insertDietPlanSchema>;

// === CONTACT MESSAGES ===
export const contactMessages = mysqlTable("contact_messages", {
  id: id("id"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "reviewed", "closed"]).default("new").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true, status: true });
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;

// === NEWSLETTER ===
export const newsletterSubscribers = mysqlTable("newsletter_subscribers", {
  id: id("id"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", ["subscribed", "unsubscribed"]).default("subscribed").notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
});

// === RELATIONS ===
export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  members: many(members),
  coaches: many(coaches),
  classes: many(classes),
}));

export const usersRelations = relations(users, ({ one }) => ({
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, { fields: [members.userId], references: [users.id] }),
  branch: one(branches, { fields: [members.branchId], references: [branches.id] }),
  primaryPackage: one(packages, { fields: [members.primaryPackageId], references: [packages.id] }),
  subscriptions: many(subscriptions),
  payments: many(payments),
  attendance: many(attendance),
}));

export const coachesRelations = relations(coaches, ({ one, many }) => ({
  user: one(users, { fields: [coaches.userId], references: [users.id] }),
  branch: one(branches, { fields: [coaches.branchId], references: [branches.id] }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, { fields: [classes.branchId], references: [branches.id] }),
  coach: one(coaches, { fields: [classes.coachId], references: [coaches.id] }),
  bookings: many(classBookings),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  member: one(members, { fields: [subscriptions.memberId], references: [members.id] }),
  package: one(packages, { fields: [subscriptions.packageId], references: [packages.id] }),
}));

export const classBookingsRelations = relations(classBookings, ({ one }) => ({
  class: one(classes, { fields: [classBookings.classId], references: [classes.id] }),
  member: one(members, { fields: [classBookings.memberId], references: [members.id] }),
  subscription: one(subscriptions, { fields: [classBookings.subscriptionId], references: [subscriptions.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  member: one(members, { fields: [payments.memberId], references: [members.id] }),
  branch: one(branches, { fields: [payments.branchId], references: [branches.id] }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  branch: one(branches, { fields: [leads.branchId], references: [branches.id] }),
  assignedUser: one(users, { fields: [leads.assignedTo], references: [users.id] }),
  tasks: many(leadTasks),
}));
