import type { Metadata } from "next";
import "./globals.css";
import ViewAsBanner from "@/components/admin/ViewAsBanner";

export const metadata: Metadata = {
  title: "Faculty Classroom | Dashboard",
  description: "AI-powered faculty dashboard inspired by Google Classroom",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ViewAsBanner />
        {children}
      </body>
    </html>
  );
}
