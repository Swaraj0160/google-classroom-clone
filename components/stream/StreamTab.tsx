"use client";

import { useMemo } from "react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useProfile } from "@/hooks/useProfile";
import AnnouncementComposer from "@/components/stream/AnnouncementComposer";
import AnnouncementCard from "@/components/stream/AnnouncementCard";
import { Skeleton } from "@/components/ui/Skeleton";

interface StreamTabProps {
  courseId: string;
  facultyId: string;
}

export default function StreamTab({
  courseId,
  facultyId,
}: StreamTabProps) {
  const { profile } = useProfile();

  const {
    announcements,
    loading,
    error,
    submitting,
    createAnnouncement,
    updateAnnouncement,
    togglePin,
    deleteAnnouncement,
    deleteAttachment,
    addComment,
    deleteComment,
  } = useAnnouncements(courseId);

  const isFaculty = useMemo(
    () =>
      !!profile &&
      profile.role === "faculty" &&
      profile.id === facultyId,
    [profile, facultyId]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/10">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isFaculty && (
        <AnnouncementComposer
          submitting={submitting}
          onSubmit={(input) =>
            createAnnouncement({
              courseId,
              ...input,
            })
          }
        />
      )}

      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          No announcements yet.
        </div>
      ) : (
        announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            isFaculty={isFaculty}
            currentUserId={profile?.id ?? null}
            onEdit={updateAnnouncement}
            onDelete={deleteAnnouncement}
            onDeleteAttachment={deleteAttachment}
            onTogglePin={togglePin}
            onAddComment={addComment}
            onDeleteComment={deleteComment}
          />
        ))
      )}
    </div>
  );
}