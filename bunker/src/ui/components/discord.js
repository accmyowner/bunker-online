/**
 * discord.js — значок Discord в углу экрана.
 *
 * Компонент самодостаточен: сам монтируется в body, сам убирает
 * за собой. Экран получает функцию снятия и вызывает её в cleanup,
 * поэтому значок живёт ровно столько, сколько нужно тому экрану,
 * который его показал.
 *
 * Крепится к body, а не внутрь экрана, намеренно: экран во время
 * перехода анимируется через transform, а трансформированный предок
 * ломает position: fixed у потомков.
 */
import { el } from '../../core/dom.js';
import { emit, EV } from '../../core/bus.js';
import { icon } from './icons.js';

const NICK = 'nickalora';

/**
 * Копирование с запасным путём.
 * navigator.clipboard недоступен без https и в старых браузерах,
 * поэтому при отказе пробуем приём со скрытым полем.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea', {
      value: text,
      style: { position: 'fixed', top: '-1000px', opacity: '0' }
    });
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/**
 * Монтирует значок и возвращает функцию снятия.
 * mountDiscordBadge() → () => void
 */
export function mountDiscordBadge({ nick = NICK, host = document.body } = {}) {
  const tip = el('span.dsc__tip', { role: 'tooltip' }, [
    el('span.dsc__tipkey', { text: 'Discord:' }),
    ' ',
    el('span.dsc__tipval', { text: nick })
  ]);

  const badge = el('button.dsc', {
    type: 'button',
    'aria-label': `Discord: ${nick}. Нажмите, чтобы скопировать ник`,
    'data-sfx': 'confirm',
    onClick: async () => {
      const ok = await copyText(nick);
      if (ok) {
        badge.classList.add('dsc--copied');
        setTimeout(() => badge.classList.remove('dsc--copied'), 900);
        emit(EV.TOAST, { text: 'Ник Discord скопирован!', kind: 'ok' });
      } else {
        // Копирование запрещено окружением — показываем ник,
        // чтобы его можно было переписать вручную
        emit(EV.TOAST, { text: `Не удалось скопировать. Ник: ${nick}`, kind: 'err', ms: 6000 });
      }
    }
  }, [
    el('span.dsc__icon', { html: icon('discord') }),
    tip
  ]);

  host.append(badge);
  return () => badge.remove();
}
