// ============================================================================
// STUDENT SUBMISSION SYSTEM — Types
// ============================================================================

export type SubmissionStatus =
  | "pending"
  | "submitted"
  | "late"
  | "graded";

export interface SubmissionFile {
  id: string;
  submission_id: string;

  file_name: string;
  file_path: string;

  file_type: string | null;
  file_size: number | null;

  created_at: string;
}

export interface Submission {
  id: string;

  assignment_id: string;
  student_id: string;

  status: SubmissionStatus;

  submitted_at: string | null;

  attempt_count: number;

  grade: number | null;

  feedback: string | null;

  graded_at: string | null;
  graded_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface SubmissionWithFiles extends Submission {
  files: SubmissionFile[];
}

export interface SubmissionStudent {
  id: string;
  full_name: string | null;
  email: string;
}

export interface SubmissionWithStudent extends SubmissionWithFiles {
  student: SubmissionStudent;
}

export interface SubmissionCounts {
  total: number;
  pending: number;
  submitted: number;
  late: number;
  graded: number;
}

export interface AssignmentSummary {
  id: string;

  course_id: string;

  title: string;

  due_date: string | null;

  total_marks: number | null;
}

export interface CreateSubmissionInput {
  assignmentId: string;
  studentId: string;
}

export interface UpdateSubmissionInput {
  submissionId: string;
  status: SubmissionStatus;
}

export interface GradeSubmissionInput {
  submissionId: string;
  grade: number;
  feedback: string;
}

export interface UploadSubmissionFileInput {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  file: File;
}