"use client";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
  duration?: number;
}

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.id = "app-toast-container";
  container.style.position = "fixed";
  container.style.top = "16px";
  container.style.right = "16px";
  container.style.zIndex = "2147483647";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "8px";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  return container;
}

const styles: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: "#ecfdf3", border: "#16a34a", text: "#15803d" },
  error: { bg: "#fef2f2", border: "#dc2626", text: "#b91c1c" },
  info: { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8" },
};

function toast(message: string, type: ToastType = "info", options: ToastOptions = {}) {
  if (typeof window === "undefined") return;
  const el = document.createElement("div");
  const s = styles[type];
  el.textContent = message;
  el.style.pointerEvents = "auto";
  el.style.minWidth = "240px";
  el.style.maxWidth = "360px";
  el.style.padding = "12px 16px";
  el.style.borderRadius = "12px";
  el.style.fontSize = "13px";
  el.style.fontWeight = "500";
  el.style.fontFamily = "Inter, -apple-system, sans-serif";
  el.style.background = s.bg;
  el.style.color = s.text;
  el.style.border = `1px solid ${s.border}33`;
  el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
  el.style.opacity = "0";
  el.style.transform = "translateY(-8px)";
  el.style.transition = "opacity 0.25s ease, transform 0.25s ease";

  getContainer().appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  const duration = options.duration ?? 3500;
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => el.remove(), 250);
  }, duration);
}

export const showToast = {
  success: (message: string, options?: ToastOptions) => toast(message, "success", options),
  error: (message: string, options?: ToastOptions) => toast(message, "error", options),
  info: (message: string, options?: ToastOptions) => toast(message, "info", options),
};