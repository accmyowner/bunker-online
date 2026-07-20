/**
 * toast.js — короткие уведомления.
 * Подписан на шину, поэтому любой модуль может сказать
 * emit(EV.TOAST, { text, kind }) и не знать про DOM.
 */
import { el, afterAnimation } from '../../core/dom.js';
import { on, EV } from '../../core/bus.js';
import { icon } from './icons.js';
import { play } from '../../audio/sfx.js';

let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = el('div.toast-root', { 'aria-live': 'polite' });
  document.body.append(root);
  return root;
}

const ICON_BY_KIND = { ok: 'check', err: 'alert', info: 'info' };

export function toast(text, kind = 'info', ms = 3200) {
  const host = ensureRoot();
  const node = el(`div.toast.toast--${kind}`, null, [
    el('span.toast__icon', { html: icon(ICON_BY_KIND[kind] || 'info') }),
    el('span', { text })
  ]);
  host.append(node);

  if (kind === 'err') play('error');

  setTimeout(async () => {
    node.classList.add('toast--out');
    await afterAnimation(node, 320);
    node.remove();
  }, ms);

  return node;
}

/** Подключает уведомления к шине событий. Вызывается один раз. */
export function initToasts() {
  on(EV.TOAST, (payload) => {
    if (typeof payload === 'string') toast(payload);
    else toast(payload.text, payload.kind, payload.ms);
  });
}
