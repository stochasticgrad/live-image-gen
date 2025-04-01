import type { Metadata } from "next";
import { Roboto_Condensed } from 'next/font/google';
import "./globals.css";

const RobotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: "Live Image Generation",
  description: "Live Image Generation",
  icons: {
    icon: "/favicon.ico", // Default favicon
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${RobotoCondensed.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
