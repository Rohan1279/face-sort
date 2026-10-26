import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600" },
  ],
  variable: "--font-general",
});
const geistMono = Geist_Mono({ subsets: ["latin"], weight: "400", variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Face Sort",
  description: "Sort photos by the people in them, privately in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(generalSans.variable, geistMono.variable)}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
