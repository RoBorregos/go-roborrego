# CLAUDE.md — RoBorregos Team Management Platform

Developer reference for AI assistants and contributors. Covers architecture decisions, conventions, and known gotchas discovered during implementation.

---

## Instructions for Claude

- **After every implementation**, run `npm run typecheck` to confirm the build is clean. Do not report a task as done if it fails.
- **After any significant change** (new feature, new model, new router, new page, changed convention), update `CLAUDE.md` and the project memory file to reflect what changed.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| API | tRPC v11 with SuperJSON |
| ORM | Prisma 6 (PostgreSQL) |
| Auth | NextAuth v5 beta (`next-auth@5.0.0-beta`) |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Language | TypeScript (strict mode) |
| Storage | Supabase Storage (avatars, task-attachments) |
| MCP | `@modelcontextprotocol/sdk` — stdio + HTTP endpoints |

---

## Project Structure

```
src/
  app/
    api/
      mcp/              # HTTP MCP endpoint (Bearer token auth)
      upload/           # Signed upload URL handler (Supabase)
    dashboard/
      _components/      # Shared dashboard components (DashboardShell, UserMenu)
      admin/
        members/        # Roster management
        profile-approvals/  # Approve member profile edits
      attendance/       # Meetings, check-in, QR codes, feedback
      members/
        [id]/
      profile/
        edit/           # Profile edit (changes go through approval)
      projects/
        [id]/           # Project board, tasks, members, Miro tab
      web-projects/     # External web project links directory
      workplan/         # Work plan activities, leaderboard
        [memberId]/     # Individual member progress view
      support/          # GitHub issue reporter
  lib/
    supabase.ts         # Supabase client (anon key)
    supabase-admin.ts   # Supabase admin client (service role)
    useUpload.ts        # Hook: signed-URL upload flow
  mcp/
    server.ts           # Stdio MCP server (npm run mcp)
  server/
    api/
      routers/          # One file per feature domain
      trpc.ts           # Procedures + context
      root.ts           # Router composition
    auth/
      config.ts         # NextAuth config
      index.ts          # Exports: auth, signIn, signOut, handlers
  trpc/                 # Client-side tRPC setup
generated/
  prisma/               # Prisma client output (see below)
prisma/
  schema.prisma
```

---

## Key Conventions

### Server vs Client Components

- **Server components** handle auth checks, initial data fetching, and passing props to client components.
- **Client components** (`"use client"`) handle all interactivity and tRPC mutations.
- **Pass role/userId as props** from server → client. Do not call `useSession()` or `auth()` in client components.

```tsx
// page.tsx (server)
export default async function Page() {
  const session = await auth();
  return <ClientComponent isAdmin={session?.user.role === "ADMIN"} />;
}
```

### Server Actions for Auth

Use server actions (not `href` links) for sign-in and sign-out to bypass NextAuth's default confirmation pages:

```tsx
// Direct Google sign-in — skips provider selector page
<form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>

// Direct sign-out — skips confirmation page
// Pass as prop from server layout → client component
signOutAction={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
```

### tRPC Procedures

Four procedure types with escalating access:

| Procedure | Who can call |
|---|---|
| `publicProcedure` | Anyone |
| `protectedProcedure` | Any logged-in user |
| `memberProcedure` | MEMBER or ADMIN role |
| `adminProcedure` | ADMIN role only |

Defined in `src/server/api/trpc.ts`.

### Cache Invalidation

Always use `void` when invalidating without awaiting:

```ts
void utils.member.getDirectory.invalidate();
```

### Component Co-location

Feature-specific components live in `_components/` inside the route folder:

```
app/dashboard/workplan/_components/ActivitiesTab.tsx
```

Shared dashboard components live in `app/dashboard/_components/`.

### Searchable Combobox Pattern

When a `<select>` needs to be searchable, use an input + dropdown list instead. The pattern used throughout:

```tsx
const [search, setSearch] = useState("");
const [selectedId, setSelectedId] = useState("");
const [open, setOpen] = useState(false);

// Filter available items by search query
const filtered = items.filter(item =>
  item.name?.toLowerCase().includes(search.toLowerCase()) ||
  item.email?.toLowerCase().includes(search.toLowerCase())
);

// On blur, delay close so onMouseDown on list items fires first
onBlur={() => setTimeout(() => setOpen(false), 150)}

// On item select
function selectItem(id, name, email) {
  setSelectedId(id);
  setSearch(name ?? email ?? "");
  setOpen(false);
}
```

Each dropdown row shows name (bold) + email (gray, smaller). Used in: workplan reviewer picker, project member picker.

### Tab Persistence (Per-Feature)

- **Workplan:** tab + semester stored in `sessionStorage` under `workplan_tab` / `workplan_semester`
- **Projects:** tab stored per-project in `sessionStorage` under `project_tab_<projectId>`; first visit defaults to `"overview"`

---

## Auth

- Provider: **Google OAuth only** — any email domain is accepted (no `@tec.mx` restriction)
- **Allowlist-based**: users must be pre-registered by an admin before they can sign in
- Bootstrap exception: if the DB has zero users, the first sign-in is allowed (creates the first admin)
- Role is stored on the `User` model and included in the session
- Role in session is typed as `"VIEWER" | "MEMBER" | "ADMIN"` (string literal union, not the Prisma enum import — avoids type conflicts)
- `lastLoginAt` is updated via the `signIn` event in `config.ts`

---

## File Uploads (Supabase Storage)

Upload flow uses signed URLs to avoid exposing the service role key to the browser:

1. Client calls `POST /api/upload/sign` with `{ bucket, path, contentType }`
2. Server generates a signed upload URL using the service role key
3. Client `PUT`s the file directly to Supabase
4. Public URL is constructed and saved to the DB

Two buckets: `avatars` (public) and `task-attachments` (private, signed URLs).

The `useUpload` hook at `src/lib/useUpload.ts` handles this flow.

---

## MCP Servers

### Stdio server (`npm run mcp`)

Runs locally via `tsx src/mcp/server.ts`. No auth — whoever runs the process has full access. Useful for local admin tooling and Claude Desktop integration.

Claude Desktop config:
```json
{
  "mcpServers": {
    "roborrego": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/go-roborrego"
    }
  }
}
```

**Available tools:** `list_members`, `list_projects`, `get_project`, `list_meetings`, `get_attendance_report`, `get_workplan_leaderboard`, `get_active_semester`, `register_member`, `update_member`, `create_meeting`, `create_task`, `list_semesters`, `create_semester`, `set_active_semester`, `list_activities`, `create_activity`, `update_activity`, `get_pending_completions`, `review_completion`, `get_member_workplan_summary`

### HTTP MCP endpoint (`POST /api/mcp`)

Authenticated via `Authorization: Bearer <api_key>`. API keys:
- One key per user, generated from `/dashboard/profile/edit`
- Expire 3 hours after generation
- Stored as SHA-256 hash in the `ApiKey` table
- Carry the same permissions as the owning user (VIEWER = read-only, MEMBER = read + create_task, ADMIN = all tools)

`GET /api/mcp` returns discovery info without auth.

---

## Known Gotchas

### Prisma Client Location

The client is generated to `generated/prisma/` (root level, not inside `src/`). This path is **excluded from tsconfig**, but imports still work. Always use a **relative path**:

```ts
// src/server/db.ts — correct
import { PrismaClient } from "../../generated/prisma";

// src/server/auth/config.ts — correct
import type { Role } from "../../../generated/prisma";

// src/app/api/mcp/route.ts — correct
import type { Prisma } from "../../../../generated/prisma";
```

Do **not** use `~/generated/prisma` — the `~` alias maps to `src/`, so that path does not exist.

### Prisma Client Staleness

After any schema change, the generated client must be regenerated and the dev server restarted:

```bash
npx prisma generate   # or npx prisma db push (includes generate)
# then restart: npm run dev
```

Runtime errors like `Unknown field X for include statement` mean the running process has a stale client.

### NextAuth Adapter Type Conflict

`@auth/prisma-adapter` and `next-auth` bundle separate copies of `@auth/core`, causing `AdapterUser` type incompatibilities when you extend the `User` model. Workaround in `src/server/auth/config.ts`:

```ts
adapter: PrismaAdapter(db) as any,
```

Do **not** augment the `interface User` in the `next-auth` module declaration — only augment `interface Session`.

### Tailwind v4 Class Names

Tailwind v4 renamed several utilities. Use the new canonical names:

| Old (v3) | New (v4) |
|---|---|
| `bg-gradient-to-b` | `bg-linear-to-b` |

### Passing Server Actions to Client Components

To use a server action (e.g. `signOut`) inside a client component, define it inline in the server layout/page and pass it as a typed prop:

```tsx
// layout.tsx (server)
<ClientComp action={async () => { "use server"; await signOut(); }} />

// ClientComp.tsx
({ action }: { action: () => Promise<void> }) => <form action={action}>…</form>
```

### Miro Board Embedding

The `miroBoard` field on `Project` stores an embed URL (from Miro Share → Embed → Copy link). Rendered as a full-height `<iframe>` in the Miro tab. Managers/admins can set/change/remove it via `project.update`.

---

## Database Schema Summary

Key models and their purpose:

| Model | Purpose |
|---|---|
| `User` | Members — includes role, status, approved profile fields |
| `ProfileEdit` | Pending/approved/rejected profile change requests |
| `ApiKey` | Per-user API key for HTTP MCP access (hashed, 3h TTL) |
| `Semester` | Work plan semester (one active at a time) |
| `WorkPlanActivity` | Activity within a semester (points, mandatory flag) |
| `WorkPlanActivityReviewer` | Users designated to review submissions for a specific activity |
| `WorkPlanInterest` | Member ↔ activity interest (many-to-many) |
| `WorkPlanCompletion` | Submitted completion awaiting admin/reviewer approval |
| `Meeting` | Team meeting with QR check-in token, optional project link |
| `Attendance` | Member check-in record per meeting |
| `MeetingFeedback` | Anonymous or named feedback per meeting |
| `Project` | Team project (can be private); has `miroBoard` embed URL |
| `ProjectLink` | Named URL links attached to a project (visible in Overview tab) |
| `ProjectMember` | Member ↔ project role (PROJECT_MEMBER / PROJECT_MANAGER) |
| `Task` | Task within a project (Kanban board) |
| `TaskAssignee` | Member ↔ task assignment |
| `TaskComment` | Comment on a task |
| `WebProject` | External RoBorregos web project entry (name + description) |
| `WebProjectLink` | URL with optional description, belonging to a WebProject |
| `Account`, `Session`, `VerificationToken` | NextAuth internals — do not modify |

### Roles & Status Enums

```prisma
enum Role              { VIEWER  MEMBER  ADMIN }
enum MemberStatus      { ACTIVE  INACTIVE  ALUMNI }
enum CompletionStatus  { PENDING  APPROVED  REJECTED }
enum ProfileEditStatus { PENDING  APPROVED  REJECTED }
enum ProjectStatus     { ACTIVE  COMPLETED  ARCHIVED }
enum ProjectRole       { PROJECT_MEMBER  PROJECT_MANAGER }
enum TaskStatus        { TODO  IN_PROGRESS  IN_REVIEW  DONE }
enum TaskPriority      { LOW  MEDIUM  HIGH  URGENT }
enum AttendanceMethod  { QR_CODE  MANUAL  SELF }
```

### Project visibility rules

- `isPrivate = false` → visible to all authenticated users
- `isPrivate = true` → visible only to project members and ADMINs
- Enforced in `project.getAll` (server-side WHERE clause) and `project.getById` (post-fetch check)

### Admin-only project roles

ADMIN users always hold `PROJECT_MANAGER` role on any project they join — enforced in `addMember` and blocked in `updateMemberRole`. Users cannot change their own project role.

### Work plan reviewer flow

1. Admin assigns reviewer(s) to an activity via the "Reviewers" panel in Manage Activities.
2. Reviewer sees a "Review Submissions" tab in the Work Plan page (non-admins only see that tab, not the full admin set).
3. `getPendingCompletions` filters by reviewer's assigned activities for non-admins.
4. `reviewCompletion` verifies the caller is an admin OR a reviewer for that specific activity before allowing approve/reject.

### Profile edit approval flow

1. Member submits profile changes → `ProfileEdit` created with `PENDING` status. `User` fields unchanged.
2. Admin reviews at `/dashboard/admin/profile-approvals` — sees current vs proposed diff.
3. On approval → proposed non-null fields are copied to `User`. On rejection → only status updated.
4. Submitting again while a pending edit exists replaces the old pending edit.
5. `image` (avatar) bypasses approval — applied directly to `User`.

---

## tRPC Router Map

| Router | Key procedures |
|---|---|
| `member` | `getDirectory`, `getById`, `update`, `updateRole`, `updateStatus` |
| `project` | `getAll`, `getById`, `create`, `update`, `updateLinks`, `addMember`, `removeMember`, `updateMemberRole` |
| `workPlan` | `getActivities`, `getLeaderboard`, `submitCompletion`, `getPendingCompletions`, `reviewCompletion`, `getActivityReviewers`, `addActivityReviewer`, `removeActivityReviewer` |
| `attendance` | `getMeetings`, `createMeeting`, `checkIn`, `getAttendanceReport` |
| `webProject` | `getAll`, `create`, `update`, `delete` |
| `admin` | Admin-only bulk operations |
| `apiKey` | `generate`, `revoke` |
| `saying` | Sayings feature |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the database (Docker)
./start-database.sh

# Push schema and generate client
npm run db:push

# Start dev server (exposed on Tailscale / all interfaces)
npm run dev    # or: ./dev.sh
```

### Useful scripts

```bash
npm run typecheck      # tsc --noEmit (fastest type check)
npm run check          # lint + typecheck
npm run db:push        # push schema changes + regenerate client
npm run db:studio      # open Prisma Studio (DB browser)
npm run mcp            # start stdio MCP server
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```
AUTH_SECRET=                    # run: npx auth secret
AUTH_GOOGLE_ID=                 # Google Cloud Console OAuth client
AUTH_GOOGLE_SECRET=
DATABASE_URL=                   # PostgreSQL connection string

NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server-only)
```

### Supabase Storage Setup

Create two buckets in Supabase Storage:
- `avatars` — **public** read
- `task-attachments` — **private** (signed URLs only)

Add a public-read policy on `avatars`:
```sql
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
```

### MCP stdio server

```bash
npm run mcp   # runs tsx src/mcp/server.ts
```
