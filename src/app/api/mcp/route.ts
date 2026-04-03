/**
 * HTTP MCP endpoint
 *
 * Implements the MCP JSON-RPC protocol over HTTP POST.
 * Authenticate with: Authorization: Bearer <api_key>
 *
 * The key is obtained from the profile settings page.
 * Keys expire 3 hours after generation and carry the same permissions as their owner.
 *
 * Permissions:
 *   VIEWER  — read-only tools
 *   MEMBER  — read + create_task (own projects only)
 *   ADMIN   — all tools including register_member, create_meeting, and all work plan management
 */

import crypto from "crypto";

import type { Prisma } from "../../../../generated/prisma";
import { supabaseAdmin } from "~/lib/supabase-admin";
import { db } from "~/server/db";
import { env } from "~/env.js";

async function uploadAvatar(
  userId: string,
  imageBase64: string,
  contentType: string,
): Promise<string> {
  const ext = contentType.split("/")[1] ?? "jpg";
  const path = `${userId}.${ext}`;
  const buffer = Buffer.from(imageBase64, "base64");
  const { error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type McpUser = {
  id: string;
  email: string;
  role: "VIEWER" | "MEMBER" | "ADMIN";
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function authenticate(request: Request): Promise<McpUser | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const keyHash = crypto.createHash("sha256").update(token).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!apiKey) return null;
  if (apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt without blocking the response
  void db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey.user as McpUser;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_members",
    description: "List team members. Optionally filter by status or sub-team.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "ALUMNI"] },
        subTeam: { type: "string" },
        role: { type: "string", enum: ["VIEWER", "MEMBER", "ADMIN"] },
      },
    },
  },
  {
    name: "list_projects",
    description:
      "List projects. Non-admins only see public projects they are a member of.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ACTIVE", "COMPLETED", "ARCHIVED"] },
      },
    },
  },
  {
    name: "get_project",
    description: "Get full details for a project including members and tasks.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: { projectId: { type: "string" } },
    },
  },
  {
    name: "list_meetings",
    description: "List meetings with attendance counts.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
        projectId: { type: "string" },
      },
    },
  },
  {
    name: "get_attendance_report",
    description: "Get attendance rates per member.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "ISO date string" },
        endDate: { type: "string", description: "ISO date string" },
        subTeam: { type: "string" },
      },
    },
  },
  {
    name: "get_workplan_leaderboard",
    description:
      "Get the work plan points leaderboard for the active semester.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_active_semester",
    description:
      "Get the active semester with activities and completion stats.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_task",
    description:
      "Create a task in a project. Caller must be a project member or admin.",
    inputSchema: {
      type: "object",
      required: ["projectId", "title"],
      properties: {
        projectId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"],
        },
      },
    },
  },
  {
    name: "register_member",
    description: "Pre-register a new member by email. Admin only.",
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        lastname: { type: "string" },
        role: { type: "string", enum: ["VIEWER", "MEMBER", "ADMIN"] },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "ALUMNI"] },
        subTeam: { type: "string" },
        phone: { type: "string" },
        bio: { type: "string" },
        githubUsername: { type: "string" },
        linkedinUrl: { type: "string" },
        graduationDate: { type: "string", description: "ISO date string" },
        subtitle: { type: "string" },
        semesters: { type: "number" },
        tags: { type: "string", description: "Comma-separated skill tags" },
        excludeFromExport: { type: "boolean" },
        classYear: {
          type: "number",
          description: "Year the member joined the team (e.g. 2022)",
        },
        webId: {
          type: "number",
          description: "Export order ID (unique positive integer)",
        },
        imageBase64: { type: "string", description: "Avatar image as base64" },
        imageContentType: {
          type: "string",
          description: "MIME type, e.g. image/jpeg",
        },
      },
    },
  },
  {
    name: "update_member",
    description:
      "Update profile fields for an existing member. Only provided fields are changed. Admin only.",
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string" },
        name: { type: "string" },
        lastname: { type: "string" },
        role: { type: "string", enum: ["VIEWER", "MEMBER", "ADMIN"] },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "ALUMNI"] },
        subTeam: { type: "string" },
        phone: { type: "string" },
        bio: { type: "string" },
        githubUsername: { type: "string" },
        linkedinUrl: { type: "string" },
        graduationDate: { type: "string", description: "ISO date string" },
        subtitle: { type: "string" },
        semesters: { type: "number" },
        tags: { type: "string", description: "Comma-separated skill tags" },
        excludeFromExport: { type: "boolean" },
        classYear: {
          type: "number",
          description: "Year the member joined the team (e.g. 2022)",
        },
        webId: {
          type: "number",
          description: "Export order ID (unique positive integer)",
        },
        imageBase64: { type: "string", description: "Avatar image as base64" },
        imageContentType: {
          type: "string",
          description: "MIME type, e.g. image/jpeg",
        },
      },
    },
  },
  {
    name: "create_meeting",
    description: "Create a new meeting. Admin only.",
    inputSchema: {
      type: "object",
      required: ["title", "startTime"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        startTime: { type: "string", description: "ISO datetime string" },
        duration: { type: "number", description: "Minutes (default 60)" },
        projectId: { type: "string" },
      },
    },
  },

  // ── Work plan admin tools ──
  {
    name: "list_semesters",
    description: "List all semesters. Admin only.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_semester",
    description: "Create a new semester. Admin only.",
    inputSchema: {
      type: "object",
      required: ["name", "startDate", "endDate"],
      properties: {
        name: { type: "string" },
        startDate: { type: "string", description: "ISO date string" },
        endDate: { type: "string", description: "ISO date string" },
        setActive: {
          type: "boolean",
          description: "Make this the active semester (default false)",
        },
      },
    },
  },
  {
    name: "set_active_semester",
    description:
      "Set the active semester (deactivates all others). Admin only.",
    inputSchema: {
      type: "object",
      required: ["semesterId"],
      properties: { semesterId: { type: "string" } },
    },
  },
  {
    name: "list_activities",
    description: "List work plan activities for a semester. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        semesterId: {
          type: "string",
          description: "Defaults to active semester",
        },
      },
    },
  },
  {
    name: "create_activity",
    description: "Create a work plan activity in a semester. Admin only.",
    inputSchema: {
      type: "object",
      required: ["semesterId", "name", "points"],
      properties: {
        semesterId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        points: { type: "number" },
        isMandatory: { type: "boolean", description: "Default false" },
      },
    },
  },
  {
    name: "update_activity",
    description: "Update a work plan activity. Admin only.",
    inputSchema: {
      type: "object",
      required: ["activityId"],
      properties: {
        activityId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        points: { type: "number" },
        isMandatory: { type: "boolean" },
      },
    },
  },
  {
    name: "get_pending_completions",
    description:
      "List work plan completions awaiting admin review. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        semesterId: {
          type: "string",
          description: "Defaults to active semester",
        },
      },
    },
  },
  {
    name: "review_completion",
    description:
      "Approve or reject a work plan completion submission. Admin only.",
    inputSchema: {
      type: "object",
      required: ["completionId", "decision"],
      properties: {
        completionId: { type: "string" },
        decision: { type: "string", enum: ["APPROVED", "REJECTED"] },
        adminMessage: {
          type: "string",
          description: "Optional feedback to member",
        },
      },
    },
  },
  {
    name: "get_member_workplan_summary",
    description:
      "Get a specific member's work plan progress for the active semester. Admin only.",
    inputSchema: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { type: "string" },
        semesterId: {
          type: "string",
          description: "Defaults to active semester",
        },
      },
    },
  },
];

// ─── Tool dispatch ────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function forbidden(msg: string) {
  return {
    content: [{ type: "text", text: `Forbidden: ${msg}` }],
    isError: true,
  };
}

function toolError(msg: string) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  user: McpUser,
) {
  switch (name) {
    case "list_members": {
      const where: Prisma.UserWhereInput = {};
      if (args.status)
        where.status = args.status as Prisma.EnumMemberStatusFilter;
      if (args.subTeam) where.subTeam = args.subTeam as string;
      if (args.role) where.role = args.role as Prisma.EnumRoleFilter;
      const members = await db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          subTeam: true,
          bio: true,
          githubUsername: true,
          joinDate: true,
          lastLoginAt: true,
          webId: true,
          linkedinUrl: true,
          graduationDate: true,
        },
        orderBy: { name: "asc" },
      });
      return ok({ count: members.length, members });
    }

    case "list_projects": {
      const isAdmin = user.role === "ADMIN";
      const projects = await db.project.findMany({
        where: {
          ...(args.status
            ? { status: args.status as "ACTIVE" | "COMPLETED" | "ARCHIVED" }
            : { status: { not: "ARCHIVED" as const } }),
          ...(!isAdmin && {
            OR: [
              { isPrivate: false },
              { members: { some: { userId: user.id } } },
            ],
          }),
        },
        include: { _count: { select: { members: true, tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
      return ok({ count: projects.length, projects });
    }

    case "get_project": {
      const project = await db.project.findUnique({
        where: { id: args.projectId as string },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, subTeam: true },
              },
            },
          },
          tasks: {
            include: {
              assignees: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!project) return toolError("Project not found");
      // Non-admins can't see private projects they're not a member of
      if (project.isPrivate && user.role !== "ADMIN") {
        const isMember = project.members.some((m) => m.userId === user.id);
        if (!isMember) return forbidden("This project is private");
      }
      return ok(project);
    }

    case "list_meetings": {
      const limit = typeof args.limit === "number" ? args.limit : 20;
      const where: Prisma.MeetingWhereInput = {};
      if (args.projectId) where.projectId = args.projectId as string;
      const meetings = await db.meeting.findMany({
        where,
        include: {
          _count: { select: { attendances: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "desc" },
        take: limit,
      });
      return ok({ count: meetings.length, meetings });
    }

    case "get_attendance_report": {
      const startDate = args.startDate
        ? new Date(args.startDate as string)
        : undefined;
      const endDate = args.endDate
        ? new Date(args.endDate as string)
        : undefined;
      const [attendances, totalMeetings] = await Promise.all([
        db.attendance.findMany({
          where: {
            ...((startDate ?? endDate)
              ? {
                  meeting: {
                    startTime: {
                      ...(startDate && { gte: startDate }),
                      ...(endDate && { lte: endDate }),
                    },
                  },
                }
              : {}),
            ...(args.subTeam
              ? { user: { subTeam: args.subTeam as string } }
              : {}),
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, subTeam: true },
            },
          },
        }),
        db.meeting.count({
          where: {
            ...((startDate ?? endDate)
              ? {
                  startTime: {
                    ...(startDate && { gte: startDate }),
                    ...(endDate && { lte: endDate }),
                  },
                }
              : {}),
          },
        }),
      ]);
      const byMember = new Map<
        string,
        {
          user: (typeof attendances)[0]["user"];
          attended: number;
          late: number;
        }
      >();
      for (const a of attendances) {
        const entry = byMember.get(a.userId);
        if (entry) {
          entry.attended++;
          if (a.isLate) entry.late++;
        } else
          byMember.set(a.userId, {
            user: a.user,
            attended: 1,
            late: a.isLate ? 1 : 0,
          });
      }
      const report = Array.from(byMember.values())
        .map((e) => ({
          ...e.user,
          attended: e.attended,
          late: e.late,
          rate:
            totalMeetings > 0
              ? Math.round((e.attended / totalMeetings) * 100)
              : 0,
        }))
        .sort((a, b) => b.rate - a.rate);
      return ok({ totalMeetings, report });
    }

    case "get_workplan_leaderboard": {
      const semester = await db.semester.findFirst({
        where: { isActive: true },
      });
      if (!semester)
        return ok({ message: "No active semester", leaderboard: [] });
      const completions = await db.workPlanCompletion.findMany({
        where: { status: "APPROVED", activity: { semesterId: semester.id } },
        include: {
          user: {
            select: { id: true, name: true, email: true, subTeam: true },
          },
          activity: { select: { points: true } },
        },
      });
      const pointsMap = new Map<
        string,
        { user: (typeof completions)[0]["user"]; points: number }
      >();
      for (const c of completions) {
        const entry = pointsMap.get(c.userId);
        if (entry) entry.points += c.activity.points;
        else
          pointsMap.set(c.userId, { user: c.user, points: c.activity.points });
      }
      const leaderboard = Array.from(pointsMap.values())
        .sort((a, b) => b.points - a.points)
        .map((e, i) => ({ rank: i + 1, ...e.user, points: e.points }));
      return ok({ semester: semester.name, leaderboard });
    }

    case "get_active_semester": {
      const semester = await db.semester.findFirst({
        where: { isActive: true },
        include: {
          activities: {
            include: {
              _count: { select: { completions: true, interests: true } },
            },
            orderBy: { isMandatory: "desc" },
          },
        },
      });
      if (!semester) return ok({ message: "No active semester" });
      return ok(semester);
    }

    case "create_task": {
      if (user.role === "VIEWER")
        return forbidden("VIEWERs cannot create tasks");
      if (user.role !== "ADMIN") {
        const membership = await db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: args.projectId as string,
              userId: user.id,
            },
          },
        });
        if (!membership)
          return forbidden("You are not a member of this project");
      }
      const task = await db.task.create({
        data: {
          projectId: args.projectId as string,
          title: args.title as string,
          description: (args.description as string) ?? undefined,
          priority:
            (args.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ?? "MEDIUM",
          status:
            (args.status as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE") ??
            "TODO",
          createdBy: user.id,
        },
      });
      return ok({ message: "Task created", task });
    }

    case "register_member": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can register members");
      const email = (args.email as string).toLowerCase();
      const existing = await db.user.findUnique({ where: { email } });
      if (existing)
        return toolError(`A user with email ${email} already exists`);
      const member = await db.user.create({
        data: {
          email,
          name: (args.name as string) ?? email.split("@")[0],
          lastname: (args.lastname as string) ?? undefined,
          role: (args.role as "VIEWER" | "MEMBER" | "ADMIN") ?? "MEMBER",
          status: (args.status as "ACTIVE" | "INACTIVE" | "ALUMNI") ?? "ACTIVE",
          subTeam: (args.subTeam as string) ?? undefined,
          phone: (args.phone as string) ?? undefined,
          bio: (args.bio as string) ?? undefined,
          githubUsername: (args.githubUsername as string) ?? undefined,
          linkedinUrl: (args.linkedinUrl as string) ?? undefined,
          graduationDate: args.graduationDate
            ? new Date(args.graduationDate as string)
            : undefined,
          subtitle: (args.subtitle as string) ?? undefined,
          semesters: args.semesters !== undefined ? Number(args.semesters) : undefined,
          tags: (args.tags as string) ?? undefined,
          excludeFromExport: (args.excludeFromExport as boolean) ?? undefined,
          classYear: args.classYear !== undefined ? Number(args.classYear) : undefined,
          webId: args.webId !== undefined ? Number(args.webId) : undefined,
        },
        select: {
          id: true,
          email: true,
          name: true,
          lastname: true,
          role: true,
          status: true,
          subTeam: true,
        },
      });
      if (args.imageBase64 && args.imageContentType) {
        const imageUrl = await uploadAvatar(
          member.id,
          args.imageBase64 as string,
          args.imageContentType as string,
        );
        await db.user.update({
          where: { id: member.id },
          data: { image: imageUrl },
        });
        return ok({
          message: "Member registered",
          member: { ...member, image: imageUrl },
        });
      }
      return ok({ message: "Member registered", member });
    }

    case "update_member": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can update members");
      const email = (args.email as string).toLowerCase();
      const existing = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!existing) return toolError(`No user found with email ${email}`);

      const member = await db.user.update({
        where: { email },
        data: {
          ...(args.name !== undefined && { name: args.name as string }),
          ...(args.lastname !== undefined && {
            lastname: args.lastname as string,
          }),
          ...(args.role !== undefined && {
            role: args.role as "VIEWER" | "MEMBER" | "ADMIN",
          }),
          ...(args.status !== undefined && {
            status: args.status as "ACTIVE" | "INACTIVE" | "ALUMNI",
          }),
          ...(args.subTeam !== undefined && {
            subTeam: args.subTeam as string,
          }),
          ...(args.phone !== undefined && { phone: args.phone as string }),
          ...(args.bio !== undefined && { bio: args.bio as string }),
          ...(args.githubUsername !== undefined && {
            githubUsername: args.githubUsername as string,
          }),
          ...(args.linkedinUrl !== undefined && {
            linkedinUrl: args.linkedinUrl as string,
          }),
          ...(args.graduationDate !== undefined && {
            graduationDate: new Date(args.graduationDate as string),
          }),
          ...(args.subtitle !== undefined && {
            subtitle: args.subtitle as string,
          }),
          ...(args.semesters !== undefined && {
            semesters: Number(args.semesters),
          }),
          ...(args.tags !== undefined && { tags: args.tags as string }),
          ...(args.excludeFromExport !== undefined && {
            excludeFromExport: args.excludeFromExport as boolean,
          }),
          ...(args.classYear !== undefined && { classYear: Number(args.classYear) }),
          ...(args.webId !== undefined && { webId: Number(args.webId) }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          lastname: true,
          role: true,
          status: true,
          subTeam: true,
        },
      });
      if (args.imageBase64 && args.imageContentType) {
        const imageUrl = await uploadAvatar(
          member.id,
          args.imageBase64 as string,
          args.imageContentType as string,
        );
        await db.user.update({
          where: { id: member.id },
          data: { image: imageUrl },
        });
        return ok({
          message: "Member updated",
          member: { ...member, image: imageUrl },
        });
      }
      return ok({ message: "Member updated", member });
    }

    case "create_meeting": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can create meetings");
      const meeting = await db.meeting.create({
        data: {
          title: args.title as string,
          description: (args.description as string) ?? undefined,
          startTime: new Date(args.startTime as string),
          duration: typeof args.duration === "number" ? args.duration : 60,
          projectId: (args.projectId as string) ?? undefined,
          createdBy: user.id,
        },
        include: { project: { select: { name: true } } },
      });
      return ok({ message: "Meeting created", meeting });
    }

    // ── Work plan admin tools ──────────────────────────────────────────────

    case "list_semesters": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can list semesters");
      const semesters = await db.semester.findMany({
        include: { _count: { select: { activities: true } } },
        orderBy: { startDate: "desc" },
      });
      return ok({ count: semesters.length, semesters });
    }

    case "create_semester": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can create semesters");
      const setActive = args.setActive === true;
      const semester = await db.$transaction(async (tx) => {
        if (setActive)
          await tx.semester.updateMany({ data: { isActive: false } });
        return tx.semester.create({
          data: {
            name: args.name as string,
            startDate: new Date(args.startDate as string),
            endDate: new Date(args.endDate as string),
            isActive: setActive,
          },
        });
      });
      return ok({ message: "Semester created", semester });
    }

    case "set_active_semester": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can change the active semester");
      const semester = await db.$transaction(async (tx) => {
        await tx.semester.updateMany({ data: { isActive: false } });
        return tx.semester.update({
          where: { id: args.semesterId as string },
          data: { isActive: true },
        });
      });
      return ok({ message: "Active semester updated", semester });
    }

    case "list_activities": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can list activities");
      let semesterId = args.semesterId as string | undefined;
      if (!semesterId) {
        const active = await db.semester.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!active)
          return ok({ message: "No active semester", activities: [] });
        semesterId = active.id;
      }
      const activities = await db.workPlanActivity.findMany({
        where: { semesterId },
        include: { _count: { select: { completions: true, interests: true } } },
        orderBy: { isMandatory: "desc" },
      });
      return ok({ count: activities.length, activities });
    }

    case "create_activity": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can create activities");
      const activity = await db.workPlanActivity.create({
        data: {
          semesterId: args.semesterId as string,
          name: args.name as string,
          description: (args.description as string) ?? undefined,
          points: Number(args.points),
          isMandatory: (args.isMandatory as boolean) ?? false,
        },
      });
      return ok({ message: "Activity created", activity });
    }

    case "update_activity": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can update activities");
      const data: Record<string, unknown> = {};
      if (args.name !== undefined) data.name = args.name;
      if (args.description !== undefined) data.description = args.description;
      if (args.points !== undefined) data.points = Number(args.points);
      if (args.isMandatory !== undefined) data.isMandatory = args.isMandatory;
      const activity = await db.workPlanActivity.update({
        where: { id: args.activityId as string },
        data,
      });
      return ok({ message: "Activity updated", activity });
    }

    case "get_pending_completions": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can view pending completions");
      let semesterId = args.semesterId as string | undefined;
      if (!semesterId) {
        const active = await db.semester.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!active)
          return ok({ message: "No active semester", completions: [] });
        semesterId = active.id;
      }
      const completions = await db.workPlanCompletion.findMany({
        where: { status: "PENDING", activity: { semesterId } },
        include: {
          user: {
            select: { id: true, name: true, email: true, subTeam: true },
          },
          activity: { select: { id: true, name: true, points: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return ok({ count: completions.length, completions });
    }

    case "review_completion": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can review completions");
      const completion = await db.workPlanCompletion.update({
        where: { id: args.completionId as string },
        data: {
          status: args.decision as "APPROVED" | "REJECTED",
          adminNote: (args.adminMessage as string) ?? undefined,
        },
        include: {
          user: { select: { name: true, email: true } },
          activity: { select: { name: true, points: true } },
        },
      });
      return ok({
        message: `Completion ${args.decision as string}`,
        completion,
      });
    }

    case "get_member_workplan_summary": {
      if (user.role !== "ADMIN")
        return forbidden("Only ADMINs can view member summaries");
      let semesterId = args.semesterId as string | undefined;
      let semesterName = "";
      if (!semesterId) {
        const active = await db.semester.findFirst({
          where: { isActive: true },
        });
        if (!active) return ok({ message: "No active semester" });
        semesterId = active.id;
        semesterName = active.name;
      } else {
        const sem = await db.semester.findUnique({ where: { id: semesterId } });
        semesterName = sem?.name ?? semesterId;
      }
      const [member, activities, completions, interests] = await Promise.all([
        db.user.findUnique({
          where: { id: args.userId as string },
          select: { id: true, name: true, email: true, subTeam: true },
        }),
        db.workPlanActivity.findMany({
          where: { semesterId },
          orderBy: { isMandatory: "desc" },
        }),
        db.workPlanCompletion.findMany({
          where: { userId: args.userId as string, activity: { semesterId } },
          include: {
            activity: { select: { id: true, name: true, points: true } },
          },
        }),
        db.workPlanInterest.findMany({
          where: { userId: args.userId as string, activity: { semesterId } },
          select: { activityId: true },
        }),
      ]);
      if (!member) return toolError("Member not found");
      const approvedPoints = completions
        .filter((c) => c.status === "APPROVED")
        .reduce((sum, c) => sum + c.activity.points, 0);
      const interestSet = new Set(interests.map((i) => i.activityId));
      const completionMap = new Map(completions.map((c) => [c.activityId, c]));
      const activitySummary = activities.map((a) => ({
        id: a.id,
        name: a.name,
        points: a.points,
        isMandatory: a.isMandatory,
        interested: interestSet.has(a.id),
        completion: completionMap.get(a.id) ?? null,
      }));
      return ok({
        semester: semesterName,
        member,
        approvedPoints,
        activities: activitySummary,
      });
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

function rpcResponse(id: string | number | null, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) {
    return rpcError(null, -32001, "Unauthorized: missing or expired API key");
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id = null, method, params = {} } = body;

  switch (method) {
    case "initialize":
      return rpcResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "roborrego", version: "1.0.0" },
      });

    case "tools/list":
      return rpcResponse(id, { tools: TOOLS });

    case "tools/call": {
      const { name, arguments: args = {} } = params as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      try {
        const result = await callTool(name, args, user);
        return rpcResponse(id, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return rpcResponse(id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        });
      }
    }

    case "ping":
      return rpcResponse(id, {});

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function GET() {
  return Response.json({
    name: "RoBorregos MCP Server",
    version: "1.0.0",
    protocol: "MCP/2024-11-05",
    transport: "HTTP",
    auth: "Bearer token (API key from /dashboard/profile/edit)",
    endpoints: { tools: "POST /api/mcp with method: tools/list or tools/call" },
  });
}
