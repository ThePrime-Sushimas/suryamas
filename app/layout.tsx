import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from '@/contexts/ThemeContext';
import LayoutClient from '@/components/layout/LayoutClient';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono", 
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Suryamas",
    default: "Suryamas - Employee Management"
  },
  description: "Employee management system for Suryamas",
  keywords: ["employee", "management", "restaurant", "suryamas"],
  authors: [{ name: "Suryamas Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <LayoutClient>
              {children}
            </LayoutClient>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
