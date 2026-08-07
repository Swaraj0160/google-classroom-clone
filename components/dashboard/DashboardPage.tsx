"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getDashboardData } from "@/lib/services/dashboard";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    classes: 0,
  });

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const dashboard = await getDashboardData(user.id);

      setStats({
        classes: dashboard.courses.length,
      });

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-lg">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">
        Faculty Dashboard 🎉
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Welcome to the Faculty Classroom Dashboard
      </p>

      <div className="grid grid-cols-4 gap-6 mt-10">
        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Classes</h2>
          <p className="text-3xl font-bold mt-2">
            {stats.classes}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Students</h2>
          <p className="text-3xl font-bold mt-2">332</p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Assignments</h2>
          <p className="text-3xl font-bold mt-2">48</p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-gray-500">Average Score</h2>
          <p className="text-3xl font-bold mt-2">82%</p>
        </div>
      </div>
    </div>
  );
}