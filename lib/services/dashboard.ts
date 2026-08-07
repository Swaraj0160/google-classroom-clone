import { supabase } from "../supabase";

export async function getDashboardData(userId: string) {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .eq("faculty_id", userId);

  if (error) throw error;

  return {
    courses,
  };
}