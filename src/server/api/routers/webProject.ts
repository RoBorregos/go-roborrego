import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const linkSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  order: z.number().int().default(0),
});

export const webProjectRouter = createTRPCRouter({
  getAll: protectedProcedure.query(({ ctx }) => {
    return ctx.db.webProject.findMany({
      include: { links: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        links: z.array(linkSchema).default([]),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { links, ...data } = input;
      return ctx.db.webProject.create({
        data: { ...data, links: { create: links } },
        include: { links: { orderBy: { order: "asc" } } },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        description: z.string().min(1),
        links: z.array(linkSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, links, ...data } = input;
      await ctx.db.webProjectLink.deleteMany({ where: { projectId: id } });
      return ctx.db.webProject.update({
        where: { id },
        data: { ...data, links: { create: links } },
        include: { links: { orderBy: { order: "asc" } } },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.webProject.delete({ where: { id: input.id } });
    }),
});
