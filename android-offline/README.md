# Mente Ágil Mobile para Android

Aplicativo Android independente do site. Os treinos são executados no aparelho e
funcionam sem internet. Ranking, conta, amigos e sincronização usam HTTPS.

## Recursos

- soma, subtração e multiplicação;
- dificuldades Base, Até 100 e Até 1.000;
- sessões de 10 ou 15 questões e cronômetros de 1 ou 2 minutos;
- foco automático no campo de resposta e sons de acerto e erro;
- histórico, evolução, foguinho e conquistas locais;
- temas Pulso Neon, Chamas, Cristal, Eclipse e Rosa Aurora liberados na Beta;
- coleção de medalhas locais e medalhas competitivas verificadas;
- ranking mobile separado por operação, dificuldade e tempos de 1 ou 2 minutos;
- dados criptografados com AES-GCM e chave protegida pelo Android Keystore;
- backup portátil cifrado por senha com PBKDF2 e AES-GCM;
- exportação e exclusão separada dos dados locais e do ranking;
- visual mobile próprio, responsivo para celular e tablet;
- configuração de perfil com foto local, conta, ID público e amigos.

O ranking do aplicativo não se mistura com o ranking do site. As duas edições evoluem separadamente, portanto uma atualização do site pode não aparecer no app. O histórico continua privado no aparelho; no ranking são publicados apenas o nome escolhido, o resultado agregado e até três medalhas competitivas selecionadas. Desinstalar o aplicativo apaga o histórico local quando não há um backup exportado.

## Privacidade e rede

- treino, histórico, gráficos, conquistas e foguinho: offline;
- ranking mobile: online, pela URL HTTPS fixa do Mente Ágil;
- identificação da instalação: pseudonimizada no servidor antes de ser gravada;
- contas ranqueadas: emitidas e validadas uma a uma pelo servidor;
- respostas detalhadas de segurança: retenção operacional limitada, separada dos recordes agregados;
- ranking comum: publica apenas apelido, pontuação, acertos, sequência e medalhas escolhidas.

## Validação

Use Node 24.15 ou superior da linha 24:

```bash
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

A organização dos módulos e as regras para continuar o desenvolvimento estão em
[ARCHITECTURE.md](ARCHITECTURE.md).

## Compilação da Beta

A versão atual é 1.3.1 Beta (`versionCode` 10), com pacote
`com.menteagil.offline.beta`. Para uma nova entrega, siga
[RELEASING.md](RELEASING.md), avance a versão e compile:

```bash
gradle --no-daemon :app:assembleRelease
```

O APK sem assinatura fica em `app/build/outputs/apk/release/app-release-unsigned.apk`.
Ele precisa da assinatura privada existente antes de ser instalado como atualização.

## Atualização 1.3.1

Organiza treino, ranking, histórico, armazenamento e configurações em módulos.
Corrige respostas atrasadas que podiam afetar outra categoria ou um novo treino,
protege a troca de contas e preserva sessões antigas sem ID na união do histórico.
Mantém a identidade e a assinatura da Beta 1.3.0 para instalação como atualização.
