import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
  protectedProcedure,
} from "~/server/api/trpc";

export const workPlanRouter = createTRPCRouter({
  // ─── Semesters ──────────────────────────────────────────────────────────────

  getSemesters: protectedProcedure.query(({ ctx }) => {
    return ctx.db.semester.findMany({ orderBy: { startDate: "desc" } });
  }),

  getActiveSemester: protectedProcedure.query(({ ctx }) => {
    return ctx.db.semester.findFirst({ where: { isActive: true } });
  }),

  createSemester: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        startDate: z.date(),
        endDate: z.date(),
        isActive: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Deactivate any current active semester if this one is set active
      if (input.isActive) {
        await ctx.db.semester.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      return ctx.db.semester.create({ data: input });
    }),

  setActiveSemester: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.semester.updateMany({ data: { isActive: false } });
      return ctx.db.semester.update({
        where: { id: input.id },
        data: { isActive: true },
      });
    }),

  // ─── Activities ─────────────────────────────────────────────────────────────

  getActivities: protectedProcedure
    .input(z.object({ semesterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const activities = await ctx.db.workPlanActivity.findMany({
        where: { semesterId: input.semesterId },
        orderBy: { estimatedDate: "asc" },
      });

      // Attach current user's interest and completion status
      const userId = ctx.session.user.id;
      const interests = await ctx.db.workPlanInterest.findMany({
        where: { userId, activity: { semesterId: input.semesterId } },
        select: { activityId: true },
      });
      const completions = await ctx.db.workPlanCompletion.findMany({
        where: { userId, activity: { semesterId: input.semesterId } },
        select: { activityId: true, status: true, note: true, adminNote: true },
      });

      const interestSet = new Set(interests.map((i) => i.activityId));
      const completionMap = new Map(completions.map((c) => [c.activityId, c]));

      return activities.map((a) => ({
        ...a,
        isInterested: interestSet.has(a.id),
        completion: completionMap.get(a.id) ?? null,
      }));
    }),

  createActivity: adminProcedure
    .input(
      z.object({
        semesterId: z.string(),
        name: z.string().min(1),
        description: z.string().min(1),
        points: z.number().int().min(0),
        estimatedDate: z.date().optional(),
        adminMessage: z.string().optional(),
        isMandatory: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanActivity.create({ data: input });
    }),

  updateActivity: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        points: z.number().int().min(0).optional(),
        estimatedDate: z.date().optional(),
        adminMessage: z.string().optional(),
        isMandatory: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.workPlanActivity.update({ where: { id }, data });
    }),

  deleteActivity: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanActivity.delete({ where: { id: input.id } });
    }),

  // ─── Interest ───────────────────────────────────────────────────────────────

  expressInterest: protectedProcedure
    .input(z.object({ activityId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanInterest.create({
        data: { userId: ctx.session.user.id, activityId: input.activityId },
      });
    }),

  removeInterest: protectedProcedure
    .input(z.object({ activityId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanInterest.delete({
        where: {
          userId_activityId: {
            userId: ctx.session.user.id,
            activityId: input.activityId,
          },
        },
      });
    }),

  // ─── Completion submissions ─────────────────────────────────────────────────

  submitCompletion: protectedProcedure
    .input(
      z.object({
        activityId: z.string(),
        note: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent duplicate submissions (upsert so a rejection can be resubmitted)
      const existing = await ctx.db.workPlanCompletion.findFirst({
        where: {
          userId: ctx.session.user.id,
          activityId: input.activityId,
          status: "PENDING",
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have a pending submission for this activity.",
        });
      }
      return ctx.db.workPlanCompletion.create({
        data: {
          userId: ctx.session.user.id,
          activityId: input.activityId,
          note: input.note,
          status: "PENDING",
        },
      });
    }),

  // ─── Admin: review completions ──────────────────────────────────────────────

  getPendingCompletions: protectedProcedure
    .input(z.object({ semesterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isAdmin = ctx.session.user.role === "ADMIN";

      const where = isAdmin
        ? {
            status: "PENDING" as const,
            ...(input.semesterId && { activity: { semesterId: input.semesterId } }),
          }
        : {
            status: "PENDING" as const,
            activity: {
              reviewers: { some: { userId } },
              ...(input.semesterId && { semesterId: input.semesterId }),
            },
          };

      return ctx.db.workPlanCompletion.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          activity: { select: { id: true, name: true, points: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  reviewCompletion: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
        adminNote: z
          .string()
          .optional()
          .transform((v) => (v !== "" ? v : undefined)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isAdmin = ctx.session.user.role === "ADMIN";

      if (!isAdmin) {
        const completion = await ctx.db.workPlanCompletion.findUnique({
          where: { id: input.id },
          select: { activityId: true },
        });
        if (!completion) throw new TRPCError({ code: "NOT_FOUND" });
        const isReviewer = await ctx.db.workPlanActivityReviewer.findUnique({
          where: {
            activityId_userId: { activityId: completion.activityId, userId },
          },
        });
        if (!isReviewer) throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.workPlanCompletion.update({
        where: { id: input.id },
        data: { status: input.status, adminNote: input.adminNote },
      });
    }),

  // ─── Admin: manage activity reviewers ───────────────────────────────────────

  getActivityReviewers: adminProcedure
    .input(z.object({ activityId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.workPlanActivityReviewer.findMany({
        where: { activityId: input.activityId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  addActivityReviewer: adminProcedure
    .input(z.object({ activityId: z.string(), userId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanActivityReviewer.create({ data: input });
    }),

  removeActivityReviewer: adminProcedure
    .input(z.object({ activityId: z.string(), userId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.workPlanActivityReviewer.delete({
        where: {
          activityId_userId: {
            activityId: input.activityId,
            userId: input.userId,
          },
        },
      });
    }),

  isReviewer: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.workPlanActivityReviewer.count({
      where: { userId: ctx.session.user.id },
    });
    return count > 0;
  }),

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  getLeaderboard: protectedProcedure
    .input(z.object({ semesterId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get approved completions grouped by user for this semester
      const completions = await ctx.db.workPlanCompletion.findMany({
        where: {
          status: "APPROVED",
          activity: { semesterId: input.semesterId },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              status: true,
              role: true,
            },
          },
          activity: { select: { points: true } },
        },
      });

      // Aggregate points per user (only active, non-admin members)
      const pointsMap = new Map<
        string,
        { user: (typeof completions)[0]["user"]; points: number }
      >();
      for (const c of completions) {
        if (c.user.status !== "ACTIVE" || c.user.role === "ADMIN") continue;
        const entry = pointsMap.get(c.user.id);
        if (entry) {
          entry.points += c.activity.points;
        } else {
          pointsMap.set(c.user.id, {
            user: c.user,
            points: c.activity.points,
          });
        }
      }

      return Array.from(pointsMap.values())
        .filter((e) => e.points > 0)
        .sort((a, b) => b.points - a.points)
        .map((e, i) => ({ rank: i + 1, ...e }));
    }),

  // ─── My work plan summary ────────────────────────────────────────────────────

  // ─── Admin: set member interest / completion ────────────────────────────────

  adminToggleInterest: adminProcedure
    .input(z.object({ userId: z.string(), activityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workPlanInterest.findUnique({
        where: {
          userId_activityId: {
            userId: input.userId,
            activityId: input.activityId,
          },
        },
      });
      if (existing) {
        return ctx.db.workPlanInterest.delete({
          where: {
            userId_activityId: {
              userId: input.userId,
              activityId: input.activityId,
            },
          },
        });
      }
      return ctx.db.workPlanInterest.create({
        data: { userId: input.userId, activityId: input.activityId },
      });
    }),

  adminToggleCompletion: adminProcedure
    .input(z.object({ userId: z.string(), activityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workPlanCompletion.findFirst({
        where: {
          userId: input.userId,
          activityId: input.activityId,
          status: "APPROVED",
        },
      });
      if (existing) {
        return ctx.db.workPlanCompletion.delete({ where: { id: existing.id } });
      }
      // Remove any non-approved completion first so upsert stays clean
      await ctx.db.workPlanCompletion.deleteMany({
        where: { userId: input.userId, activityId: input.activityId },
      });
      return ctx.db.workPlanCompletion.create({
        data: {
          userId: input.userId,
          activityId: input.activityId,
          note: "Marked as completed by admin",
          status: "APPROVED",
        },
      });
    }),

  // ─── View any member's progress (all authenticated users) ───────────────────

  getMemberActivities: memberProcedure
    .input(z.object({ semesterId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const activities = await ctx.db.workPlanActivity.findMany({
        where: { semesterId: input.semesterId },
        orderBy: { estimatedDate: "asc" },
      });
      const [interests, completions] = await Promise.all([
        ctx.db.workPlanInterest.findMany({
          where: {
            userId: input.userId,
            activity: { semesterId: input.semesterId },
          },
          select: { activityId: true },
        }),
        ctx.db.workPlanCompletion.findMany({
          where: {
            userId: input.userId,
            activity: { semesterId: input.semesterId },
          },
          select: {
            activityId: true,
            status: true,
            note: true,
            adminNote: true,
          },
        }),
      ]);
      const interestSet = new Set(interests.map((i) => i.activityId));
      const completionMap = new Map(completions.map((c) => [c.activityId, c]));
      return activities.map((a) => ({
        ...a,
        isInterested: interestSet.has(a.id),
        completion: completionMap.get(a.id) ?? null,
      }));
    }),

  getMemberSummary: memberProcedure
    .input(z.object({ semesterId: z.string(), userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [interests, completions, allActivities] = await Promise.all([
        ctx.db.workPlanInterest.findMany({
          where: {
            userId: input.userId,
            activity: { semesterId: input.semesterId },
          },
          include: { activity: true },
        }),
        ctx.db.workPlanCompletion.findMany({
          where: {
            userId: input.userId,
            activity: { semesterId: input.semesterId },
          },
          include: { activity: true },
        }),
        ctx.db.workPlanActivity.findMany({
          where: { semesterId: input.semesterId },
        }),
      ]);
      const approvedPoints = completions
        .filter((c) => c.status === "APPROVED")
        .reduce((sum, c) => sum + c.activity.points, 0);
      const tentativePoints = interests.reduce(
        (sum, i) => sum + i.activity.points,
        0,
      );
      const mandatoryActivities = allActivities.filter((a) => a.isMandatory);
      const completedMandatoryIds = new Set(
        completions
          .filter(
            (c) =>
              c.status === "APPROVED" &&
              mandatoryActivities.some((m) => m.id === c.activityId),
          )
          .map((c) => c.activityId),
      );
      return {
        approvedPoints,
        tentativePoints,
        interestedCount: interests.length,
        mandatoryTotal: mandatoryActivities.length,
        mandatoryCompleted: completedMandatoryIds.size,
      };
    }),

  getAdminMemberStats: adminProcedure
    .input(z.object({ semesterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [members, completions, interests] = await Promise.all([
        ctx.db.user.findMany({
          select: { id: true, name: true, image: true, status: true, role: true },
          orderBy: { name: "asc" },
        }),
        ctx.db.workPlanCompletion.findMany({
          where: {
            status: "APPROVED",
            activity: { semesterId: input.semesterId },
          },
          select: { userId: true, activity: { select: { points: true } } },
        }),
        ctx.db.workPlanInterest.findMany({
          where: { activity: { semesterId: input.semesterId } },
          select: { userId: true, activity: { select: { points: true } } },
        }),
      ]);

      const totalMap = new Map<string, number>();
      for (const c of completions) {
        totalMap.set(
          c.userId,
          (totalMap.get(c.userId) ?? 0) + c.activity.points,
        );
      }
      const tentativeMap = new Map<string, number>();
      for (const i of interests) {
        tentativeMap.set(
          i.userId,
          (tentativeMap.get(i.userId) ?? 0) + i.activity.points,
        );
      }

      return members.map((m) => {
        const totalPoints = totalMap.get(m.id) ?? 0;
        const tentativePoints = tentativeMap.get(m.id) ?? 0;
        return {
          user: m,
          totalPoints,
          tentativePoints,
          difference: totalPoints - tentativePoints,
        };
      });
    }),

  getMySummary: protectedProcedure
    .input(z.object({ semesterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [interests, completions, allActivities] = await Promise.all([
        ctx.db.workPlanInterest.findMany({
          where: { userId, activity: { semesterId: input.semesterId } },
          include: { activity: true },
        }),
        ctx.db.workPlanCompletion.findMany({
          where: { userId, activity: { semesterId: input.semesterId } },
          include: { activity: true },
        }),
        ctx.db.workPlanActivity.findMany({
          where: { semesterId: input.semesterId },
        }),
      ]);

      const approvedPoints = completions
        .filter((c) => c.status === "APPROVED")
        .reduce((sum, c) => sum + c.activity.points, 0);

      const tentativePoints = interests.reduce(
        (sum, i) => sum + i.activity.points,
        0,
      );

      const mandatoryActivities = allActivities.filter((a) => a.isMandatory);
      const completedMandatoryIds = new Set(
        completions
          .filter(
            (c) =>
              c.status === "APPROVED" &&
              mandatoryActivities.some((m) => m.id === c.activityId),
          )
          .map((c) => c.activityId),
      );

      return {
        approvedPoints,
        tentativePoints,
        interestedCount: interests.length,
        completions,
        mandatoryTotal: mandatoryActivities.length,
        mandatoryCompleted: completedMandatoryIds.size,
      };
    }),
});
