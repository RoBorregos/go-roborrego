import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const memberRouter = createTRPCRouter({
  // ─── Directory (any authenticated user) ────────────────────────────────────

  getDirectory: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        subTeam: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI"]).optional(),
        role: z.enum(["VIEWER", "MEMBER", "ADMIN"]).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: {
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { email: { contains: input.search, mode: "insensitive" } },
              {
                githubUsername: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
            ],
          }),
          ...(input.subTeam && { subTeam: input.subTeam }),
          ...(input.status && { status: input.status }),
          ...(input.role && { role: input.role }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          subTeam: true,
          role: true,
          status: true,
          joinDate: true,
          githubUsername: true,
          linkedinUrl: true,
          bio: true,
        },
        orderBy: { name: "asc" },
      });
    }),

  // ─── Single member ──────────────────────────────────────────────────────────

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          bio: true,
          githubUsername: true,
          linkedinUrl: true,
          graduationDate: true,
          birthday: true,
          joinDate: true,
          subTeam: true,
          role: true,
          status: true,
          webId: true,
          lastname: true,
          subtitle: true,
          semesters: true,
          tags: true,
          excludeFromExport: true,
          classYear: true,
        },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  // ─── Own profile ────────────────────────────────────────────────────────────

  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        profileEdits: {
          where: { status: "PENDING" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!user) return null;
    // Never expose raw tokens to the client — derive a boolean instead
    const { profileEdits, msAccessToken, msRefreshToken, msTokenExpiry, ...rest } = user;
    return {
      ...rest,
      pendingEdit: profileEdits[0] ?? null,
      microsoftConnected: msRefreshToken !== null,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        // Image is applied immediately (already uploaded to storage)
        image: z.string().url().optional(),
        // All other fields go through admin approval
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        githubUsername: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        graduationDate: z.date().optional(),
        birthday: z.date().optional(),
        subTeam: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { image, ...profileFields } = input;
      const userId = ctx.session.user.id;

      const hasProfileChanges = Object.values(profileFields).some(
        (v) => v !== undefined,
      );

      await ctx.db.$transaction(async (tx) => {
        // Image is applied directly — no approval needed
        if (image) {
          await tx.user.update({ where: { id: userId }, data: { image } });
        }

        // Profile text fields go through approval
        if (hasProfileChanges) {
          // Replace any existing pending edit for this user
          await tx.profileEdit.deleteMany({
            where: { userId, status: "PENDING" },
          });
          await tx.profileEdit.create({
            data: { userId, ...profileFields },
          });
        }
      });

      return { pending: hasProfileChanges };
    }),

  // ─── Admin: roster management ───────────────────────────────────────────────

  updateMember: adminProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email().optional(),
        name: z.string().min(1).optional(),
        role: z.enum(["VIEWER", "MEMBER", "ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI"]).optional(),
        subTeam: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        githubUsername: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        graduationDate: z.date().optional(),
        birthday: z.date().optional(),
        // Web export metadata
        webId: z.number().int().positive().optional(),
        lastname: z.string().optional(),
        subtitle: z.string().optional(),
        semesters: z.number().int().min(0).optional(),
        tags: z.string().optional(),
        excludeFromExport: z.boolean().optional(),
        classYear: z.number().int().min(1900).max(2100).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),

  // List all members with activity summary for admin roster view
  getRoster: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [users, totalMeetings] = await Promise.all([
        ctx.db.user.findMany({
          where: {
            ...(input.search && {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            }),
            ...(input.status && { status: input.status }),
          },
          include: {
            _count: {
              select: {
                attendances: true,
                workPlanCompletions: { where: { status: "APPROVED" } },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        ctx.db.meeting.count(),
      ]);

      return users.map(({ _count, ...u }) => ({
        ...u,
        attendanceCount: _count.attendances,
        completionsCount: _count.workPlanCompletions,
        attendanceRate:
          totalMeetings > 0
            ? Math.round((_count.attendances / totalMeetings) * 100)
            : null,
      }));
    }),

  registerMember: adminProcedure
    .input(
      z.object({
        email: z.string().email().transform((e) => e.toLowerCase()),
        name: z.string().min(1).optional(),
        role: z.enum(["VIEWER", "MEMBER", "ADMIN"]).default("MEMBER"),
        subTeam: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already registered.",
        });
      }
      return ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name ?? input.email.split("@")[0],
          role: input.role,
          subTeam: input.subTeam,
        },
      });
    }),

  importMembers: adminProcedure
    .input(
      z.array(
        z.object({
          name: z.string().min(1),
          email: z.string().email().transform((e) => e.toLowerCase()),
          role: z.enum(["VIEWER", "MEMBER", "ADMIN"]).default("MEMBER"),
          status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI"]).default("ACTIVE"),
          subTeam: z.string().optional(),
          phone: z.string().optional(),
          githubUsername: z.string().optional(),
        }),
      ).min(1).max(500),
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.allSettled(
        input.map((member) =>
          ctx.db.user.upsert({
            where: { email: member.email },
            create: member,
            update: {
              name: member.name,
              role: member.role,
              status: member.status,
              subTeam: member.subTeam,
              phone: member.phone,
              githubUsername: member.githubUsername,
            },
          }),
        ),
      );
      return {
        imported: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      };
    }),

  // ─── Onboarding ─────────────────────────────────────────────────────────────

  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        role: true,
        bio: true,
        phone: true,
        githubUsername: true,
        subTeam: true,
        onboardingDismissed: true,
        _count: {
          select: { attendances: true, projectMembers: true },
        },
      },
    });

    return {
      dismissed: user.onboardingDismissed,
      role: user.role,
      tasks: {
        profileComplete: !!(user.bio && user.phone && user.subTeam),
        githubConnected: !!user.githubUsername,
        teamAccessGranted: user.role !== "VIEWER",
        joinedProject: user._count.projectMembers > 0,
        attendedMeeting: user._count.attendances > 0,
      },
    };
  }),

  dismissOnboarding: protectedProcedure.mutation(({ ctx }) => {
    return ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingDismissed: true },
    });
  }),

  enableOnboarding: protectedProcedure.mutation(({ ctx }) => {
    return ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingDismissed: false },
    });
  }),

  // List distinct sub-teams for filter dropdowns
  getSubTeams: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.user.findMany({
      where: { subTeam: { not: null } },
      select: { subTeam: true },
      distinct: ["subTeam"],
      orderBy: { subTeam: "asc" },
    });
    return result.map((r) => r.subTeam).filter(Boolean) as string[];
  }),
});
