export interface ClassItem {
  id: string;
  name: string;
  department: string;
  semester: string;
  studentCount: number;
  banner: string; // tailwind gradient classes
  code: string;
  schedule: string;
  room: string;
}

export interface ActivityItem {
  id: string;
  type: "submission" | "grade" | "assignment" | "announcement" | "ai";
  title: string;
  description: string;
  time: string;
  actor: string;
  avatar: string;
}

export interface StudentItem {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
  avatar: string;
  attendance: number;
  average: number;
  risk: "low" | "medium" | "high";
}

export interface AssignmentItem {
  id: string;
  title: string;
  type: "assignment" | "quiz" | "material";
  dueDate: string;
  points: number;
  submitted: number;
  total: number;
  status: "draft" | "published" | "closed";
}

export interface AnnouncementItem {
  id: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
  comments: number;
}
export interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface AnnouncementAuthor {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export interface AnnouncementComment {
  id: string;
  announcement_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: AnnouncementAuthor;
}

export interface Announcement {
  id: string;
  course_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: AnnouncementAuthor;
  attachments?: AnnouncementAttachment[];
  comments?: AnnouncementComment[];
}

export interface NewAnnouncementInput {
  courseId: string;
  content: string;
  isPinned?: boolean;
  files?: File[];
}