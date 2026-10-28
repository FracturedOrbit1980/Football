import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import Script from "next/script";

import { RoleProvider } from "@/components/auth/role-session";
import { ClubProvider } from "@/components/club/club-provider";
import { ClubTheme } from "@/components/club/club-theme";
import { appearanceScript } from "@/components/layout/appearance";
import { AppShell } from "@/components/layout/app-shell";
import { InstallServiceWorker } from "@/components/layout/install-service-worker";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Football",
    template: `%s · Football`,
  },
  description: "Football. Squads, drills, and pitch-side match tools for Clubstride.",
  applicationName: "Football",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest?v=2`,
  appleWebApp: {
    capable: true,
    title: "Football",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1b33",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full">
        <Script id="football-appearance" strategy="beforeInteractive">
          {appearanceScript}
        </Script>
        <InstallServiceWorker />
        <RoleProvider>
          <ClubTheme />
          <AppShell>
            <ClubProvider>{children}</ClubProvider>
          </AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
