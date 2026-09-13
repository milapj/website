import * as Phaser from 'phaser';
import { OWNER_EMAIL, WELL_ENDPOINT } from '../content';

/**
 * The Well of Sending: a small HTML form (in index.html) that collects a
 * name, an email and a message. If WELL_ENDPOINT is set it is POSTed there
 * (a form-to-email service such as Formspree); otherwise it falls back to
 * opening the visitor's mail client with a pre-filled letter.
 */
export class WellForm {
  private readonly scene: Phaser.Scene;
  private readonly form: HTMLFormElement | null;
  private readonly status: HTMLElement | null;
  private onClose?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.form = document.getElementById('well-form') as HTMLFormElement | null;
    this.status = document.getElementById('well-status');
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    document.getElementById('well-cancel')?.addEventListener('click', () => this.close());
    this.form?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      e.stopPropagation();
    });
  }

  get isOpen(): boolean {
    return Boolean(this.form && !this.form.hidden);
  }

  open(onClose?: () => void): void {
    if (!this.form) return;
    this.onClose = onClose;
    this.setStatus('');
    this.form.hidden = false;
    this.setGameKeys(false);
    (this.form.querySelector('input[name="name"]') as HTMLInputElement | null)?.focus();
  }

  close(): void {
    if (!this.form || this.form.hidden) return;
    this.form.hidden = true;
    this.setGameKeys(true);
    const cb = this.onClose;
    this.onClose = undefined;
    cb?.();
  }

  private async submit(): Promise<void> {
    if (!this.form) return;
    const data = new FormData(this.form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const honeypot = String(data.get('_gotcha') ?? '');
    if (honeypot) {
      this.setStatus('The well is still.');
      return;
    }
    if (!WELL_ENDPOINT) {
      const subject = encodeURIComponent(`Word from the Well of Sending: ${name}`);
      const body = encodeURIComponent(`${message || '(no message)'}\n\nFrom: ${name} <${email}>`);
      window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`, '_blank', 'noopener');
      this.setStatus('Your letter is opening in your mail app. Send it, and Milap shall read it.');
      return;
    }
    this.setStatus('The water stirs...');
    try {
      const res = await fetch(WELL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message, _gotcha: honeypot, _subject: `Word from the Well of Sending: ${name}` }),
      });
      if (!res.ok) throw new Error(String(res.status));
      this.setStatus('Your words have been cast into the well. Milap shall hear them.');
      this.form.reset();
      window.setTimeout(() => this.close(), 2200);
    } catch {
      this.setStatus(`The well is silent tonight. Write instead to ${OWNER_EMAIL}.`);
    }
  }

  private setStatus(text: string): void {
    if (this.status) this.status.textContent = text;
  }

  /** Stop the game from swallowing SPACE / arrows while typing in the form. */
  private setGameKeys(on: boolean): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    kb.enabled = on;
    kb.manager.enabled = on;
  }
}
