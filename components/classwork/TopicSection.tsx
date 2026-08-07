"use client";

import { useState } from "react";
import { ClassworkItem, Topic } from "@/types/classwork";
import { TopicCard } from "./TopicCard";
import { AssignmentCard } from "./AssignmentCard";
import { MaterialCard } from "./MaterialCard";

interface TopicSectionProps {
  topic: Topic | null; // null = "No topic" bucket
  items: ClassworkItem[];
  allTopics: Topic[];
  isFaculty: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpenItem: (item: ClassworkItem) => void;
  onEditItem: (item: ClassworkItem) => void;
  onDeleteItem: (item: ClassworkItem) => void;
  onDuplicateItem: (item: ClassworkItem) => void;
  onToggleStatus: (item: ClassworkItem) => void;
  onMoveItemToTopic: (item: ClassworkItem, topicId: string | null) => void;
  onRenameTopic: () => void;
  onDeleteTopic: () => void;
  onMoveTopicUp: () => void;
  onMoveTopicDown: () => void;
}

export function TopicSection({
  topic,
  items,
  allTopics,
  isFaculty,
  isFirst,
  isLast,
  onOpenItem,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onToggleStatus,
  onMoveItemToTopic,
  onRenameTopic,
  onDeleteTopic,
  onMoveTopicUp,
  onMoveTopicDown,
}: TopicSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0 && !topic) return null;

  return (
    <div className="space-y-3">
      <TopicCard
        title={topic?.title ?? "No topic"}
        isFaculty={isFaculty && !!topic}
        collapsed={collapsed}
        isFirst={isFirst}
        isLast={isLast}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onRename={onRenameTopic}
        onDelete={onDeleteTopic}
        onMoveUp={onMoveTopicUp}
        onMoveDown={onMoveTopicDown}
      />

      {!collapsed && (
        <div className="space-y-2.5 pl-1">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400">No classwork in this topic yet.</p>
          ) : (
            items.map((item) =>
              item.type === "material" ? (
                <MaterialCard
                  key={item.id}
                  item={item}
                  isFaculty={isFaculty}
                  onOpen={() => onOpenItem(item)}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item)}
                />
              ) : (
                <AssignmentCard
                  key={item.id}
                  item={item}
                  isFaculty={isFaculty}
                  topics={allTopics}
                  onOpen={() => onOpenItem(item)}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item)}
                  onDuplicate={() => onDuplicateItem(item)}
                  onToggleStatus={() => onToggleStatus(item)}
                  onMoveToTopic={(topicId) => onMoveItemToTopic(item, topicId)}
                />
              )
            )
          )}
        </div>
      )}
    </div>
  );
}