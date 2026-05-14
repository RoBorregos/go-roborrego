# Scaffold a new dashboard feature

Feature to build: $ARGUMENTS

## Checklist

### 1. Schema (if new data is needed)
- Add model(s) to `prisma/schema.prisma`
- Run `npm run db:push` (pushes + regenerates client)
- Restart dev server after schema changes

### 2. Router
- Create `src/server/api/routers/<feature>.ts`
- Register in `src/server/api/root.ts`

### 3. Page (server component)
- Create `src/app/dashboard/<feature>/page.tsx`
- Call `auth()` here, pass `isAdmin` / `userId` as props to the client component
- Never call `auth()` or `useSession()` in client components

### 4. Client component
- Create `src/app/dashboard/<feature>/_components/<Feature>Client.tsx`
- Mark `"use client"` at top
- Use `api.<router>.<procedure>.useQuery/useMutation`
- Always `void utils.<router>.<procedure>.invalidate()` after mutations

### 5. Navigation
- Add `<NavLink href="/dashboard/<feature>">Label</NavLink>` in `DashboardShell.tsx`
- Place it in the right visibility group (all users / MEMBER+ADMIN / ADMIN only)

### 6. Verify
- Run `npx tsc --noEmit` — must be clean before finishing
