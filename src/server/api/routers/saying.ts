import { z } from "zod";
import { adminProcedure, createTRPCRouter, memberProcedure, protectedProcedure } from "~/server/api/trpc";

export const sayingRouter = createTRPCRouter({
  // All approved + visible sayings (for dashboard display)
  listApproved: protectedProcedure.query(async ({ ctx }) => {
    const sayings = await ctx.db.saying.findMany({
      where: { status: "APPROVED", isVisible: true },
      select: { id: true, text: true, explanation: true, date: true, isSerious: true },
    });
    for (let i = sayings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sayings[i], sayings[j]] = [sayings[j]!, sayings[i]!];
    }
    return sayings;
  }),

  // Submit a new saying (members+)
  submit: memberProcedure
    .input(
      z.object({
        text: z.string().min(1).max(500),
        explanation: z.string().max(1000).optional(),
        date: z.date(),
        isSerious: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.saying.create({
        data: {
          text: input.text,
          explanation: input.explanation,
          date: input.date ?? new Date(),
          submittedBy: ctx.session.user.id,
        },
      }),
    ),

  // Admin: list all sayings
  listAll: adminProcedure.query(({ ctx }) =>
    ctx.db.saying.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        submitter: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
    }),
  ),

  // Admin: approve / reject
  review: adminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["APPROVED", "REJECTED"]) }))
    .mutation(({ ctx, input }) =>
      ctx.db.saying.update({
        where: { id: input.id },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewedBy: ctx.session.user.id,
        },
      }),
    ),

  // Admin: toggle visibility
  setVisible: adminProcedure
    .input(z.object({ id: z.string(), isVisible: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.saying.update({
        where: { id: input.id },
        data: { isVisible: input.isVisible },
      }),
    ),

  // Admin: edit fields
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        text: z.string().min(1).max(500).optional(),
        explanation: z.string().max(1000).nullable().optional(),
        date: z.date().optional(),
        isSerious: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.saying.update({ where: { id }, data });
    }),
});
