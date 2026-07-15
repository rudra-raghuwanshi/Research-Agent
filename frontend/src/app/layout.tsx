import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Paper Analysis Agent",
  description: "AI-powered research paper analysis using Gemma 4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
