import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/app/providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  applicationName: "VentureOS",
  title: {
    default: "VentureOS",
    template: "%s · VentureOS",
  },
  description:
    "The operating system for companies. Found, operate, and decide from one desk.",
  authors: [{ name: "VentureOS" }],
  openGraph: {
    title: "VentureOS",
    description:
      "The operating system for companies. Found, operate, and decide from one desk.",
    siteName: "VentureOS",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-ids-brand="ventureos"
      data-ids-atmosphere="ventureos"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
