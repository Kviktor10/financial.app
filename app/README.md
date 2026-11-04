# Mercado & Finanças — versão 1.4.0

Aplicativo local de compras de supermercado e controle financeiro, desenvolvido em HTML5, CSS3 e JavaScript modular. A abertura é direta, sem login ou senha.

## 1. Como executar no Windows

1. Extraia o ZIP inteiro para uma pasta. Não execute o aplicativo de dentro do ZIP.
2. Abra a pasta `mercado-financas-app`.
3. Dê duplo clique em `iniciar_windows.bat`.
4. O navegador abrirá primeiro a página de atualização de cache e, em seguida, o aplicativo.
5. A página de recuperação removerá os caches antigos do app, preservando o LocalStorage.
6. Mantenha a janela preta do servidor aberta enquanto utilizar o aplicativo. Para encerrar, pressione `Ctrl + C` nessa janela.

O inicializador reutiliza uma instância 1.4.0 que já esteja aberta em `localhost:8000`; caso contrário, procura uma porta livre entre `8000` e `8010`.

**Atualizando a partir da versão anterior:** encerre primeiro o servidor antigo com `Ctrl + C` na janela preta dele e só então execute o novo `iniciar_windows.bat`. Isso ajuda a manter a mesma origem `http://localhost:8000` e, consequentemente, os dados que o navegador já guardou. O `localStorage` é separado por endereço e porta: se o aplicativo abrir em `8001` em vez de `8000`, os registros da outra porta não aparecem automaticamente. Nesse caso, abra a versão antiga na porta original, exporte um backup e importe-o na nova versão.

**Não abra `index.html` diretamente com duplo clique.** O aplicativo usa módulos JavaScript; navegadores restringem o carregamento desses módulos no protocolo `file://`. Se isso ocorrer, a página apresenta uma instrução de correção em vez de deixar a área principal vazia.

Para iniciar manualmente, com Python 3 instalado, execute na pasta do projeto:

```bash
python iniciar_servidor.py
```

Se o navegador mostrar arquivos de uma versão anterior, faça uma atualização forçada com `Ctrl + F5`. O Service Worker foi atualizado para a versão 5. Os módulos também recebem um identificador de versão na URL. A página `atualizar-cache.html` remove caches antigos do app e preserva os dados do LocalStorage.

## 2. Funcionalidades

### Dashboard e supermercado
- Dashboard com saldo, entradas, saídas, resumo de gastos e gráficos.
- Caixa de supermercado com carrinho, quantidades, subtotais e preço unitário.
- Catálogo com nome, preço, unidade e categorias com ícones.
- Listas salvas sem lançamento de despesa.
- Compra finalizada só altera o saldo quando a opção de lançar no controle financeiro estiver marcada.
- Relatório de compra com data, horário, produtos, preço unitário, quantidade, subtotal e total.
- Exportação do comprovante de compra para PDF e opção de impressão.

### Importação de produtos CSV / JSON
Na área **Produtos**, selecione um arquivo `.csv` ou `.json`. O sistema valida os registros antes de importar e apresenta uma confirmação com a quantidade de produtos válidos e linhas ignoradas.

O importador atualiza pelo nome normalizado: se o produto já existir, preço, categoria e unidade são atualizados; caso contrário, um novo registro é criado. Isso reduz duplicatas.

Modelo CSV:

```csv
nome;preco;categoria;unidade
Arroz 5 kg;25,90;comida;pacote
Detergente;2,99;limpeza;un
```

Modelo JSON:

```json
[
  { "name": "Arroz 5 kg", "price": 25.90, "category": "comida", "unit": "pacote" },
  { "name": "Detergente", "price": 2.99, "category": "limpeza", "unit": "un" }
]
```

Há botões na tela de Produtos para baixar modelos CSV e JSON. O limite é de 5.000 linhas por importação. Linhas com nome ausente ou preço inválido são ignoradas e contabilizadas.

### Financeiro, calendário e relatórios
- Cadastro, edição e exclusão de entradas e despesas.
- Calendário mensal com consulta de lançamentos por dia.
- Relatórios por dia, semana, mês e ano.
- Despesas agrupadas por categoria.
- Exportação do relatório financeiro para CSV e PDF.
- As compras não vinculadas ao financeiro permanecem separadas das despesas que alteram o saldo.

### Cofre local de credenciais
- Cadastro de serviço, e-mail/usuário, senha da conta, código de recuperação, chave 2FA e observações.
- Os campos sensíveis aparecem mascarados na interface.
- Os dados são armazenados sem criptografia no perfil do navegador. Não utilize o cofre para senhas bancárias ou credenciais de alto impacto.

### Configurações e backups
- E-mail de referência local.
- Backup e restauração em JSON.
- Limpeza dos dados operacionais, preservando o cofre de credenciais.
- Migração opcional de dados criptografados existentes das versões anteriores.

## 3. Dados de versões anteriores

Os dados criptografados de versões anteriores não são apagados automaticamente. Caso existam, abra **Configurações → Recuperar dados da versão anterior**. Essa etapa é opcional e não ativa um login. Informe a senha antiga para descriptografar e copiar os dados para o armazenamento local sem senha. Faça um backup atual antes da migração.

Uma senha incorreta não altera os registros antigos. Os registros originais permanecem preservados mesmo após a cópia.

## 4. Segurança e armazenamento

Para abrir diretamente, os dados novos são armazenados sem criptografia no `localStorage`. Qualquer pessoa com acesso ao mesmo perfil do navegador ou às ferramentas de desenvolvedor pode ler, copiar, modificar ou apagar os dados. Um script malicioso executado na mesma origem também pode acessá-los. Os campos mascarados do cofre são apenas uma proteção visual.

Para reduzir riscos:
- Proteja a conta do sistema operacional e bloqueie o computador ao se afastar.
- Evite extensões desconhecidas e mantenha navegador e sistema operacional atualizados.
- Não use o cofre local para senhas bancárias, tokens de produção ou informações altamente sensíveis.
- Exporte backups periodicamente e guarde-os em local protegido.

O aplicativo não envia dados a um servidor remoto. A persistência depende do armazenamento do navegador: limpar os dados do site, trocar de navegador, mudar o perfil ou mudar a porta de execução pode fazer os registros parecerem ausentes. O backup JSON contém dados legíveis e deve ser tratado como arquivo confidencial.

## 5. Estrutura do projeto

```text
mercado-financas-app/
├── assets/
│   └── icon.svg
├── src/
│   ├── boot.js                     # Captura falhas de inicialização
│   ├── recover-cache.js            # Remove cache antigo sem apagar dados locais
│   ├── app.js                      # Ponto de entrada e Service Worker
│   ├── controllers/
│   │   └── app-controller.js       # Orquestra a interface e navegação
│   ├── core/
│   │   ├── config.js
│   │   ├── local-db.js
│   │   └── utils.js
│   ├── models/
│   │   └── default-data.js
│   ├── security/
│   │   └── crypto.js               # Usado na migração de dados antigos
│   ├── services/
│   │   ├── finance-service.js
│   │   ├── shopping-service.js
│   │   ├── product-import-service.js
│   │   ├── pdf-service.js
│   │   └── report-service.js
│   └── views/
│       └── templates.js
├── tests/
│   ├── smoke.test.mjs
│   ├── ui.test.mjs
│   └── recovery.test.mjs
├── index.html
├── styles.css
├── sw.js
├── manifest.webmanifest
└── atualizar-cache.html
├── iniciar_servidor.py
├── iniciar_windows.bat
├── package.json
└── README.md
```

A separação segue MVC: `models` define a estrutura dos dados, `views` gera a interface, `controllers` coordena as interações e `services` concentra regras de negócio, relatórios e importação. `core` contém configuração, utilitários e persistência.

## 6. Testes

Com Node.js instalado, execute na pasta do projeto:

```bash
npm test
```

A suíte valida inicialização do controlador, renderização das oito telas, navegação sem o botão móvel, persistência, proteção contra JSON local corrompido, carrinho, lançamentos financeiros, importação CSV/JSON, backup, geração de PDF e limpeza seletiva do cache antigo.
