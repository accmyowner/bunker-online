/**
 * settings.js — настройки клиента.
 * Всё хранится на устройстве и применяется мгновенно.
 */
import { el } from '../../core/dom.js';
import { emit, EV } from '../../core/bus.js';
import { backButton } from '../router.js';
import { icon } from '../components/icons.js';
import * as storage from '../../core/storage.js';
import { isEnabled, setEnabled, play } from '../../audio/sfx.js';
import { isConfigured } from '../../net/config.js';
import * as room from '../../net/room.js';

/** Строка настройки с переключателем */
function toggleRow({ name, desc, value, onChange }) {
  const control = el('button.switch', {
    role: 'switch',
    'aria-checked': String(value),
    'aria-label': name,
    'data-silent': true
  });

  control.addEventListener('click', () => {
    const next = control.getAttribute('aria-checked') !== 'true';
    control.setAttribute('aria-checked', String(next));
    onChange(next);
  });

  return el('div.setting', null, [
    el('div.setting__text', null, [
      el('div.setting__name', { text: name }),
      el('div.setting__desc', { text: desc })
    ]),
    control
  ]);
}

export function settingsScreen() {
  const motionOff = storage.get('reduceMotion', false);
  const liteMode = storage.get('perfLite', document.body.classList.contains('perf-lite'));

  const panel = el('div.panel', { style: { padding: 'var(--s-6)' } }, [
    el('div.eyebrow', { text: 'Клиент' }),

    toggleRow({
      name: 'Звуки интерфейса',
      desc: 'Короткие отклики на нажатия, раскрытие карт и голосование. Музыки в игре нет.',
      value: isEnabled(),
      onChange: (next) => { setEnabled(next); if (next) play('confirm'); }
    }),

    toggleRow({
      name: 'Уменьшить анимацию',
      desc: 'Отключает переходы и движение фона. Полезно при укачивании и на слабых устройствах.',
      value: motionOff,
      onChange: (next) => {
        storage.set('reduceMotion', next);
        document.body.classList.toggle('no-motion', next);
      }
    }),

    toggleRow({
      name: 'Экономный режим фона',
      desc: 'Убирает пыль, искры и часть свечения. Заметно экономит батарею телефона.',
      value: liteMode,
      onChange: (next) => {
        storage.set('perfLite', next);
        document.body.classList.toggle('perf-lite', next);
      }
    }),

    el('hr.seam'),
    el('div.eyebrow', { text: 'Подключение' }),

    el('div.setting', null, [
      el('div.setting__text', null, [
        el('div.setting__name', { text: isConfigured() ? 'Firebase подключён' : 'Локальный режим' }),
        el('div.setting__desc', {
          text: isConfigured()
            ? 'Комнаты работают между устройствами и сетями.'
            : 'Комнаты живут только между вкладками этого браузера. ' +
              'Чтобы играть по сети, заполните src/net/config.js данными своего проекта Firebase.'
        })
      ]),
      el('span', { class: `badge ${isConfigured() ? 'badge--cyan' : ''}`, text: room.mode() })
    ]),

    el('div.setting', null, [
      el('div.setting__text', null, [
        el('div.setting__name', { text: 'Ваш идентификатор' }),
        el('div.setting__desc', {
          text: 'Хранится на устройстве. Именно он позволяет вернуться в комнату после перезагрузки.'
        })
      ]),
      el('span.badge.mono', { text: room.identity().id.slice(0, 10) })
    ]),

    el('hr.seam'),
    el('button.btn.btn--sm.btn--danger', {
      onClick: () => {
        storage.remove('lastRoom');
        emit(EV.TOAST, { text: 'Данные сброшены', kind: 'ok' });
      }
    }, [el('span.btn__icon', { html: icon('refresh') }), 'Забыть последнюю комнату'])
  ]);

  return el('div', { style: { display: 'grid', gap: 'var(--s-4)' } }, [
    el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)' } }, [
      backButton('menu', 'В меню'),
      el('span.badge.badge--amber', null, [el('span', { html: icon('gear') }), 'Настройки'])
    ]),
    panel
  ]);
}
