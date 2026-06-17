import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cubestats",
  description: "Inspect WCA personal best progression and event statistics.",
};

// Resolve the theme before first paint to avoid a flash of the wrong theme:
// use the stored preference, else fall back to the OS color scheme.
const themeScript = `(function(){try{var t=localStorage.getItem('cubestats:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
