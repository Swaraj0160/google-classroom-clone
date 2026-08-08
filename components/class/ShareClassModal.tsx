"use client";

import { useState } from "react";
import { Check, Copy, Send, Share2, X } from "lucide-react";
import { showToast } from "@/lib/toast";

interface ShareClassModalProps {
  open: boolean;
  onClose: () => void;
  courseTitle: string;
  subject: string | null;
  joinCode: string | null;
}

function buildInviteMessage(
  courseTitle: string,
  subject: string | null,
  joinCode: string,
  portalUrl: string
): string {
  const lines = [
    "Join my class on Faculty Classroom",
    "",
    `Class: ${courseTitle}`,
  ];
  if (subject) lines.push(`Subject: ${subject}`);
  lines.push(
    `Class Code: ${joinCode}`,
    "",
    "Open the portal:",
    portalUrl,
    "",
    "Sign in as a student and use the class code above to join the class."
  );
  return lines.join("\n");
}

function getPortalUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export default function ShareClassModal({
  open,
  onClose,
  courseTitle,
  subject,
  joinCode,
}: ShareClassModalProps) {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!open) return null;

  const canShare = !!joinCode;
  const portalUrl = getPortalUrl();
  const message = joinCode ? buildInviteMessage(courseTitle, subject, joinCode, portalUrl) : "";
  const webShareSupported =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyText(text: string, onDone: (v: boolean) => void, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      onDone(true);
      showToast.success(`${label} copied`);
      setTimeout(() => onDone(false), 2000);
    } catch {
      showToast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }

  async function handleShare() {
    if (!canShare) return;
    if (webShareSupported) {
      try {
        await navigator.share({ title: "Join my class", text: message });
        return;
      } catch {
        // user cancelled the native share sheet, or it failed — fall back to copy
      }
    }
    void copyText(message, setCopiedMessage, "Message");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30">
            <Share2 size={20} />
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          Share Class
        </h3>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {courseTitle}
          {subject ? ` · ${subject}` : ""}
        </p>

        {!canShare ? (
          <p className="mt-5 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-600">
            This class doesn&apos;t have a join code yet.
          </p>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Class Code</p>
                <p className="text-lg font-semibold tracking-wider text-gray-900 dark:text-gray-100">
                  {joinCode}
                </p>
              </div>
              <button
                onClick={() => copyText(joinCode, setCopiedCode, "Code")}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                {copiedCode ? "Copied" : "Copy Code"}
              </button>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">
                Invitation Message
              </p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-3 font-sans text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                {message}
              </pre>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => copyText(message, setCopiedMessage, "Message")}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {copiedMessage ? <Check size={15} /> : <Copy size={15} />}
                {copiedMessage ? "Copied" : "Copy Message"}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {webShareSupported ? <Share2 size={15} /> : <Send size={15} />}
                {webShareSupported ? "Share" : "Copy & Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
