"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";

type Project = RouterOutputs["project"]["getById"];

export function MiroTab({
  project,
  isManager,
}: {
  project: Project;
  isManager: boolean;
}) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(project.miroBoard ?? "");

  const update = api.project.update.useMutation({
    onSuccess: () => {
      void utils.project.getById.invalidate({ id: project.id });
      setEditing(false);
    },
  });

  function save() {
    update.mutate({ id: project.id, name: project.name, miroBoard: url });
  }

  if (editing) {
    return (
      <div className="max-w-lg space-y-3">
        <p className="text-sm text-gray-600">
          Paste the Miro board embed URL (found under Share → Embed → Copy link).
        </p>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://miro.com/app/live-embed/…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {update.error && (
          <p className="text-xs text-red-600">{update.error.message}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={update.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setUrl(project.miroBoard ?? ""); }}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          {project.miroBoard && (
            <button
              onClick={() => { setUrl(""); update.mutate({ id: project.id, name: project.name, miroBoard: "" }); }}
              disabled={update.isPending}
              className="ml-auto px-4 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Remove board
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!project.miroBoard) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 gap-3">
        <p className="text-4xl">📋</p>
        <p className="text-sm font-medium">No Miro board configured</p>
        {isManager && (
          <button
            onClick={() => setEditing(true)}
            className="mt-1 text-sm px-4 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#243660] transition-colors"
          >
            Configure board
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {isManager && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Change board
          </button>
        </div>
      )}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: 500 }}>
        <iframe
          src={project.miroBoard}
          className="w-full h-full"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  );
}
