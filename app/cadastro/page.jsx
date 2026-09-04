import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getChatGPTUser();

  return (
    <main className="auth-page" id="conteudo">
      <section className="auth-card">
        <span className="eyebrow">NOVO JOGADOR</span>
        <h1>Criar conta</h1>
        {!user ? (
          <>
            <p>Primeiro, confirme sua identidade com uma conta ChatGPT. Depois você escolherá um apelido exclusivo para o ranking.</p>
            <a className="primary-button auth-main-action" href={chatGPTSignInPath("/cadastro")} target="_top">Continuar com ChatGPT <span>→</span></a>
            <small>Já possui cadastro? <a href="/entrar">Entre na sua conta.</a></small>
          </>
        ) : (
          <RegistrationForm displayName={user.displayName} />
        )}
      </section>
    </main>
  );
}
