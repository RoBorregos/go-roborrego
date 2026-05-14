"use client";

import { useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { OverviewTab } from "./OverviewTab";
import { BoardTab } from "./BoardTab";
import { MembersTab } from "./MembersTab";
import { MiroTab } from "./MiroTab";
import { TaskPanel } from "./TaskPanel";

type Tab = "overview" | "board" | "miro" | "members";

export function ProjectClient({
  projectId,
  userId,
  userRole,
}: {
  projectId: string;
  userId: string;
  userRole: "MEMBER" | "ADMIN";
}) {
  const storageKey = `project_tab_${projectId}`;
  const [tab, setTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem(storageKey);
    return saved === "overview" ||
      saved === "board" ||
      saved === "members" ||
      saved === "miro"
      ? saved
      : "overview";
  });

  function handleTabChange(t: Tab) {
    setTab(t);
    sessionStorage.setItem(storageKey, t);
  }
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: project, isPending } = api.project.getById.useQuery({
    id: projectId,
  });

  if (isPending) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }
  if (!project) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Project not found.</p>
        <Link
          href="/dashboard/projects"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  const isManager =
    userRole === "ADMIN" || project.myRole === "PROJECT_MANAGER";
  const isMember = !!project.myRole || userRole === "ADMIN";

  return (
    <div className="flex h-full gap-6">
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/projects"
            className="mb-2 inline-block text-xs text-gray-400 hover:text-gray-600"
          >
            ← Projects
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project.name}
              </h1>
              {project.subTeam && (
                <span className="text-sm text-gray-500">{project.subTeam}</span>
              )}
            </div>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${
                project.status === "ACTIVE"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : project.status === "COMPLETED"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-gray-100 text-gray-500"
              }`}
            >
              {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-gray-200">
          {(["overview", "board", "miro", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab project={project} isManager={isManager} />
        )}
        {tab === "board" && (
          <BoardTab
            projectId={projectId}
            isMember={isMember}
            userId={userId}
            onSelectTask={setSelectedTaskId}
            selectedTaskId={selectedTaskId}
          />
        )}
        {tab === "miro" && <MiroTab project={project} isManager={isManager} />}
        {tab === "members" && (
          <MembersTab
            project={project}
            isManager={isManager}
            currentUserId={userId}
          />
        )}
      </div>

      {/* Task side panel */}
      {selectedTaskId && (
        <TaskPanel
          taskId={selectedTaskId}
          userId={userId}
          isMember={isMember}
          isManager={isManager}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
