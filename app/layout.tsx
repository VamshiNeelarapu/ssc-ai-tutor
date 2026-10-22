import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorPopupProvider } from "@/components/ErrorPopup";

export const metadata: Metadata = {
  title: "SSC AI Study App",
  description: "AI-powered SSC CGL preparation workspace",
};

export const viewport: Viewport = {
  themeColor: "#0f2447",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ErrorPopupProvider>{children}</ErrorPopupProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
