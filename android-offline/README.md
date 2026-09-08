# Mente Ágil Mobile para Android

Aplicativo Android independente do site. Os treinos são executados no aparelho e funcionam sem internet. Somente o ranking exclusivo do app usa uma conexão HTTPS.

## Recursos

- soma, subtração e multiplicação;
- dificuldades Base, Até 100 e Até 1.000;
- sessões de 10 ou 15 questões e cronômetros de 1 ou 2 minutos;
- foco automático no campo de resposta e sons de acerto e erro;
- histórico, evolução, foguinho e conquistas locais;
- ranking mobile separado por operação, dificuldade e tempos de 1 ou 2 minutos;
- dados criptografados com AES-GCM e chave protegida pelo Android Keystore;
- visual mobile próprio, responsivo para celular e tablet.

O ranking do aplicativo não se mistura com o ranking do site. As duas edições evoluem separadamente, portanto uma atualização do site pode não aparecer no app. O histórico continua privado no aparelho; no ranking são publicados apenas o nome escolhido e o resultado agregado. Desinstalar o aplicativo apaga o histórico local.

## Privacidade e rede

- treino, histórico, gráficos, conquistas e foguinho: offline;
- ranking mobile: online, pela URL HTTPS fixa do Mente Ágil;
- identificação da instalação: pseudonimizada no servidor antes de ser gravada;
- contas respondidas: validadas no servidor, mas não armazenadas no banco do ranking.

## Validação

```bash
node --test tests/*.test.cjs
gradle --no-daemon :app:assembleDebug
```

O APK gerado fica em `app/build/outputs/apk/debug/app-debug.apk`. Versão atual: 1.1.0 Mobile.
