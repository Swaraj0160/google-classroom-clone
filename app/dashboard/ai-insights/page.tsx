import AIInsightsTab from "@/components/dashboard/AIInsightsTab";

export default function AIInsightsPage() {
  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink dark:text-white">AI Insights</h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-gray-400">
          Data-driven insights across all the classes you teach
        </p>
      </div>
      <AIInsightsTab />
    </div>
  );
}
