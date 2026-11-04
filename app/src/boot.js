/* Inicializador clássico v1.4.0: captura falhas de carregamento dos módulos ES. */
const MARKET_APP_BUILD = '1.4.0';
(() => {
  const root = document.querySelector('#viewRoot');

  function showStartupError(error, hint = '') {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido.');
    console.error('[Mercado & Finanças] Falha na inicialização:', error);

    if (!root) return;
    root.innerHTML = `
      <section class="boot-error" role="alert" aria-live="assertive">
        <div class="boot-error-icon">!</div>
        <span class="eyebrow">FALHA AO INICIAR</span>
        <h2>Não foi possível carregar o aplicativo</h2>
        <p>O aplicativo não apagou seus dados. A causa provável está na inicialização, no armazenamento local ou no modo de abertura.</p>
        <div class="boot-error-detail"></div>
        <p class="boot-error-hint"></p>
        <div class="boot-error-actions">
          <button class="button primary" id="retryBoot" type="button">Tentar novamente</button>
          <button class="button outline" id="copyBootError" type="button">Copiar detalhes do erro</button>
        </div>
        <small>Se o problema persistir, envie os detalhes do erro para análise. Não limpe os dados do navegador antes de fazer um backup.</small>
      </section>`;

    root.querySelector('.boot-error-detail').textContent = message;
    root.querySelector('.boot-error-hint').textContent = hint;
    root.querySelector('#retryBoot')?.addEventListener('click', () => location.reload());
    root.querySelector('#copyBootError')?.addEventListener('click', async () => {
      const text = `Mercado & Finanças - erro de inicialização\n${message}\n${hint}`;
      try {
        await navigator.clipboard.writeText(text);
        root.querySelector('#copyBootError').textContent = 'Detalhes copiados';
      } catch {
        root.querySelector('.boot-error-detail').textContent = `${message}\n${hint}`;
      }
    });
  }

  window.addEventListener('error', event => {
    if (event.error) showStartupError(event.error);
  });
  window.addEventListener('unhandledrejection', event => showStartupError(event.reason));

  if (location.protocol === 'file:') {
    showStartupError(
      new Error('O navegador abriu o arquivo diretamente (file://).'),
      'Não abra index.html com duplo clique. No Windows, execute iniciar_windows.bat para abrir o aplicativo em http://localhost:8000.'
    );
    return;
  }

  import('./app.js?v=1.4.0')
    .then(({ startApp }) => startApp())
    .catch(error => showStartupError(
      error,
      'Verifique se todos os arquivos da pasta foram extraídos. Depois, execute iniciar_windows.bat e atualize a página com Ctrl + F5.'
    ));
})();
