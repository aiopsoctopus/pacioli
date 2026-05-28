import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/components/demo-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pacioli",
  description: "Your household, run like a business.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    other: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png", rel: "icon" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased min-h-screen`}>
        <ThemeProvider>
          <DemoProvider>
            {children}
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
