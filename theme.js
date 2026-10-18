/*! KodNaqi Theme Manager - 6 Themes */
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
  }

  function initTheme() {
    const saved = localStorage.getItem('kodnaqi_color_theme') || 'navy';
    applyTheme(saved);
    setTimeout(injectSettingsUI, 1500); // انتظر حتى تحمل الإعدادات
  }

  function injectSettingsUI() {
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage || document.getElementById('theme-selector-ui')) return;

    let html = `
      <div class="card p-3 mb-3" id="theme-selector-ui" style="border-radius: 12px;">
        <details>
          <summary style="cursor:pointer; font-weight:bold; color:#0d3b66; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="bi bi-palette-fill"></i> مظهر التطبيق (الثيم)</span>
            <i class="bi bi-chevron-down" style="font-size:0.8rem;"></i>
          </summary>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
    `;

    for (const [key, data] of Object.entries(THEMES)) {
      const isActive = document.documentElement.getAttribute('data-theme') === key;
      html += `
        <div onclick="window.KNTheme.set('${key}')" style="cursor:pointer; text-align:center; padding:8px; border-radius:8px; border:2px solid ${isActive ? data.primary : 'transparent'}; background:${isActive ? '#f8fafc' : 'transparent'}; transition: all 0.2s;">
          <div style="width: 32px; height: 32px; border-radius: 50%; margin: 0 auto 6px; background: linear-gradient(135deg, ${data.primary}, ${data.secondary}); border: 2px solid ${data.accent}; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"></div>
          <div style="font-size: 0.75rem; font-weight: bold; color: #334155;">${data.name}</div>
        </div>
      `;
    }

    html += `</div></details></div>`;
    
    settingsPage.insertAdjacentHTML('afterbegin', html);
  }

  window.KNTheme = {
    set: function(key) {
      applyTheme(key);
      // تحديث واجهة المستخدم لتوضيح الثيم المختار
      const ui = document.getElementById('theme-selector-ui');
      if (ui) {
        ui.remove();
        injectSettingsUI();
      }
      if (typeof toast === 'function') toast('🎨 تم تغيير مظهر التطبيق');
    },
    init: initTheme
  };

  document.addEventListener('DOMContentLoaded', initTheme);
})();
