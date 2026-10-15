import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { RoleProvider } from "@/components/auth/role-session";
import { BrandingProvider } from "@/components/cloud/branding";
import { CloudSessionProvider } from "@/components/cloud/cloud-session";
import { ClubProvider } from "@/components/club/club-provider";
import { ClubTheme } from "@/components/club/club-theme";
import { SyncProvider } from "@/components/sync/sync-provider";
import { appearanceScript } from "@/components/layout/appearance";
import { AppShell } from "@/components/layout/app-shell";
import { InstallServiceWorker } from "@/components/layout/install-service-worker";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Football",
    template: `%s · Football`,
  },
  description: "Football. Squads, drills, and pitch-side match tools for Sportfica.",
  applicationName: "Football",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
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
  themeColor: "#d16b6f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full">
        <Script id="football-appearance" strategy="beforeInteractive">
          {appearanceScript}
        </Script>
        <InstallServiceWorker />
        <CloudSessionProvider>
          <RoleProvider>
            <BrandingProvider>
              <ClubTheme />
              <AppShell>
                <ClubProvider>
                  <SyncProvider>{children}</SyncProvider>
                </ClubProvider>
              </AppShell>
            </BrandingProvider>
          </RoleProvider>
        </CloudSessionProvider>
      </body>
    </html>
  );
}
