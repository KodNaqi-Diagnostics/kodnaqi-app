(function() {
  'use strict';
  const THEMES = {
    navy:     { name: 'كحلي رسمي', primary: '#0d3b66', secondary: '#1e6091', accent: '#c9a227' },
    emerald:  { name: 'زمردي صحي', primary: '#064e3b', secondary: '#047857', accent: '#fbbf24' },
    purple:   { name: 'بنفسجي ملكي', primary: '#4c1d95', secondary: '#6d28d9', accent: '#fcd34d' },
    crimson:  { name: 'قرمزي طبي', primary: '#7f1d1d', secondary: '#b91c1c', accent: '#fde047' },
    teal:     { name: 'أزرق مخضر', primary: '#134e4a', secondary: '#0f766e', accent: '#fcd34d' },
    midnight: { name: 'ليلي داكن', primary: '#0f172a', secondary: '#1e293b', accent: '#38bdf8' }
  };

  function applyTheme(themeKey) {
    if (!THEMES[themeKey]) themeKey = 'navy';
    document.documentElement.setAttribute('data-theme', themeKey);
    localStorage.setItem('kodnaqi_color_theme', themeKey);
    
    document.querySelectorAll('.theme-option').forEach(function(el) {
      const isActive = el.dataset.theme === themeKey;
      el.style.borderColor = isActive ? THEMES[themeKey].primary : 'transparent';
      el.style.background = isActive ? '#f8fafc' : 'transparent';
    });
  }

  window.KNTheme = {
    set: function(key) {
      applyTheme(key);
      if (typeof toast === 'function') toast('🎨 تم تغيير مظهر التطبيق');
    },
    init: function() {
      const saved = localStorage.getItem('kodnaqi_color_theme') || 'navy';
      applyTheme(saved);
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.KNTheme.init, 500);
  });
})();
