"use client";

import { useEffect, useState } from "react";

export default function RegistrationForm({ displayName }) {
  const [nickname, setNickname] = useState("");
  const [account, setAccount] = useState(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("Verificando seu cadastro…");

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!ok || !data.authenticated) throw new Error("Sua sessão expirou. Entre novamente.");
        if (data.account) {
          setAccount(data.account);
          setState("ready");
        } else {
          setState("form");
        }
      })
      .catch((error) => {
        setState("error");
        setMessage(error.message || "Não foi possível verificar a conta.");
      });
  }, []);

  const register = async (event) => {
    event.preventDefault();
    if (nickname.trim().length < 2) {
      setState("error");
      setMessage("Escolha um apelido com pelo menos 2 caracteres.");
      return;
    }
    setState("saving");
    setMessage("Reservando seu apelido…");
    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a conta.");
      setAccount(data.account);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error.message || "Não foi possível criar a conta.");
    }
  };

  if (state === "loading") return <div className="auth-status">{message}</div>;
  if (account) {
    return (
      <div className="registration-success">
        <span>✓</span>
        <p>Conta ativa para <strong>{account.nickname}</strong>. Esse apelido agora pertence somente à sua identidade.</p>
        <a className="primary-button auth-main-action" href="/treinar">Começar treino <span>→</span></a>
      </div>
    );
  }

  return (
    <form className="registration-form" onSubmit={register}>
      <p>Identidade confirmada como <strong>{displayName}</strong>. Agora escolha o nome público que aparecerá no ranking.</p>
      <label htmlFor="register-nickname">Apelido exclusivo</label>
      <input id="register-nickname" maxLength={18} autoComplete="nickname" placeholder="Ex.: Marcos" value={nickname} onChange={(event) => { setNickname(event.target.value); if (state === "error") setState("form"); }} />
      <small>O apelido não poderá ser usado por outra conta.</small>
      <button className="primary-button" type="submit" disabled={state === "saving"}>{state === "saving" ? "Criando conta…" : "Criar minha conta"} <span>→</span></button>
      {state === "error" && <div className="auth-error">{message}</div>}
    </form>
  );
}
