import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NavBar from "@/components/NavBar";
import PageTransition from "@/components/PageTransition";
import MotionProvider from "@/components/MotionProvider";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Notes Repo",
  description: "Find and share study notes with your class.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <MotionProvider>
          <AuthProvider>
            <NavBar />
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
          </AuthProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
