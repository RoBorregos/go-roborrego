import { adminRouter } from "~/server/api/routers/admin";
import { apiKeyRouter } from "~/server/api/routers/apiKey";
import { attendanceRouter } from "~/server/api/routers/attendance";
import { memberRouter } from "~/server/api/routers/member";
import { projectRouter } from "~/server/api/routers/project";
import { sayingRouter } from "~/server/api/routers/saying";
import { webProjectRouter } from "~/server/api/routers/webProject";
import { workPlanRouter } from "~/server/api/routers/workPlan";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  apiKey: apiKeyRouter,
  member: memberRouter,
  workPlan: workPlanRouter,
  attendance: attendanceRouter,
  project: projectRouter,
  saying: sayingRouter,
  webProject: webProjectRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.member.getDirectory({});
 */
export const createCaller = createCallerFactory(appRouter);
