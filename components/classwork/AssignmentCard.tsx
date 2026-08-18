"use client";

import {
  Calendar,
  ClipboardList,
  ClipboardCheck,
  Copy,
  Edit3,
  EyeOff,
  FileQuestion,
  MoreVertical,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ClassworkItem, Topic } from "@/types/classwork";
import { Dropdown } from "@/components/ui/Dropdown";
import type { AssignmentCardSummary } from "@/hooks/useCourseSubmissionSummaries";

interface AssignmentCardProps {
  item: ClassworkItem;
  isFaculty: boolean;
  courseId: string;
  summary?: AssignmentCardSummary;
  topics: Topic[];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onMoveToTopic: (topicId: string | null) => void;
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) +
    " · " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}

export function AssignmentCard({
  item,
  isFaculty,
  courseId,
  summary,
  topics,
  onOpen,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onMoveToTopic,
}: AssignmentCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const Icon =
    item.type === "quiz"
      ? FileQuestion
      : ClipboardList;

  const due = formatDueDate(item.due_date);

  const otherTopics = topics.filter(
    (t) => t.id !== item.topic_id
  );

  const handleClick = () => {
    // Student pages -> navigate to assignment page
    if (
      pathname.startsWith("/student") &&
      typeof params.id === "string"
    ) {
      router.push(
        `/student/classes/${params.id}/assignment/${item.id}`
      );
      return;
    }

    // Faculty pages -> keep modal behaviour
    onOpen();
  };

  // Only assignments/quizzes have submissions to review — materials never
  // reach this component (they render as MaterialCard instead).
  const showSubmissionsAction = isFaculty && item.type !== "material";

  return (
    <div
      onClick={handleClick}
      className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-center gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            item.type === "quiz"
              ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30"
              : "bg-blue-50 text-blue-600 dark:bg-blue-900/30"
          }`}
        >
          <Icon size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {item.title}
            </p>

            {item.status === "draft" && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                Draft
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
            {due && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Due {due}
              </span>
            )}

            {item.total_marks !== null && (
              <span>{item.total_marks} points</span>
            )}
          </div>
        </div>

        {isFaculty && (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={<MoreVertical size={16} />}
              options={[
                {
                  label: "Edit",
                  icon: Edit3,
                  onClick: onEdit,
                },
                {
                  label:
                    item.status === "published"
                      ? "Unpublish"
                      : "Publish",
                  icon:
                    item.status === "published"
                      ? EyeOff
                      : Send,
                  onClick: onToggleStatus,
                },
                {
                  label: "Duplicate",
                  icon: Copy,
                  onClick: onDuplicate,
                },
                ...otherTopics.map((t) => ({
                  label: `Move to "${t.title}"`,
                  onClick: () => onMoveToTopic(t.id),
                })),
                ...(item.topic_id
                  ? [
                      {
                        label: "Remove from topic",
                        onClick: () =>
                          onMoveToTopic(null),
                      },
                    ]
                  : []),
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: onDelete,
                  destructive: true,
                },
              ]}
            />
          </div>
        )}
      </div>

      {showSubmissionsAction && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
          {summary ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {summary.submitted} / {summary.enrolled} submitted
              </span>
              <span>
                {summary.graded} / {summary.submitted} graded
              </span>
              {summary.pendingReview > 0 && (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {summary.pendingReview} pending review
                </span>
              )}
            </div>
          ) : (
            <span className="inline-block h-3.5 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          )}

          <Link
            href={`/dashboard/classes/${courseId}/assignment/${item.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            <ClipboardCheck size={13} />
            View submissions
          </Link>
        </div>
      )}
    </div>
  );
}