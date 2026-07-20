/**
 * background.js — оживляет фоновые слои.
 *
 * Разметка слоёв лежит в index.html, стили — в background.css.
 * Этот модуль делает две вещи: вставляет SVG гермодвери и
 * рождает частицы пыли и искр. Частицы создаются один раз,
 * дальше их двигает исключительно CSS — JS в кадре не участвует,
 * поэтому анимация не мешает основному потоку.
 */

/** Гермодверь. Один SVG, вся детализация — на градиентах и штрихах. */
function doorSvg() {
  return `
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="doorPlate" cx="50%" cy="42%" r="62%">
      <stop offset="0%"   stop-color="#2b3340"/>
      <stop offset="55%"  stop-color="#1a1f28"/>
      <stop offset="100%" stop-color="#0d1016"/>
    </radialGradient>
    <linearGradient id="doorRim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#3d4757"/>
      <stop offset="50%"  stop-color="#232a35"/>
      <stop offset="100%" stop-color="#141922"/>
    </linearGradient>
    <linearGradient id="seamGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#f2650a" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#ffb347" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#f2650a" stop-opacity="0"/>
    </linearGradient>
    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Рама, утопленная в бетон -->
  <rect x="70" y="70" width="860" height="860" rx="60" fill="url(#doorRim)" opacity=".85"/>
  <rect x="70" y="70" width="860" height="860" rx="60" fill="none"
        stroke="#454f60" stroke-width="2" opacity=".5"/>

  <!-- Заклёпки по периметру рамы -->
  <g fill="#4a5566" opacity=".75">
    ${Array.from({ length: 28 }, (_, i) => {
      const step = i / 28 * Math.PI * 2;
      const x = 500 + Math.cos(step) * 415;
      const y = 500 + Math.sin(step) * 415;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`;
    }).join('')}
  </g>

  <!-- Основная плита -->
  <circle cx="500" cy="500" r="380" fill="url(#doorPlate)"/>
  <circle cx="500" cy="500" r="380" fill="none" stroke="#4c5768" stroke-width="3" opacity=".6"/>
  <circle cx="500" cy="500" r="342" fill="none" stroke="#2c3441" stroke-width="14" opacity=".8"/>

  <!-- Вертикальный шов: сюда бьёт свет аварийной лампы -->
  <rect class="door-seam" x="496" y="120" width="8" height="760"
        fill="url(#seamGlow)" filter="url(#softGlow)"/>

  <!-- Вращающееся запорное кольцо -->
  <g class="door-ring">
    <circle cx="500" cy="500" r="250" fill="none" stroke="#3a4453" stroke-width="26"/>
    <circle cx="500" cy="500" r="250" fill="none" stroke="#525e70" stroke-width="2" opacity=".7"/>
    ${Array.from({ length: 8 }, (_, i) => {
      const angle = i / 8 * Math.PI * 2;
      const x1 = 500 + Math.cos(angle) * 224;
      const y1 = 500 + Math.sin(angle) * 224;
      const x2 = 500 + Math.cos(angle) * 276;
      const y2 = 500 + Math.sin(angle) * 276;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
                    x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                    stroke="#5d6a7d" stroke-width="9" stroke-linecap="round" opacity=".85"/>`;
    }).join('')}
    <!-- Спицы штурвала -->
    ${Array.from({ length: 5 }, (_, i) => {
      const angle = i / 5 * Math.PI * 2;
      const x = 500 + Math.cos(angle) * 210;
      const y = 500 + Math.sin(angle) * 210;
      return `<line x1="500" y1="500" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
                    stroke="#39424f" stroke-width="16" stroke-linecap="round"/>`;
    }).join('')}
    <circle cx="500" cy="500" r="52" fill="#232a35" stroke="#5d6a7d" stroke-width="4"/>
    <circle cx="500" cy="500" r="20" fill="#161b23"/>
  </g>

  <!-- Смотровое окно и предупреждающая маркировка -->
  <circle cx="500" cy="248" r="34" fill="#0a0d13" stroke="#4c5768" stroke-width="4"/>
  <circle cx="500" cy="248" r="20" fill="#ff3b30" opacity=".18"/>
  <g opacity=".35" fill="none" stroke="#ffb347" stroke-width="4">
    <path d="M420 760h160M440 792h120"/>
  </g>
</svg>`;
}

/** Создаёт частицы пыли: медленный подъём в луче света */
function spawnMotes(host, count) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const mote = document.createElement('i');
    mote.className = 'mote';
    const size = 1 + Math.random() * 2.6;

    mote.style.width = `${size}px`;
    mote.style.height = `${size}px`;
    mote.style.left = `${Math.random() * 100}%`;
    mote.style.top = `${70 + Math.random() * 40}%`;
    mote.style.setProperty('--mote-dx', `${(Math.random() - 0.5) * 14}vw`);
    mote.style.setProperty('--mote-peak', (0.25 + Math.random() * 0.5).toFixed(2));
    mote.style.animationDuration = `${16 + Math.random() * 22}s`;
    mote.style.animationDelay = `${-Math.random() * 30}s`;

    fragment.append(mote);
  }
  host.append(fragment);
}

/** Создаёт искры: редкие быстрые росчерки от повреждённой проводки */
function spawnSparks(host, count) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement('i');
    spark.className = 'spark';

    spark.style.left = `${10 + Math.random() * 80}%`;
    spark.style.top = `${-5 - Math.random() * 10}%`;
    spark.style.height = `${8 + Math.random() * 14}px`;
    spark.style.setProperty('--spark-dx', `${(Math.random() - 0.5) * 22}vw`);
    spark.style.animationDuration = `${1.6 + Math.random() * 2.2}s`;
    spark.style.animationDelay = `${-Math.random() * 26}s`;

    fragment.append(spark);
  }
  host.append(fragment);
}

/**
 * Оценивает устройство. На слабых машинах включаем экономный режим:
 * меньше частиц, часть слоёв гасится через body.perf-lite.
 */
function isWeakDevice() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  return cores <= 4 || memory <= 4 || (narrow && cores <= 6);
}

/** Точка входа: вызывается один раз при старте приложения */
export function initBackground(root = document) {
  const door = root.querySelector('.bg__door');
  const dust = root.querySelector('.bg__dust');
  if (!door || !dust) return;

  const weak = isWeakDevice();
  if (weak) document.body.classList.add('perf-lite');

  door.innerHTML = doorSvg();

  // На экономном профиле слой пыли скрыт стилями — не тратим на него DOM
  if (!weak) {
    spawnMotes(dust, 44);
    spawnSparks(dust, 7);
  }

  // Когда вкладка не видна, останавливаем всё: браузер сам душит rAF,
  // но CSS-анимации продолжают жечь батарею
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('bg-paused', document.hidden);
  });
}
