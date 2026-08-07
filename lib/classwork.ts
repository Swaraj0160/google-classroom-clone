import { ClassworkItem, Topic, TopicWithItems } from "@/types/classwork";

export function combineDueDateTime(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const t = time && time.length > 0 ? time : "23:59";
  return new Date(`${date}T${t}:00`).toISOString();
}

export function splitDueDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

export function detectLinkKind(url: string): "youtube" | "drive" | "link" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/drive\.google\.com/i.test(url)) return "drive";
  return "link";
}

export function groupByTopic(
  topics: Topic[],
  items: ClassworkItem[]
): { grouped: TopicWithItems[]; untopiced: ClassworkItem[] } {
  const grouped = topics
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      ...t,
      items: items.filter((i) => i.topic_id === t.id),
    }));
  const untopiced = items.filter((i) => !i.topic_id);
  return { grouped, untopiced };
}

export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.gif,.mp4";