import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIT Campus Scheduling & Venue Management",
  description:
    "Enterprise campus scheduling, midsem examination planning, and Spectra fest venue management platform for Chilika Institute of Technology.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
