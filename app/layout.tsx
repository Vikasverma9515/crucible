import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "CRUCIBLE — AI Survival Arena",
  description: "Watch AI agents battle for survival in a living world.",
  robots: { follow: true, index: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-[#060a0f] text-white antialiased">{children}</body>
    </html>
  );
}
