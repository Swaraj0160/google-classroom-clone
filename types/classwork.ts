export type ClassworkType = "assignment" | "quiz" | "material";
export type ClassworkStatus = "draft" | "published";
export type AttachmentKind = "file" | "youtube" | "drive" | "link";

export interface Topic {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TopicWithItems extends Topic {
  items: ClassworkItem[];
}

export interface AssignmentAttachment {
  id: string;
  assignment_id: string;
  kind: AttachmentKind;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  url: string | null;
  created_at: string;
}

export interface ClassworkItem {
  id: string;
  course_id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  total_marks: number | null;
  status: ClassworkStatus;
  type: ClassworkType;
  created_at: string;
  updated_at: string;
  attachments?: AssignmentAttachment[];
}

export interface ClassworkFormInput {
  courseId: string;
  topicId: string | null;
  title: string;
  description: string;
  instructions: string;
  dueDate: string | null; // "YYYY-MM-DD"
  dueTime: string | null; // "HH:mm"
  totalMarks: number | null;
  status: ClassworkStatus;
  type: ClassworkType;
  files: File[];
  links: { kind: "youtube" | "drive" | "link"; url: string }[];
}