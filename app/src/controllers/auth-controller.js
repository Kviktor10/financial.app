import { APP_CONFIG } from '../core/config.js';
import { CryptoService } from '../security/crypto.js';
import { LocalDatabase } from '../core/local-db.js';

export class AuthController {
  constructor(onUnlocked) {
    this.onUnlocked = onUnlocked;
    this.screen = document.querySelector('#authScreen');
    this.title = document.querySelector('#authTitle');
    this.subtitle = document.querySelector('#authSubtitle');
    this.form = document.querySelector('#authForm');
    this.message = document.querySelector('#authMessage');
    this.form.addEventListener('submit', event => this.handleSubmit(event));
  }

  async initialize() {
    if (!CryptoService.isAvailable()) {
      this.title.textContent = 'Criptografia indisponível';
      this.subtitle.textContent = 'Abra o aplicativo em um navegador atualizado usando localhost ou HTTPS.';
      this.form.innerHTML = '<p class="auth-error">A Web Crypto API não está disponível neste contexto. Os dados não serão gravados sem criptografia.</p>';
      return;
    }
    if (LocalDatabase.hasAuth()) this.showUnlock();
    else this.showSetup();
  }

  showSetup() {
    this.title.textContent = 'Crie sua senha-mestra';
    this.subtitle.textContent = 'Esta senha protege o aplicativo e o cofre de credenciais. Ela não será armazenada.';
    this.message.textContent = '';
    this.form.dataset.mode = 'setup';
    this.form.innerHTML = `
      <label class="auth-field">E-mail de referência <span>(opcional)</span><input name="email" type="email" maxlength="150" autocomplete="email" placeholder="seuemail@exemplo.com"></label>
      <label class="auth-field">Senha-mestra<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="Mínimo de 12 caracteres"></label>
      <label class="auth-field">Confirmar senha-mestra<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label>
      <div class="password-guidance">Use uma frase longa e exclusiva, com letras maiúsculas, minúsculas e números. Não reutilize a senha de outros serviços.</div>
      <label class="auth-field">Código mestre para exclusões<input name="masterCode" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Mínimo de 8 caracteres"></label>
      <label class="auth-field">Confirmar código mestre<input name="confirmMasterCode" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label>
      <button class="button primary full auth-submit" type="submit">Criar ambiente protegido</button>
      <p class="auth-warning">Guarde a senha-mestra e o código mestre em local seguro. Sem a senha-mestra, os dados cifrados não podem ser recuperados.</p>`;
  }

  showUnlock() {
    this.title.textContent = 'Acesse seu aplicativo';
    this.subtitle.textContent = 'Digite sua senha-mestra para descriptografar os dados deste dispositivo.';
    this.message.textContent = '';
    this.form.dataset.mode = 'unlock';
    this.form.innerHTML = `
      <label class="auth-field">Senha-mestra<input name="password" type="password" maxlength="128" autocomplete="current-password" required autofocus placeholder="Sua senha-mestra"></label>
      <button class="button primary full auth-submit" type="submit">Desbloquear</button>
      <p class="auth-warning">A senha não é enviada para nenhum servidor. Caso seja perdida, somente um backup acompanhado da senha original poderá ser aberto.</p>`;
  }

  async handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(this.form);
    const mode = this.form.dataset.mode;
    this.setBusy(true);
    this.message.textContent = '';
    try {
      if (mode === 'setup') await this.setup(formData);
      else await this.unlock(formData);
    } catch (error) {
      this.message.textContent = error?.message || 'Não foi possível concluir a operação.';
      this.message.className = 'form-message error';
    } finally {
      this.setBusy(false);
    }
  }

  async setup(formData) {
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const masterCode = String(formData.get('masterCode') || '');
    const confirmMasterCode = String(formData.get('confirmMasterCode') || '');
    const passwordError = CryptoService.validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    if (password !== confirmPassword) throw new Error('A confirmação da senha-mestra não corresponde.');
    const codeError = CryptoService.validateMasterCode(masterCode);
    if (codeError) throw new Error(codeError);
    if (masterCode !== confirmMasterCode) throw new Error('A confirmação do código mestre não corresponde.');
    if (password === masterCode) throw new Error('A senha-mestra e o código mestre precisam ser diferentes.');

    const session = await LocalDatabase.create(password, masterCode);
    session.appData.settings.email = String(formData.get('email') || '').trim();
    const { LocalDatabase: DB } = await import('../core/local-db.js');
    await DB.saveApp(session.appData, session.keys.appKey);
    this.screen.classList.add('hidden');
    this.onUnlocked(session);
  }

  async unlock(formData) {
    const password = String(formData.get('password') || '');
    if (!password) throw new Error('Informe a senha-mestra.');
    const auth = LocalDatabase.getAuth();
    let keys;
    try {
      keys = await CryptoService.unlock(password, auth);
    } catch {
      throw new Error('Senha incorreta ou dados criptografados inválidos.');
    }
    const loaded = await LocalDatabase.load(keys);
    this.screen.classList.add('hidden');
    this.onUnlocked({ auth, keys, ...loaded });
  }

  setBusy(busy) {
    const button = this.form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? 'Processando...' : (this.form.dataset.mode === 'setup' ? 'Criar ambiente protegido' : 'Desbloquear');
    }
    this.form.classList.toggle('is-busy', busy);
  }
}
