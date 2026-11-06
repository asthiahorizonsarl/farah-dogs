import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Farah Dogs · Gestion", template: "%s · Farah Dogs" },
  description: "Gestion des membres, chiens, cotisations et dons de l'association Farah Dogs",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans lg:flex">
        <Suspense fallback={<aside className="hidden h-screen w-64 shrink-0 bg-ink lg:block" />}>
          <Sidebar />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
