import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cubestats",
  description: "Inspect WCA personal best progression and event statistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
