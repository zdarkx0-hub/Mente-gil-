# Política de segurança

## Como relatar uma vulnerabilidade

Não publique dados pessoais, tokens, chaves ou detalhes exploráveis em uma issue aberta.

Use o recurso privado **Report a vulnerability** na aba **Security** do repositório, quando disponível. Caso ele não esteja habilitado, entre em contato privadamente com o responsável pelo repositório antes de divulgar os detalhes.

Inclua somente o necessário para reproduzir o problema:

- área afetada e versão;
- passos de reprodução;
- impacto observado;
- sugestão de correção, se houver.

## Segredos e dados

- segredos locais ficam em `.env.local`, que é ignorado pelo Git;
- `USER_DATA_HMAC_SECRET` nunca deve aparecer em código, logs, APKs ou commits;
- dados reais de contas e treinos não pertencem ao repositório;
- respostas privadas de `/api/` não devem ser armazenadas pelo Service Worker;
- exemplos de banco devem usar apenas dados fictícios.

Se um segredo for enviado por engano, removê-lo do arquivo não é suficiente: ele deve ser revogado e substituído imediatamente.

## Versões suportadas

A versão publicada atual recebe correções de segurança. Branches antigas são mantidas apenas como histórico e não devem ser usadas em produção.
