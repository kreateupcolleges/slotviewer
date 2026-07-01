import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Training Ops Workspace",
  description: "Faculty, student, slot, and checklist planning for training programs"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
