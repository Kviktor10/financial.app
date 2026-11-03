import { AuthController } from './controllers/auth-controller.js';
import { AppController } from './controllers/app-controller.js';

let application = null;
const auth = new AuthController(session => {
  application?.dispose();
  application = new AppController(session, auth);
});

await auth.initialize();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // O aplicativo continua funcional mesmo sem registro do service worker.
    });
  });
}
