# Add a new tRPC router

Create a new tRPC router for the feature: $ARGUMENTS

## Steps

1. Create `src/server/api/routers/<name>.ts` following this template:

```ts
import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
  protectedProcedure,
} from "~/server/api/trpc";

export const <name>Router = createTRPCRouter({
  // procedures here
});
```

2. Register it in `src/server/api/root.ts` — import and add to `appRouter`.

3. Run `npx tsc --noEmit` to verify types are clean.

## Access levels to use
- `publicProcedure` — unauthenticated access
- `protectedProcedure` — any logged-in user
- `memberProcedure` — MEMBER or ADMIN role
- `adminProcedure` — ADMIN role only

## Manual RBAC pattern (for project-scoped checks)
```ts
if (ctx.session.user.role !== "ADMIN") {
  const m = await ctx.db.projectMember.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: ctx.session.user.id } },
    select: { role: true },
  });
  if (m?.role !== "PROJECT_MANAGER") throw new TRPCError({ code: "FORBIDDEN" });
}
```
