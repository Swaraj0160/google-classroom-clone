"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-surface-alt dark:bg-surface-dark">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <TopBar
        collapsed={collapsed}
        onMenuClick={() => {
          setMobileOpen(!mobileOpen);
          if (window.innerWidth >= 1024) setCollapsed(!collapsed);
        }}
        dark={dark}
        setDark={setDark}
      />
      <main
        className={`min-h-screen pt-16 transition-all duration-300 ease-in-out ${
          collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]"
        }`}
      >
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
