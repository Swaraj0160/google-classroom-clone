"use client";

import { useMemo, useState } from "react";
import { BookOpen, ClipboardList, FileQuestion, FolderPlus, Plus } from "lucide-react";
import { useTopics } from "@/hooks/useTopics";
import { useAssignments } from "@/hooks/useAssignments";
import { useMaterials } from "@/hooks/useMaterials";
import { useProfile } from "@/hooks/useProfile";
import { ClassworkFormInput, ClassworkItem, ClassworkType } from "@/types/classwork";
import { groupByTopic } from "@/lib/classwork";
import { TopicSection } from "./TopicSection";
import { CreateTopicModal } from "./CreateTopicModal";
import { CreateAssignmentModal } from "./CreateAssignmentModal";
import { CreateMaterialModal } from "./CreateMaterialModal";
import { AssignmentDetails } from "./AssignmentDetails";
import { EmptyState } from "./EmptyState";
import { ClassworkLoadingSkeleton } from "./LoadingSkeleton";
import { Dropdown } from "@/components/ui/Dropdown";
import { DeleteDialog } from "@/components/ui/DeleteDialog";

interface ClassworkTabProps {
  courseId: string;
  facultyId: string;
}

type ModalState =
  | { type: "none" }
  | { type: "create-topic" }
  | { type: "rename-topic"; topicId: string; title: string }
  | { type: "create-item"; itemType: Extract<ClassworkType, "assignment" | "quiz">; topicId: string | null }
  | { type: "edit-item"; item: ClassworkItem }
  | { type: "create-material"; topicId: string | null }
  | { type: "edit-material"; item: ClassworkItem }
  | { type: "view-item"; item: ClassworkItem };

type DeleteTarget =
  | { kind: "topic"; id: string; title: string }
  | { kind: "item"; id: string; title: string };

export function ClassworkTab({ courseId, facultyId }: ClassworkTabProps) {
  const { profile } = useProfile();
  const topicsApi = useTopics(courseId);
  const assignmentsApi = useAssignments(courseId);
  const materialsApi = useMaterials(courseId);

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const isFaculty =
  !!profile &&
  profile.role === "faculty" &&
  profile.id === facultyId;

  const allItems = useMemo(
    () => [...assignmentsApi.assignments, ...materialsApi.materials],
    [assignmentsApi.assignments, materialsApi.materials]
  );

  const { grouped, untopiced } = useMemo(
    () => groupByTopic(topicsApi.topics, allItems),
    [topicsApi.topics, allItems]
  );

  const loading = topicsApi.loading || assignmentsApi.loading || materialsApi.loading;

  const handleOpenItem = (item: ClassworkItem) => setModal({ type: "view-item", item });

  const handleEditItem = (item: ClassworkItem) => {
    if (item.type === "material") {
      setModal({ type: "edit-material", item });
    } else {
      setModal({ type: "edit-item", item });
    }
  };

  const handleDeleteItem = (item: ClassworkItem) =>
    setDeleteTarget({ kind: "item", id: item.id, title: item.title });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "topic") {
      await topicsApi.deleteTopic(deleteTarget.id);
    } else {
      const target = allItems.find((i) => i.id === deleteTarget.id);
      if (target?.type === "material") {
        await materialsApi.deleteMaterial(deleteTarget.id);
      } else {
        await assignmentsApi.deleteAssignment(deleteTarget.id);
      }
    }
    setDeleteTarget(null);
    setModal({ type: "none" });
  };

  const handleAssignmentSubmit = async (input: ClassworkFormInput) => {
    if (modal.type === "edit-item") {
      await assignmentsApi.updateAssignment(modal.item.id, input);
    } else {
      await assignmentsApi.createAssignment(input);
    }
    setModal({ type: "none" });
  };

  const handleMaterialSubmit = async (input: ClassworkFormInput) => {
    if (modal.type === "edit-material") {
      await materialsApi.updateMaterial(modal.item.id, input);
    } else {
      await materialsApi.createMaterial(input);
    }
    setModal({ type: "none" });
  };

  const deleteDialogTitle = deleteTarget?.kind === "topic" ? "Delete topic?" : "Delete this item?";
  const deleteDialogDescription = !deleteTarget
    ? ""
    : deleteTarget.kind === "topic"
    ? `"${deleteTarget.title}" will be removed. Classwork inside it will move to "No topic", not be deleted.`
    : `"${deleteTarget.title}" and its attachments will be permanently deleted.`;

  if (loading) return <ClassworkLoadingSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isFaculty && (
        <div className="flex justify-end">
          <Dropdown
            trigger={
              <span className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                <Plus size={14} /> Create
              </span>
            }
            align="right"
            options={[
              {
                label: "Assignment",
                icon: ClipboardList,
                onClick: () => setModal({ type: "create-item", itemType: "assignment", topicId: null }),
              },
              {
                label: "Quiz assignment",
                icon: FileQuestion,
                onClick: () => setModal({ type: "create-item", itemType: "quiz", topicId: null }),
              },
              {
                label: "Material",
                icon: BookOpen,
                onClick: () => setModal({ type: "create-material", topicId: null }),
              },
              {
                label: "Topic",
                icon: FolderPlus,
                onClick: () => setModal({ type: "create-topic" }),
              },
            ]}
          />
        </div>
      )}

      {grouped.length === 0 && untopiced.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No classwork yet"
          description={
            isFaculty
              ? "Create your first assignment, quiz, or material to get started."
              : "Your instructor hasn't posted any classwork yet."
          }
        />
      ) : (
        <div className="space-y-8">
          {grouped.map((topic, index) => (
            <TopicSection
              key={topic.id}
              topic={topic}
              items={topic.items}
              allTopics={topicsApi.topics}
              isFaculty={isFaculty}
              isFirst={index === 0}
              isLast={index === grouped.length - 1}
              onOpenItem={handleOpenItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={(item) => assignmentsApi.duplicateAssignment(item.id)}
              onToggleStatus={(item) =>
                assignmentsApi.setStatus(item.id, item.status === "published" ? "draft" : "published")
              }
              onMoveItemToTopic={(item, topicId) =>
                item.type === "material"
                  ? materialsApi.moveToTopic(item.id, topicId)
                  : assignmentsApi.moveToTopic(item.id, topicId)
              }
              onRenameTopic={() => setModal({ type: "rename-topic", topicId: topic.id, title: topic.title })}
              onDeleteTopic={() => setDeleteTarget({ kind: "topic", id: topic.id, title: topic.title })}
              onMoveTopicUp={() => topicsApi.moveTopic(topic.id, "up")}
              onMoveTopicDown={() => topicsApi.moveTopic(topic.id, "down")}
            />
          ))}

          {untopiced.length > 0 && (
            <TopicSection
              topic={null}
              items={untopiced}
              allTopics={topicsApi.topics}
              isFaculty={isFaculty}
              isFirst={grouped.length === 0}
              isLast
              onOpenItem={handleOpenItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={(item) => assignmentsApi.duplicateAssignment(item.id)}
              onToggleStatus={(item) =>
                assignmentsApi.setStatus(item.id, item.status === "published" ? "draft" : "published")
              }
              onMoveItemToTopic={(item, topicId) =>
                item.type === "material"
                  ? materialsApi.moveToTopic(item.id, topicId)
                  : assignmentsApi.moveToTopic(item.id, topicId)
              }
              onRenameTopic={() => undefined}
              onDeleteTopic={() => undefined}
              onMoveTopicUp={() => undefined}
              onMoveTopicDown={() => undefined}
            />
          )}
        </div>
      )}

      <CreateTopicModal
        open={modal.type === "create-topic"}
        submitting={topicsApi.loading}
        onClose={() => setModal({ type: "none" })}
        onSubmit={async (title) => {
          await topicsApi.createTopic(title);
          setModal({ type: "none" });
        }}
      />

      {modal.type === "rename-topic" && (
        <CreateTopicModal
          open
          initialTitle={modal.title}
          submitting={topicsApi.loading}
          onClose={() => setModal({ type: "none" })}
          onSubmit={async (title) => {
            await topicsApi.renameTopic(modal.topicId, title);
            setModal({ type: "none" });
          }}
        />
      )}

      {(modal.type === "create-item" || modal.type === "edit-item") && (
        <CreateAssignmentModal
          open
          courseId={courseId}
          type={modal.type === "create-item" ? modal.itemType : (modal.item.type as "assignment" | "quiz")}
          topics={topicsApi.topics}
          initial={modal.type === "edit-item" ? modal.item : null}
          defaultTopicId={modal.type === "create-item" ? modal.topicId : null}
          submitting={assignmentsApi.submitting}
          onClose={() => setModal({ type: "none" })}
          onSubmit={handleAssignmentSubmit}
        />
      )}

      {(modal.type === "create-material" || modal.type === "edit-material") && (
        <CreateMaterialModal
          open
          courseId={courseId}
          topics={topicsApi.topics}
          initial={modal.type === "edit-material" ? modal.item : null}
          defaultTopicId={modal.type === "create-material" ? modal.topicId : null}
          submitting={materialsApi.submitting}
          onClose={() => setModal({ type: "none" })}
          onSubmit={handleMaterialSubmit}
        />
      )}

      {modal.type === "view-item" && (
        <AssignmentDetails
          item={modal.item}
          isFaculty={isFaculty}
          onClose={() => setModal({ type: "none" })}
          onEdit={() => handleEditItem(modal.item)}
          onDelete={() => handleDeleteItem(modal.item)}
        />
      )}

      <DeleteDialog
        open={!!deleteTarget}
        title={deleteDialogTitle}
        description={deleteDialogDescription}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}