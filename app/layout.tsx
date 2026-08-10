import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "ESAT Atlas | Cambridge Engineering Preparation",
  description: "Evidence-led ESAT practice, exam simulation, mistake diagnosis and spaced retrieval for Mathematics 1, Physics and Mathematics 2.",
  openGraph: {
    title: "ESAT Atlas",
    description: "Fresh performance. Honest evidence.",
    type: "website",
    images: [{ url: "/og.png", width: 1728, height: 904, alt: "ESAT Atlas — Fresh performance. Honest evidence." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ESAT Atlas",
    description: "Fresh performance. Honest evidence.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
