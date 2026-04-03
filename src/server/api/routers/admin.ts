import { createAppAuth } from "@octokit/auth-app";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { env } from "~/env";

export const adminRouter = createTRPCRouter({
  getOverview: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const ago30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      memberCounts,
      newMembers,
      neverLoggedIn,
      pendingCompletions,
      activeProjects,
      upcomingMeetings,
      recentPendingCompletions,
    ] = await Promise.all([
      // Members by status
      ctx.db.user.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),

      // New members in the last 30 days
      ctx.db.user.count({
        where: { joinDate: { gte: ago30Days } },
      }),

      // Active members who have never logged in
      ctx.db.user.count({
        where: { status: "ACTIVE", lastLoginAt: null },
      }),

      // Pending work plan completions count
      ctx.db.workPlanCompletion.count({
        where: { status: "PENDING" },
      }),

      // Active projects count
      ctx.db.project.count({
        where: { status: "ACTIVE" },
      }),

      // Upcoming meetings (next 7 days)
      ctx.db.meeting.findMany({
        where: { startTime: { gte: now, lte: in7Days } },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          duration: true,
          _count: { select: { attendances: true } },
        },
      }),

      // Most recent pending completions (for quick-review)
      ctx.db.workPlanCompletion.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          user: { select: { id: true, name: true, image: true } },
          activity: { select: { id: true, name: true, points: true } },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(
      memberCounts.map((r) => [r.status, r._count._all]),
    ) as Record<string, number>;

    return {
      members: {
        active: byStatus.ACTIVE ?? 0,
        inactive: byStatus.INACTIVE ?? 0,
        alumni: byStatus.ALUMNI ?? 0,
        newThisMonth: newMembers,
        neverLoggedIn,
      },
      pendingCompletions,
      activeProjects,
      upcomingMeetings,
      recentPendingCompletions,
    };
  }),

  // ─── Profile edit approvals ─────────────────────────────────────────────────

  getPendingProfileEdits: adminProcedure.query(({ ctx }) => {
    return ctx.db.profileEdit.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            bio: true,
            githubUsername: true,
            linkedinUrl: true,
            subTeam: true,
            graduationDate: true,
            birthday: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    });
  }),

  // ─── Web export ─────────────────────────────────────────────────────────────

  exportToWebRepo: adminProcedure
    .input(z.object({ dryRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const REPO = env._GITHUB_WEB_REPO;
      const BASE_BRANCH = "develop";
      const GH = "https://api.github.com";

      const auth = createAppAuth({
        appId: env._GITHUB_APP_ID,
        privateKey: env._GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
        installationId: Number(env._GITHUB_APP_INSTALLATION_ID),
      });
      const { token } = await auth({ type: "installation" });

      const ghHeaders = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      };

      // 1. Fetch all non-excluded members
      const members = await ctx.db.user.findMany({
        where: { excludeFromExport: false },
        orderBy: { webId: { sort: "asc", nulls: "last" } },
        select: {
          id: true,
          name: true,
          lastname: true,
          email: true,
          image: true,
          bio: true,
          githubUsername: true,
          linkedinUrl: true,
          subTeam: true,
          subtitle: true,
          status: true,
          semesters: true,
          tags: true,
          webId: true,
          classYear: true,
        },
      });

      // 2. Auto-assign webIds to members that don't have one yet
      const maxWebId = members.reduce((m, u) => Math.max(m, u.webId ?? 0), 0);
      let nextId = maxWebId + 1;
      const idAssignments: { id: string; webId: number }[] = [];
      for (const m of members) {
        if (m.webId === null) {
          m.webId = nextId++;
          idAssignments.push({ id: m.id, webId: m.webId });
        }
      }
      if (idAssignments.length > 0 && !input.dryRun) {
        await Promise.all(
          idAssignments.map((a) =>
            ctx.db.user.update({
              where: { id: a.id },
              data: { webId: a.webId },
            }),
          ),
        );
      }

      // 3. Build members.json payload
      const membersJson = members.map((m) => {
        const nameParts = m.name?.trim().split(/\s+/) ?? [""];
        const firstName = nameParts[0] ?? "";
        const autoLastname = nameParts.slice(1).join(" ");
        return {
          id: String(m.webId),
          name: firstName,
          lastname: m.lastname ?? autoLastname,
          status: m.status === "ACTIVE" ? "active" : "inactive",
          role: m.subTeam ?? "",
          subtitle: m.subtitle ?? "",
          class: m.classYear ? String(m.classYear) : "",
          semesters: m.semesters !== null ? String(m.semesters) : "",
          description: m.bio ?? "",
          github: m.githubUsername
            ? `https://github.com/${m.githubUsername}`
            : "",
          github_user: m.githubUsername ?? "",
          linkedin: m.linkedinUrl ?? "",
          tags: m.tags ?? "",
        };
      });

      if (input.dryRun) {
        return {
          dryRun: true,
          memberCount: members.length,
          newIdAssignments: idAssignments.length,
          preview: { members: membersJson },
        };
      }

      // 4. Get base branch commit SHA + tree SHA
      const branchRes = await fetch(
        `${GH}/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`,
        { headers: ghHeaders },
      );
      if (!branchRes.ok)
        throw new Error(
          `GitHub: could not get branch — ${await branchRes.text()}`,
        );
      const branchData = (await branchRes.json()) as {
        object: { sha: string };
      };
      const baseSha = branchData.object.sha;

      const commitRes = await fetch(
        `${GH}/repos/${REPO}/git/commits/${baseSha}`,
        { headers: ghHeaders },
      );
      const commitData = (await commitRes.json()) as { tree: { sha: string } };
      const baseTreeSha = commitData.tree.sha;

      // 5. Create new branch
      const branchName = `sync/members-${Date.now()}`;
      const createBranchRes = await fetch(`${GH}/repos/${REPO}/git/refs`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
      if (!createBranchRes.ok)
        throw new Error(
          `GitHub: could not create branch — ${await createBranchRes.text()}`,
        );

      // 6. Create blobs for member images and build tree
      const treeItems: Array<{
        path: string;
        mode: string;
        type: string;
        sha?: string;
        content?: string;
      }> = [];

      for (const m of members) {
        if (!m.image) continue;
        try {
          const imgRes = await fetch(m.image);
          if (!imgRes.ok) continue;
          const buf = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          const blobRes = await fetch(`${GH}/repos/${REPO}/git/blobs`, {
            method: "POST",
            headers: ghHeaders,
            body: JSON.stringify({ content: base64, encoding: "base64" }),
          });
          if (!blobRes.ok) continue;
          const blobData = (await blobRes.json()) as { sha: string };
          treeItems.push({
            path: `src/images/members/${m.webId}.jpg`,
            mode: "100644",
            type: "blob",
            sha: blobData.sha,
          });
        } catch {
          // skip image on error
        }
      }

      // Add members.json
      treeItems.push({
        path: "src/data/members.json",
        mode: "100644",
        type: "blob",
        content: JSON.stringify({ members: membersJson }, null, 4),
      });

      // 7. Create new tree
      const treeRes = await fetch(`${GH}/repos/${REPO}/git/trees`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
      });
      if (!treeRes.ok)
        throw new Error(
          `GitHub: could not create tree — ${await treeRes.text()}`,
        );
      const treeData = (await treeRes.json()) as { sha: string };

      // 8. Create commit
      const newCommitRes = await fetch(`${GH}/repos/${REPO}/git/commits`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `sync: update members data from platform (${members.length} members)`,
          tree: treeData.sha,
          parents: [baseSha],
        }),
      });
      if (!newCommitRes.ok)
        throw new Error(
          `GitHub: could not create commit — ${await newCommitRes.text()}`,
        );
      const newCommitData = (await newCommitRes.json()) as { sha: string };

      // 9. Update branch ref
      await fetch(`${GH}/repos/${REPO}/git/refs/heads/${branchName}`, {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ sha: newCommitData.sha }),
      });

      // 10. Create PR
      const prRes = await fetch(`${GH}/repos/${REPO}/pulls`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          title: `sync: update members data (${new Date().toLocaleDateString("en-CA")})`,
          body: `Automated sync from the RoBorregos management platform.\n\n- **${members.length}** members exported\n- **${treeItems.filter((t) => t.path.startsWith("src/images")).length}** images updated\n- **${idAssignments.length}** new web IDs assigned`,
          head: branchName,
          base: BASE_BRANCH,
        }),
      });
      if (!prRes.ok)
        throw new Error(`GitHub: could not create PR — ${await prRes.text()}`);
      const prData = (await prRes.json()) as {
        html_url: string;
        number: number;
      };

      return {
        dryRun: false,
        prUrl: prData.html_url,
        prNumber: prData.number,
        branchName,
        memberCount: members.length,
        imagesUploaded: treeItems.filter((t) => t.path.startsWith("src/images"))
          .length,
        newIdAssignments: idAssignments.length,
      };
    }),

  reviewProfileEdit: adminProcedure
    .input(
      z.object({
        editId: z.string(),
        decision: z.enum(["APPROVED", "REJECTED"]),
        reviewNote: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.profileEdit.findUnique({
        where: { id: input.editId },
      });
      if (!edit) throw new Error("Profile edit not found");
      if (edit.status !== "PENDING")
        throw new Error("Edit is no longer pending");

      await ctx.db.$transaction(async (tx) => {
        if (input.decision === "APPROVED") {
          // Copy proposed fields onto the User, skipping nulls (no change)
          await tx.user.update({
            where: { id: edit.userId },
            data: {
              ...(edit.name !== null && { name: edit.name }),
              ...(edit.phone !== null && { phone: edit.phone }),
              ...(edit.bio !== null && { bio: edit.bio }),
              ...(edit.githubUsername !== null && {
                githubUsername: edit.githubUsername,
              }),
              ...(edit.linkedinUrl !== null && {
                linkedinUrl: edit.linkedinUrl,
              }),
              ...(edit.subTeam !== null && { subTeam: edit.subTeam }),
              ...(edit.graduationDate !== null && {
                graduationDate: edit.graduationDate,
              }),
              ...(edit.birthday !== null && { birthday: edit.birthday }),
            },
          });
        }

        await tx.profileEdit.update({
          where: { id: input.editId },
          data: {
            status: input.decision,
            reviewedAt: new Date(),
            reviewedBy: ctx.session.user.id,
            reviewNote: input.reviewNote ?? null,
          },
        });
      });
    }),
});
