/* Recuperação de cache de versões anteriores, sem apagar o LocalStorage. */
(async function recoverApplicationCache() {
  const status = document.querySelector('#state');
  const belongsToThisApp = registration => {
    const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
    return workers.some(worker => {
      try { return new URL(worker.scriptURL).pathname.endsWith('/sw.js'); }
      catch { return false; }
    });
  };

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const ownRegistrations = registrations.filter(belongsToThisApp);
      await Promise.all(ownRegistrations.map(registration => registration.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(key => key.startsWith('mercado-financas-'))
        .map(key => caches.delete(key)));
    }

    if (status) status.textContent = 'Cache antigo removido. Abrindo a versão atual…';
    const destination = new URL('./index.html', location.href);
    destination.searchParams.set('build', '1.4.0');
    setTimeout(() => location.replace(destination.href), 250);
  } catch (error) {
    console.error('[Mercado & Finanças] Falha ao atualizar cache:', error);
    if (status) {
      status.textContent = 'Não foi possível limpar o cache automaticamente. Consulte as instruções do README.';
    }
  }
})();
