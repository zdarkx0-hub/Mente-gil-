import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getChatGPTUser();

  return (
    <main className="auth-page" id="conteudo">
      <section className="auth-card">
        <span className="eyebrow">CONTA PROTEGIDA</span>
        <h1>{user ? "Você já entrou." : "Entrar"}</h1>
        {user ? (
          <>
            <p>Sessão ativa como <strong>{user.displayName}</strong>. Seus resultados ranqueados serão vinculados a esta identidade.</p>
            <div className="auth-actions-row">
              <a className="primary-button" href="/treinar">Ir para o treino <span>→</span></a>
              <a className="secondary-button auth-secondary" href={chatGPTSignOutPath("/entrar")} target="_top">Sair da conta</a>
            </div>
          </>
        ) : (
          <>
            <p>Use sua conta ChatGPT para acessar o apelido e o histórico protegidos. O Mente Ágil não recebe nem armazena sua senha.</p>
            <a className="primary-button auth-main-action" href={chatGPTSignInPath("/")} target="_top">Entrar com ChatGPT <span>→</span></a>
            <small>Ainda não possui conta? <a href="/cadastro">Abra a área de cadastro.</a></small>
          </>
        )}
      </section>
    </main>
  );
}
