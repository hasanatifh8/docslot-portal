import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const appFont = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-app" });

export const metadata: Metadata = {
  title: "DocSlot HMS",
  description: "Hospital management — patients, OPD, appointments and WhatsApp booking — by Cliccx",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${appFont.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-canvas text-slate-900">{children}</body>
    </html>
  );
}
