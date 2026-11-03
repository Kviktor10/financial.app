# Mercado & Finanças

Aplicativo pessoal de supermercado e controle financeiro, feito com HTML5, CSS3 e JavaScript puro. Não exige servidor de aplicação, banco de dados remoto, conta externa ou dependências de terceiros.

## 1. Como executar no Windows

1. Extraia o arquivo ZIP para uma pasta do computador.
2. Abra a pasta `mercado-financas-app`.
3. Dê dois cliques em `iniciar_windows.bat`.
4. O navegador abrirá em `http://localhost:8000`.
5. Na primeira execução, cadastre a senha-mestra e o código mestre.

O script utiliza Python 3, que costuma estar disponível em ambientes de desenvolvimento. Como alternativa, abra a pasta no Visual Studio Code e execute um servidor local pela extensão Live Server.

**Não execute o aplicativo por `file://` como forma principal.** Use `localhost` ou HTTPS. A Web Crypto API exige contexto seguro; `localhost` é tratado pelos navegadores modernos como contexto seguro. O service worker também depende de contexto seguro.

Para iniciar manualmente, no terminal dentro da pasta do projeto:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## 2. Funcionalidades incluídas

### Dashboard
- Saldo disponível calculado por entradas menos saídas.
- Gastos do dia, da semana e do mês.
- Gráfico de despesas dos últimos sete dias.
- Distribuição das despesas por categoria.
- Movimentações recentes.

### Caixa / supermercado
- Catálogo de produtos com nome, categoria, unidade e preço.
- Categorias com ícones: comida, limpeza, medicamento, eletrônico, higiene, escolar, utensílios, vestuário, bebidas, supermercado, transporte, moradia, contas, lazer, pets e outros.
- Carrinho com quantidade ajustável e subtotal por produto.
- Salvamento de listas sem alterar o saldo financeiro.
- Finalização da compra com opção explícita de registrar ou não a despesa no financeiro.
- Histórico de compras e listas salvas.
- Relatório imprimível, com data e horário, produto, preço unitário, quantidade, subtotal e total. Na janela de impressão, selecione “Salvar como PDF” para gerar um PDF.

### Controle financeiro
- Registro de entradas e saídas manuais.
- Categoria, valor, descrição, data, horário e observações.
- Edição e exclusão de movimentações manuais.
- O saldo é recalculado automaticamente.
- Uma compra do supermercado só altera o saldo quando finalizada com a opção “Lançar como despesa no controle financeiro” marcada.
- Compras não vinculadas ao financeiro continuam visíveis no módulo de supermercado e nos relatórios de compras, sem serem somadas às despesas bancárias.

### Calendário e relatórios
- Calendário mensal com indicação dos dias que tiveram despesas.
- Detalhamento das movimentações por dia.
- Relatórios de dia, semana, mês e ano.
- Despesas por categoria.
- Exportação das movimentações financeiras para CSV.

### Cofre de credenciais
- Cadastro de serviço, e-mail/usuário, senha, código de recuperação, chave 2FA e observações.
- Edição de credenciais.
- Exclusão mediante código mestre.
- Cofre armazenado em registro criptografado separado dos dados operacionais.

### Configurações e proteção
- E-mail de referência local.
- Bloqueio automático por inatividade.
- Alteração da senha-mestra, com recriptografia dos dados.
- Alteração do código mestre.
- Backup e restauração do conteúdo criptografado.
- Limpeza dos dados operacionais mediante código mestre, preservando o cofre de credenciais e a autenticação.
- Instalação como aplicativo (PWA) em navegadores compatíveis e cache para uso offline após a primeira abertura.

## 3. Organização do projeto

```text
mercado-financas-app/
├── assets/
│   └── icon.svg
├── src/
│   ├── controllers/
│   │   ├── app-controller.js
│   │   └── auth-controller.js
│   ├── core/
│   │   ├── config.js
│   │   ├── local-db.js
│   │   └── utils.js
│   ├── models/
│   │   └── default-data.js
│   ├── security/
│   │   └── crypto.js
│   ├── services/
│   │   ├── finance-service.js
│   │   └── shopping-service.js
│   ├── views/
│   │   └── templates.js
│   └── app.js
├── index.html
├── manifest.webmanifest
├── styles.css
├── sw.js
├── iniciar_windows.bat
└── README.md
```

A aplicação separa modelos de dados, serviços de domínio, controladores e templates de interface, seguindo uma organização MVC adaptada a uma SPA sem framework. Para executar os testes dos serviços com Node.js 22 ou superior, rode `npm test` na pasta do projeto.

## 4. Modelo de dados local

O conteúdo operacional é organizado nas seguintes coleções:

- `products`: catálogo de produtos.
- `activeCart`: carrinho em andamento.
- `purchases`: listas salvas e compras finalizadas, com cópia dos itens e dos preços praticados.
- `transactions`: entradas e saídas financeiras.
- `settings`: e-mail de referência e preferências.
- `categories`: categorias disponíveis.
- `credentials`: registros independentes do cofre de credenciais.

Os dados são serializados em JSON e gravados no `localStorage` somente após criptografia. O aplicativo não grava produtos, e-mails de credenciais, senhas ou movimentações em texto puro no `localStorage`.

## 5. Modelo criptográfico

- **AES-256-GCM**: criptografia autenticada dos dados operacionais e do cofre.
- **PBKDF2-HMAC-SHA-256, 600.000 iterações**: derivação de chave a partir da senha-mestra e geração do verificador do código mestre.
- **HKDF-SHA-256**: separação de chaves para autenticação, dados operacionais e cofre de credenciais.
- **Salt aleatório**: gerado com `crypto.getRandomValues()`.
- **IV aleatório de 96 bits**: gerado a cada operação AES-GCM.
- **Chave de sessão em memória**: a senha e as chaves derivadas não são guardadas como token no `localStorage` ou `sessionStorage`; o usuário precisa desbloquear o aplicativo novamente depois de fechar/recarregar ou após o bloqueio automático.

A OWASP recomenda Argon2id como primeira opção para armazenamento de senhas. Como este projeto usa as primitivas nativas da Web Crypto API, foi adotado PBKDF2-HMAC-SHA-256 com 600.000 iterações, parâmetro indicado pela OWASP para o cenário PBKDF2/FIPS. Isso é uma escolha de compatibilidade nativa, não uma afirmação de que PBKDF2 seja superior ao Argon2id.

Referências técnicas:
- OWASP, *Password Storage Cheat Sheet*: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- MDN, *Web Crypto API*: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

## 6. Limites de segurança importantes

1. **Não existe recuperação mágica da senha-mestra.** Se ela for esquecida, os dados cifrados não poderão ser abertos sem a senha original. O código mestre autoriza exclusões e alterações sensíveis; ele não substitui a senha-mestra.
2. O cofre de credenciais permanece criptografado separadamente quando os dados operacionais são limpos, mas continua protegido pela mesma senha-mestra de acesso ao aplicativo.
3. Os dados ficam no perfil do navegador e dispositivo em que foram cadastrados. Não há sincronização automática entre celular e computador.
4. Limpar os dados do navegador, trocar o perfil do navegador ou desinstalar o navegador pode apagar o `localStorage`. Exporte backups criptografados periodicamente e guarde-os em local seguro.
5. A criptografia em repouso não protege contra um computador infectado, extensão maliciosa, navegador comprometido ou pessoa que utilize o dispositivo enquanto o aplicativo estiver desbloqueado.
6. Este é um aplicativo local de uso pessoal, sem auditoria independente de segurança. Não deve ser tratado como substituto de um gerenciador de senhas profissional auditado para segredos de alto impacto.
7. O código de autenticação de dois fatores é armazenado como segredo; esta versão não gera códigos TOTP temporários.

## 7. Observações de uso

- A senha-mestra deve possuir no mínimo 12 caracteres, com letras maiúsculas, minúsculas e números.
- O código mestre deve possuir no mínimo 8 caracteres e ser diferente da senha-mestra.
- A exclusão de uma credencial exige o código mestre.
- A exclusão de movimentações manuais atualiza o saldo. Movimentações originadas de compras devem ser estornadas pela exclusão da compra correspondente.
- O relatório de compra pode ser impresso ou salvo em PDF usando a função de impressão do navegador.
