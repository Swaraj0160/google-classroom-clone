"use client";

import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  PenTool,
  Calculator,
  Atom,
  Sparkles,
  Brain,
  Globe2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
}

const floatingIcons = [
  { Icon: GraduationCap, top: "12%", left: "16%", delay: 0, size: 34 },
  { Icon: BookOpen, top: "68%", left: "12%", delay: 0.6, size: 28 },
  { Icon: PenTool, top: "22%", left: "78%", delay: 1.1, size: 26 },
  { Icon: Calculator, top: "78%", left: "72%", delay: 0.3, size: 30 },
  { Icon: Atom, top: "46%", left: "88%", delay: 0.9, size: 32 },
  { Icon: Brain, top: "50%", left: "6%", delay: 1.4, size: 28 },
  { Icon: Globe2, top: "8%", left: "50%", delay: 1.7, size: 24 },
  { Icon: Sparkles, top: "85%", left: "40%", delay: 0.5, size: 22 },
];

export default function AuroraPanel() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 10 + 8,
        delay: Math.random() * 6,
      }))
    );
  }, []);

  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-[#0b0e1a] lg:block">
      {/* 3D gradient blobs */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 opacity-60 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-0 h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-indigo-600 opacity-50 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 25, 0], y: [0, 25, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/3 top-1/2 h-[360px] w-[360px] -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 opacity-30 blur-3xl"
        />
      </div>

      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              opacity: 0.5,
            }}
            animate={{
              y: [0, -60, 0],
              opacity: [0.15, 0.7, 0.15],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Floating education icons */}
      {floatingIcons.map(({ Icon, top, left, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70 backdrop-blur-md"
          style={{ top, left }}
          animate={{ y: [0, -16, 0], rotate: [0, 4, 0] }}
          transition={{
            duration: 6 + i * 0.5,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon size={size} />
        </motion.div>
      ))}

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-glow">
            <GraduationCap size={22} />
          </div>
          <span className="text-lg font-semibold text-white">Faculty Classroom</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-md"
        >
          <h2 className="text-4xl font-bold leading-tight text-white xl:text-[42px]">
            Teaching, elevated
            <br /> by artificial intelligence.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Grade faster, spot at-risk students earlier, and get a clear pulse
            on every class — all from one beautifully simple dashboard.
          </p>

          <div className="mt-8 flex items-center gap-6">
            <div>
              <p className="text-2xl font-bold text-white">12K+</p>
              <p className="text-xs text-white/50">Faculty using it</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-2xl font-bold text-white">98%</p>
              <p className="text-xs text-white/50">Grading time saved</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-2xl font-bold text-white">4.9★</p>
              <p className="text-xs text-white/50">Faculty rating</p>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xs text-white/35"
        >
          © 2026 Faculty Classroom. Crafted for educators.
        </motion.p>
      </div>
    </div>
  );
}
