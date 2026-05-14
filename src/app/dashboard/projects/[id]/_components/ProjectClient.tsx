"use client";

import { useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { OverviewTab } from "./OverviewTab";
import { BoardTab } from "./BoardTab";
import { MembersTab } from "./MembersTab";
import { TaskPanel } from "./TaskPanel";

type Tab = "overview" | "board" | "members";

export function ProjectClient({
  projectId,
  userId,
  userRole,
}: {
  projectId: string;
  userId: string;
  userRole: "MEMBER" | "ADMIN";
}) {
  const [tab, setTab] = useState<Tab>("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: project, isPending } = api.project.getById.useQuery({
    id: projectId,
  });

  if (isPending) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }
  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Project not found.</p>
        <Link href="/dashboard/projects" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const isManager =
    userRole === "ADMIN" || project.myRole === "PROJECT_MANAGER";
  const isMember = !!project.myRole || userRole === "ADMIN";

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/projects"
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 inline-block"
          >
            ← Projects
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.subTeam && (
                <span className="text-sm text-gray-500">{project.subTeam}</span>
              )}
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium ${
                project.status === "ACTIVE"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : project.status === "COMPLETED"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(["overview", "board", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
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
          <OverviewTab
            project={project}
            isManager={isManager}
          />
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
