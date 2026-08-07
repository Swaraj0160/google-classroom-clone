"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Sparkles,
  Sun,
  Moon,
  ShieldCheck,
  Loader2,
} from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.86 12c0-.79.14-1.56.4-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export default function LoginCard({
  dark,
  setDark,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error(error);
        alert(error.message);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center px-6 py-10 transition-colors duration-500 sm:px-10 ${
        dark
          ? "bg-[#0b0e1a]"
          : "bg-gradient-to-b from-white to-surface-alt"
      }`}
    >
      <button
        onClick={() => setDark(!dark)}
        className={`absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full ${
          dark
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-surface-alt text-ink-soft hover:bg-black/5"
        }`}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-[420px] rounded-3xl border p-8 shadow-elevated backdrop-blur-2xl ${
          dark
            ? "border-white/10 bg-white/[0.06]"
            : "border-black/5 bg-white/70"
        }`}
      >
        <div className="flex flex-col items-center text-center">

          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white">
            <Sparkles size={26} />
          </div>

          <h1
            className={`text-2xl font-bold ${
              dark ? "text-white" : "text-black"
            }`}
          >
            Google Classroom Clone
          </h1>

          <p
            className={`mt-2 text-sm ${
              dark ? "text-white/60" : "text-gray-500"
            }`}
          >
            Sign in with your Google account
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSignIn}
          disabled={loading}
          className={`mt-8 flex w-full items-center justify-center gap-3 rounded-full border px-5 py-3.5 font-semibold ${
            dark
              ? "border-white/10 bg-white text-black"
              : "border-gray-200 bg-white"
          }`}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2
                  className="animate-spin"
                  size={18}
                />
                Signing In...
              </span>
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-300/30" />
          <span className="text-xs text-gray-400">
            Students & Faculty
          </span>
          <span className="h-px flex-1 bg-gray-300/30" />
        </div>

        <div
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs ${
            dark
              ? "bg-white/5 text-white/60"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          <ShieldCheck size={14} />
          Secure Google Authentication
        </div>
      </motion.div>
    </div>
  );
}