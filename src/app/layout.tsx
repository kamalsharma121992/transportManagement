import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JM Transport - Truck Management",
  description: "Manage truck trips, expenses, and fleet analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <Sidebar />
        <main className="md:ml-64 min-h-full p-4 md:p-8 pt-16 md:pt-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
