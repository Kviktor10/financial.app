import { LocalDatabase } from './core/local-db.js?v=1.4.0';
import { AppController } from './controllers/app-controller.js?v=1.4.0';

/** Inicializa a aplicação depois que o documento e seus elementos existem. */
export async function startApp() {
  const session = await LocalDatabase.initialize();
  const controller = new AppController(session);

  // O registro do Service Worker é complementar: uma falha não deve impedir o uso do app.
  if (
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ) {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => registration.update().catch(() => undefined))
      .catch(error => console.warn('Service Worker indisponível; o app continuará funcionando.', error));
  }

  return controller;
}
