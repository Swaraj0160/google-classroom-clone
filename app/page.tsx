"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoginPage from "@/components/login/LoginPage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      let { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            null,
          role: "student",
        });

        // 23505 = unique_violation: another concurrent login already created it, safe to ignore.
        if (insertError && insertError.code !== "23505") {
          console.error("Failed to create profile:", insertError);
        }

        const { data: created } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        profile = created;
      }

      if (profile?.role === "faculty") {
        router.replace("/dashboard");
      } else {
        router.replace("/student/dashboard");
      }
    }

    checkUser();
  }, [router]);

  return <LoginPage />;
}
