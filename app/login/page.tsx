"use client";

import { useEffect, useState } from "react";
import AuroraPanel from "@/components/login/AuroraPanel";
import LoginCard from "@/components/login/LoginCard";

export default function LoginPage() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-2">
      <AuroraPanel />
      <LoginCard dark={dark} setDark={setDark} />
    </div>
  );
}
