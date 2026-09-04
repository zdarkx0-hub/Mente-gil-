import "./globals.css";
import AuthHeader from "./auth-header";

export const metadata = {
  applicationName: "Mente Ágil",
  title: "Mente Ágil — Cálculo Mental",
  description: "Treino adaptativo de soma, subtração e multiplicação até 1.000 com contas protegidas e ranking público",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mente Ágil"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071211",
  colorScheme: "dark"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body><AuthHeader />{children}</body>
    </html>
  );
}
