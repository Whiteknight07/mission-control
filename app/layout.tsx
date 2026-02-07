import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";
import { Nav } from "@/components/designs/glass-morphism";
import { ConvexClientProvider } from "./convex-client-provider";

const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Mission Control",
    template: "%s | Mission Control",
  },
  description: "Realtime dashboard for monitoring Clawd agent activity, tasks, and searchable workspace memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${display.variable} ${mono.variable} min-h-screen antialiased`}>
        <ConvexClientProvider>
          <div className="relative min-h-screen pb-32 pt-14 md:pb-20 md:pt-14">
            <Nav />
            <main className="mx-auto w-full max-w-[1600px] px-4 pt-4 md:pl-[18rem] md:pr-6 md:pt-6">
              {children}
            </main>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
