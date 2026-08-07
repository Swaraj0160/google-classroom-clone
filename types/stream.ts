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