# Atualizações da beta

A linha iniciada em 1.2.5 usa `com.menteagil.offline.beta` e uma assinatura fixa.
Instalar um APK mais recente dessa linha sobre o anterior mantém o armazenamento do
aplicativo. Desinstalar, limpar os dados ou perder o aparelho continua exigindo backup;
a assinatura não oferece sincronização em nuvem.

## Preparar uma atualização

1. Mantenha o identificador, a assinatura e os nomes do armazenamento. Aumente o
   `versionCode`, atualize `versionName` e o rodapé da interface.
2. Execute os testes. A compilação gera um APK **sem assinatura**, não instalável,
   e ferramentas para a etapa privada. Nenhuma chave é enviada ao GitHub Actions.
3. Recupere a chave privada existente, a senha e o último APK entregue. O alias e a
   impressão digital pública estão em `release-identity.json`.
4. Execute a assinatura local abaixo, usando caminhos reais. O script impede pacote
   incorreto, APK de depuração, chave diferente e versão que não avance.

```sh
python3 scripts/sign_beta.py \
  --input /caminho/app-release-unsigned.apk \
  --output /caminho/Mente-Agil-Beta-vN.apk \
  --apksigner /caminho/tools/apksigner.jar \
  --aapt2 /caminho/tools/aapt2 \
  --keystore /privado/Mente-Agil-Beta-Signing.p12 \
  --password-file /privado/Mente-Agil-Beta-Signing-Password.txt \
  --previous-apk /caminho/ultima-beta-assinada.apk
```

Somente a primeira versão (`versionCode` 8) dispensa `--previous-apk`. Guarde o APK
assinado e seu checksum. Distribua somente o APK final, nunca a chave nem a senha.
Em instalações existentes desta linha, escolha **Atualizar**, sem desinstalar.

O histórico local continua limitado aos 100 treinos mais recentes. O backup local
criptografado está em Ajustes; ele não é uma conta de recuperação do ranking.

Referências: [assinatura Android](https://developer.android.com/studio/publish/app-signing)
e [apksigner](https://developer.android.com/tools/apksigner).
