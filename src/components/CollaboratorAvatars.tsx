"use client";

import type { CollabMember } from "@/hooks/useCollaboration";

interface CollaboratorAvatarsProps {
  members: CollabMember[];
  maxVisible?: number;
}

export default function CollaboratorAvatars({ members, maxVisible = 3 }: CollaboratorAvatarsProps) {
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const overflow = members.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((member) => (
        <div key={member.userId} className="relative group">
          <div
            className="w-7 h-7 rounded-full border-2 border-zinc-800 flex items-center justify-center text-xs font-medium bg-zinc-700 text-white overflow-hidden"
            title={`${member.displayName} (${member.permission})`}
          >
            {member.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- external avatar URL with unknown dimensions */
              <img
                src={member.avatarUrl}
                alt={member.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              member.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <span
            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-zinc-800 ${
              member.status === "online" ? "bg-green-400" : "bg-yellow-400"
            }`}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
            {member.displayName}
            {member.status === "idle" && " (idle)"}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-zinc-800 bg-zinc-600 flex items-center justify-center text-xs text-white font-medium">
          +{overflow}
        </div>
      )}
    </div>
  );
}
