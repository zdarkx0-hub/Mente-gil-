import "./globals.css";
import AuthHeader from "./auth-header";

export const metadata = {
  title: "Mente Ágil — Cálculo Mental",
  description: "Treino adaptativo de soma, subtração e multiplicação até 1.000 com contas protegidas e ranking público"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><AuthHeader />{children}</body>
    </html>
  );
}
