import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/components/demo-provider";

export const metadata: Metadata = {
  title: "Pacioli",
  description: "Your household, run like a business.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: { url: "/icon.png", type: "image/png" },
    other: [
      { url: "/icon.png", sizes: "192x192", type: "image/png", rel: "icon" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Satoshi — brand typeface from Fontshare (free, no API key needed) */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <DemoProvider>
            {children}
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
