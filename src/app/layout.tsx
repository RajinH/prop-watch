import type { Metadata } from "next";
import { Red_Hat_Display } from "next/font/google";
import { ToastProvider } from "@/components/ui/ToastProvider";
import "./globals.css";

const redHatDisplay = Red_Hat_Display({
  variable: "--font-red-hat-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "PropWatch — Property Portfolio Intelligence",
    template: "%s — PropWatch",
  },
  description:
    "Track, analyse, and stress-test your property portfolio in one place.",
  metadataBase: new URL("https://prop-watch-gray.vercel.app"),
  openGraph: {
    title: "PropWatch — Property Portfolio Intelligence",
    description:
      "Track, analyse, and stress-test your property portfolio in one place.",
    url: "https://prop-watch-gray.vercel.app",
    siteName: "PropWatch",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PropWatch — Property Portfolio Intelligence",
    description:
      "Track, analyse, and stress-test your property portfolio in one place.",
  },
  themeColor: "#166534",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${redHatDisplay.variable} h-full antialiased`}>
      <body
        className="min-h-full"
        style={{
          fontFamily: "var(--font-red-hat-display), system-ui, sans-serif",
        }}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
