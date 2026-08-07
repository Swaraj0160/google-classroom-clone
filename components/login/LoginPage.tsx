"use client";

import { useState } from "react";
import AuroraPanel from "./AuroraPanel";
import LoginCard from "./LoginCard";

export default function LoginPage() {
  const [dark, setDark] = useState(false);

  return (
    <main className="flex min-h-screen w-full overflow-hidden">
      {/* Left Side */}
      <div className="hidden lg:block lg:w-1/2">
        <AuroraPanel />
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2">
        <LoginCard
          dark={dark}
          setDark={setDark}
        />
      </div>
    </main>
  );
}