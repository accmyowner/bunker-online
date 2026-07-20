/**
 * modal.js — модальные окна.
 * На телефоне стили превращают их в шторку снизу (см. responsive.css),
 * логика при этом одна и та же.
 */
import { el, appendAll, afterAnimation, on } from '../../core/dom.js';
import { icon } from './icons.js';
import { play } from '../../audio/sfx.js';

let openModal = null;

/**
 * openModal({ title, body, actions }) → Promise<результат>
 * actions: [{ label, value, variant, primary }]
 */
export function modal({ title, body, actions = [], dismissable = true, icon: iconName = null }) {
  closeModal();

  return new Promise((resolve) => {
    const box = el('div.panel.modal__box', { role: 'dialog', 'aria-modal': 'true' });

    const head = el('div.modal__head');
    if (iconName) {
      head.append(el('span.modal__icon', { html: icon(iconName) }));
    }
    head.append(el('h2.modal__title', { text: title }));
    if (dismissable) {
      head.append(el('button.iconbtn', {
        html: icon('close'),
        'aria-label': 'Закрыть',
        'data-sfx': 'back',
        onClick: () => finish(null)
      }));
    }
    box.append(head);

    const content = el('div.modal__body');
    appendAll(content, typeof body === 'string' ? el('p', { text: body }) : body);
    box.append(content);

    if (actions.length) {
      const foot = el('div.modal__foot');
      for (const action of actions) {
        foot.append(el(`button.btn${action.variant ? '.btn--' + action.variant : ''}`, {
          text: action.label,
          'data-sfx': action.primary ? 'confirm' : 'click',
          onClick: () => finish(action.value)
        }));
      }
      box.append(foot);
    }

    const backdrop = el('div.modal__backdrop', {
      onClick: () => { if (dismissable) finish(null); }
    });

    const root = el('div.modal-root', null, [backdrop, box]);
    document.body.append(root);
    openModal = { root, finish };

    // Фокус внутрь окна — иначе клавиатура остаётся снаружи
    (box.querySelector('.btn--primary') || box.querySelector('.btn') || box).focus?.();

    const offKey = on(document, 'keydown', (event) => {
      if (event.key === 'Escape' && dismissable) finish(null);
    });

    async function finish(value) {
      if (!openModal) return;
      openModal = null;
      offKey();
      root.classList.add('modal--closing');
      await afterAnimation(box, 320);
      root.remove();
      resolve(value);
    }
  });
}

export function closeModal() {
  if (openModal) openModal.finish(null);
}

/** Готовое окно подтверждения */
export function confirm({ title, text, ok = 'Подтвердить', cancel = 'Отмена', danger = false }) {
  return modal({
    title,
    body: text,
    icon: danger ? 'alert' : 'info',
    actions: [
      { label: cancel, value: false },
      { label: ok, value: true, variant: danger ? 'danger' : 'primary', primary: true }
    ]
  });
}

/** Окно с одним полем ввода */
export function prompt({ title, label, value = '', placeholder = '', ok = 'Готово', maxLength = 20 }) {
  const input = el('input.input', { value, placeholder, maxLength, autocomplete: 'off' });
  const field = el('div.field', null, [
    label ? el('label.field__label', { text: label }) : null,
    input
  ]);

  const result = modal({
    title,
    body: field,
    actions: [
      { label: 'Отмена', value: null },
      { label: ok, value: '__ok__', variant: 'primary', primary: true }
    ]
  });

  setTimeout(() => { input.focus(); input.select(); }, 80);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      play('confirm');
      openModal?.finish('__ok__');
    }
  });

  return result.then((value) => (value === '__ok__' ? input.value.trim() : null));
}
