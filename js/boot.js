// Грузится в <head> до отрисовки: отдельный файл, а не встроенный скрипт, — так требует CSP сервера.
document.documentElement.classList.add('js');

// страховка: если main.js не запустится, через 4 секунды покажем обычные списки
setTimeout(() => {
  const root = document.documentElement;
  if (!root.classList.contains('xmb-on')) root.classList.add('xmb-failed');
}, 4000);
