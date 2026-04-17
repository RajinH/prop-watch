import type { Metadata } from "next";
import { Red_Hat_Display } from "next/font/google";
import "./globals.css";

const redHatDisplay = Red_Hat_Display({
  variable: "--font-red-hat-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PropWatch — Can I afford this property?",
  description: "Instant property investment decision engine. No sign-up. No backend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${redHatDisplay.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ fontFamily: "var(--font-red-hat-display), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
