import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faculty Classroom | Dashboard",
  description: "AI-powered faculty dashboard inspired by Google Classroom",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
