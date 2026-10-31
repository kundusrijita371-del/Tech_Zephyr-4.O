import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIT CAMPUS OS — Intelligent Campus Scheduling & Venue Management",
  description:
    "Enterprise campus scheduling, midsem examination planning, and Spectra fest venue management platform for Chilika Institute of Technology.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#101014] text-[#F4F2FA] font-sans selection:bg-[#8B5CF6]/30 selection:text-[#A78BFA]">
        {children}
      </body>
    </html>
  );
}
