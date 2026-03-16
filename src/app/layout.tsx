import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Market Lens - Stock Move Explainer",
  description:
    "Understand why stocks are moving today with AI-powered analysis and real-time news context.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-zinc-950 text-white antialiased`}
      >
        <div className="mx-auto max-w-3xl px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
