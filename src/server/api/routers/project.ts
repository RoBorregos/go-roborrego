import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  memberProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { supabaseAdmin } from "~/lib/supabase-admin";

// ─── Shared input schemas ────────────────────────────────────────────────────

const taskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// ─── Auth helpers (inline — no separate helper fns to avoid type complexity) ─

export const projectRouter = createTRPCRouter({
  // ─── Projects ──────────────────────────────────────────────────────────────

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = ctx.session.user.role === "ADMIN";
    const projects = await ctx.db.project.findMany({
      where: {
        status: { not: "ARCHIVED" },
        // Non-admins only see private projects they are a member of
        ...(!isAdmin && {
          OR: [
            { isPrivate: false },
            { members: { some: { userId: ctx.session.user.id } } },
          ],
        }),
      },
      include: {
        _count: { select: { members: true, tasks: true } },
        members: {
          where: { userId: ctx.session.user.id },
          select: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return projects.map(({ members, ...p }) => ({
      ...p,
      myRole: members[0]?.role ?? null,
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.session.user.role === "ADMIN";
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.id,

          // Non-admins only see private projects they are a member of
          ...(!isAdmin && {
            OR: [
              { isPrivate: false },
              { members: { some: { userId: ctx.session.user.id } } },
            ],
          }),
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  subTeam: true,
                  role: true,
                },
              },
            },
            orderBy: { addedAt: "asc" },
          },
          links: { orderBy: { order: "asc" } },
          _count: { select: { tasks: true } },
        },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const myMembership = project.members.find(
        (m) => m.userId === ctx.session.user.id,
      );
      return {
        ...project,
        myRole: myMembership?.role ?? null,
        isAdmin: ctx.session.user.role === "ADMIN",
      };
    }),

  create: memberProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        subTeam: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        githubRepo: z.string().url().optional().or(z.literal("")),
        isPrivate: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            ...input,
            githubRepo: input.githubRepo,
            createdBy: ctx.session.user.id,
          },
        });
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: ctx.session.user.id,
            role: "PROJECT_MANAGER",
          },
        });
        return project;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        subTeam: z.string().optional(),
        status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        githubRepo: z.string().url().optional().or(z.literal("")),
        miroBoard: z.string().url().optional().or(z.literal("")),
        isPrivate: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: id, userId: ctx.session.user.id },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.project.update({
        where: { id },
        data: {
          ...data,
          githubRepo: data.githubRepo,
          miroBoard: data.miroBoard ?? null,
        },
      });
    }),

  // ─── Links ─────────────────────────────────────────────────────────────────

  updateLinks: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        links: z.array(
          z.object({
            name: z.string().min(1),
            url: z.string().url("Must be a valid URL"),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db.projectLink.deleteMany({
        where: { projectId: input.projectId },
      });
      await ctx.db.projectLink.createMany({
        data: input.links.map((l, i) => ({
          projectId: input.projectId,
          name: l.name,
          url: l.url,
          order: i,
        })),
      });
    }),

  // ─── Members ───────────────────────────────────────────────────────────────

  getAvailableMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.projectMember.findMany({
        where: { projectId: input.projectId },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((m) => m.userId));
      const users = await ctx.db.user.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          subTeam: true,
        },
        orderBy: { name: "asc" },
      });
      return users.filter((u) => !existingIds.has(u.id));
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z
          .enum(["PROJECT_MEMBER", "PROJECT_MANAGER"])
          .default("PROJECT_MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Admins are always managers
      const targetUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });
      const role =
        targetUser?.role === "ADMIN" ? "PROJECT_MANAGER" : input.role;
      return ctx.db.projectMember.create({ data: { ...input, role } });
    }),

  removeMember: protectedProcedure
    .input(z.object({ projectId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
      });
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["PROJECT_MEMBER", "PROJECT_MANAGER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own project role.",
        });
      // Block changing the role of a site-wide admin
      const target = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });
      if (target?.role === "ADMIN")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin users always hold the Manager role.",
        });
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.projectMember.update({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });
    }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  getTasks: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx, input }) => {
      const isAdmin = ctx.session.user.role === "ADMIN";

      return ctx.db.task.findMany({
        where: {
          projectId: input.projectId,

          ...(!isAdmin && {
            OR: [
              { project: { isPrivate: false } },
              {
                project: { members: { some: { userId: ctx.session.user.id } } },
              },
            ],
          }),
        },
        include: {
          assignees: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  getTask: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const isAdmin = ctx.session.user.role === "ADMIN";
      return ctx.db.task.findUnique({
        where: {
          id: input.id,
          ...(!isAdmin && {
            OR: [
              { project: { isPrivate: false } },
              {
                project: { members: { some: { userId: ctx.session.user.id } } },
              },
            ],
          }),
        },
        include: {
          assignees: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          comments: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          attachments: {
            include: {
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          creator: { select: { id: true, name: true } },
        },
      });
    }),

  createTask: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        status: taskStatusEnum.default("TODO"),
        priority: taskPriorityEnum.default("MEDIUM"),
        description: z.string().optional(),
        dueDate: z.date().optional(),
        labels: z.array(z.string()).default([]),
        assigneeIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: input.projectId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!m) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { assigneeIds, ...data } = input;
      return ctx.db.task.create({
        data: {
          ...data,
          createdBy: ctx.session.user.id,
          assignees: assigneeIds.length
            ? {
                createMany: { data: assigneeIds.map((userId) => ({ userId })) },
              }
            : undefined,
        },
      });
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: taskStatusEnum.optional(),
        priority: taskPriorityEnum.optional(),
        dueDate: z.date().nullable().optional(),
        labels: z.array(z.string()).optional(),
        assigneeIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, assigneeIds, ...data } = input;
      const task = await ctx.db.task.findUnique({
        where: { id },
        select: { projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: task.projectId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!m) throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.task.update({
        where: { id },
        data: {
          ...data,
          ...(assigneeIds !== undefined && {
            assignees: {
              deleteMany: {},
              createMany: {
                data: assigneeIds.map((userId) => ({ userId })),
              },
            },
          }),
        },
      });
    }),

  deleteTask: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        select: { projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: task.projectId,
              userId: ctx.session.user.id,
            },
          },
          select: { role: true },
        });
        if (m?.role !== "PROJECT_MANAGER")
          throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.task.delete({ where: { id: input.id } });
    }),

  // ─── Comments ──────────────────────────────────────────────────────────────

  addComment: protectedProcedure
    .input(z.object({ taskId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: task.projectId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!m) throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.taskComment.create({
        data: {
          taskId: input.taskId,
          userId: ctx.session.user.id,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });
    }),

  deleteComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.taskComment.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        comment.userId !== ctx.session.user.id &&
        ctx.session.user.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.taskComment.delete({ where: { id: input.id } });
    }),

  // ─── Attachments ───────────────────────────────────────────────────────────

  addAttachment: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        fileName: z.string().min(1),
        fileUrl: z.string().url(),
        storagePath: z.string().min(1),
        fileSize: z.number().int().positive(),
        mimeType: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId },
        select: { projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.session.user.role !== "ADMIN") {
        const m = await ctx.db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: task.projectId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!m) throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.taskAttachment.create({
        data: { ...input, userId: ctx.session.user.id },
        include: { user: { select: { id: true, name: true } } },
      });
    }),

  deleteAttachment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.taskAttachment.findUnique({
        where: { id: input.id },
        select: { userId: true, storagePath: true },
      });
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        attachment.userId !== ctx.session.user.id &&
        ctx.session.user.role !== "ADMIN"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Delete from Supabase Storage
      await supabaseAdmin.storage
        .from("task-attachments")
        .remove([attachment.storagePath]);
      return ctx.db.taskAttachment.delete({ where: { id: input.id } });
    }),
});
