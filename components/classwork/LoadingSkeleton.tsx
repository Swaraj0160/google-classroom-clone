import { Skeleton } from "@/components/ui/Skeleton";

export function ClassworkLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}