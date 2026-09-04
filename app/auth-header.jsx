import { chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import Link from "next/link";
import StudyNavigation from "./study-navigation";
import PwaControls from "./pwa-controls";

export default async function AuthHeader() {
  const user = await getChatGPTUser();

  return (
    <header className="topbar-shell">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <div className="topbar">
      <Link className="brand" href="/" aria-label="Mente Ágil — início">
        <span className="brand-mark">M</span>
        <span>Mente Ágil</span>
      </Link>
      <StudyNavigation />
      <div className="nav-actions">
        <PwaControls />
        {user ? (
          <div className="account-actions">
            <span className="nav-account" title={user.email}>{user.displayName}</span>
            <a className="auth-link subtle" href={chatGPTSignOutPath("/")} target="_top">Sair</a>
          </div>
        ) : (
          <div className="account-actions">
            <a className="auth-link subtle" href="/entrar">Entrar</a>
            <a className="auth-link" href="/cadastro">Criar conta</a>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
