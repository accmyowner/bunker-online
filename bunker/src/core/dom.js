/**
 * dom.js — тонкий слой над DOM.
 * Никаких зависимостей. Используется всеми компонентами.
 */

/** Создаёт элемент: el('div.panel', { id: 'x' }, [child, 'текст']) */
export function el(spec, props = null, children = null) {
  const [tagPart, ...classParts] = String(spec).split('.');
  const node = document.createElement(tagPart || 'div');
  if (classParts.length) node.className = classParts.join(' ');

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className += (node.className ? ' ' : '') + value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key in node && key !== 'list' && typeof value !== 'object') {
        try { node[key] = value; } catch { node.setAttribute(key, value); }
      } else {
        node.setAttribute(key, value === true ? '' : value);
      }
    }
  }

  appendAll(node, children);
  return node;
}

/** Добавляет детей любого вида: строки, узлы, массивы, null */
export function appendAll(parent, children) {
  if (children === null || children === undefined || children === false) return parent;
  if (Array.isArray(children)) {
    for (const child of children) appendAll(parent, child);
    return parent;
  }
  parent.append(children instanceof Node ? children : document.createTextNode(String(children)));
  return parent;
}

export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Очищает узел без утечек */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Подписка с автоотпиской: const off = on(btn, 'click', fn) */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Проставляет --i для каскадных анимаций */
export function stagger(node) {
  Array.from(node.children).forEach((child, index) => {
    child.style.setProperty('--i', index);
  });
  return node;
}

/** Ждёт окончания анимации (или таймаут — на случай reduced motion) */
export function afterAnimation(node, fallbackMs = 600) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    node.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, fallbackMs);
  });
}

/** Экранирование для мест, где всё же нужен innerHTML */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
