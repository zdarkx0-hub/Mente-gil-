# Mente Ágil Offline para Android

Aplicativo Android independente do site. Todo o treino é executado no aparelho e o manifesto não solicita a permissão `INTERNET`.

## Recursos

- soma, subtração e multiplicação;
- dificuldades Base, Até 100 e Até 1.000;
- sessões de 10 ou 15 questões e cronômetros de 1 ou 2 minutos;
- foco automático no campo de resposta e sons de acerto e erro;
- histórico, evolução, foguinho e conquistas locais;
- dados criptografados com AES-GCM e chave protegida pelo Android Keystore;
- layout responsivo para celular e tablet.

O ranking online e a conta do site não fazem parte desta edição, pois ela foi projetada para funcionar sem rede. Desinstalar o aplicativo apaga o histórico local.

## Validação

```bash
node --test tests/*.test.cjs
gradle --no-daemon :app:assembleDebug
```

O APK gerado fica em `app/build/outputs/apk/debug/app-debug.apk`.
