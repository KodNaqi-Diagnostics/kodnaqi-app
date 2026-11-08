/*! KodNaqi PWA — نظام الترخيص v2 (ECDSA P-256) */
(function() {
  'use strict';

  const STORAGE_KEY = 'kodnaqi_license';
  const TRIAL_KEY   = 'kodnaqi_trial_start';
  const TRIAL_DAYS  = 14;
  const WARN_DAYS   = 30;

  const TIER_FEATURES = {
    TRIAL: ['finance', 'cloud', 'jsonIO', 'users'],
    B:     ['finance'],
    S:     ['finance', 'cloud', 'jsonIO', 'users'],
    A:     ['finance', 'cloud', 'jsonIO', 'users', 'advReports', 'roles', 'audit', 'whiteLabel'],
    E:     ['finance', 'cloud', 'jsonIO', 'users', 'advReports', 'roles', 'audit', 'whiteLabel']
  };

  const TIER_LIMITS = {
    TRIAL: { devices: 1, users: 1, supportMonths: 2 },
    B:     { devices: 1, users: 1, supportMonths: 6 },
    S:     { devices: 3, users: 5, supportMonths: 12 },
    A:     { devices: Infinity, users: Infinity, supportMonths: 24 },
    E:     { devices: Infinity, users: Infinity, supportMonths: 36 }
  };

  function getTierLimits(tier) {
    return TIER_LIMITS[tier] || { devices: 0, users: 0, supportMonths: 0 };
  }

  const TIER_NAMES = {
    TRIAL: 'تجريبية',
    B: 'أساسية',
    S: 'قياسية',
    A: 'متقدمة',
    E: 'مؤسسية'
  };

  const RENEWAL_REMIND_DAYS = 30;
  const RENEWAL_SHOWN_KEY = 'kodnaqi_renewal_shown';

  async function checkRenewalReminder() {
    const st = await getLicenseStatus();
    if (st.status !== 'valid' || !st.payload || !st.payload.expires) return;
    const daysLeft = Math.ceil((st.payload.expires - Date.now()) / 86400000);
    if (daysLeft <= RENEWAL_REMIND_DAYS && daysLeft > 0) {
      const today = new Date().toDateString();
      const lastShown = localStorage.getItem(RENEWAL_SHOWN_KEY);
      if (lastShown === today) return;
      showRenewalDialog(daysLeft, st.payload);
      localStorage.setItem(RENEWAL_SHOWN_KEY, today);
    }
  }

  function showRenewalDialog(daysLeft, payload) {
    const old = document.getElementById('kodnaqi-renewal-dialog');
    if (old) old.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'kodnaqi-renewal-dialog';
    wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:2147483646;padding:16px;direction:rtl;';
    const urgency = daysLeft <= 7 ? '#dc2626' : (daysLeft <= 14 ? '#f59e0b' : '#0d3b66');
    const message = daysLeft <= 7 ? '⚠️ اشتراكك على وشك الانتهاء!' : '⏰ تذكير بتجديد الاشتراك';
    wrapper.innerHTML = ''
      + '<div style="background:#fff;border-radius:16px;max-width:450px;width:100%;padding:24px;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,0.5);">'
      + '  <div style="font-size:3.5rem;margin-bottom:10px;">⏰</div>'
      + '  <h2 style="margin:0 0 8px;color:' + urgency + ';font-size:1.4rem;">' + message + '</h2>'
      + '  <div style="background:' + urgency + ';color:#fff;padding:10px 20px;border-radius:50px;display:inline-block;font-size:1.3rem;font-weight:800;margin:15px 0;">'
      + '    متبقٍ ' + daysLeft + ' يوم'
      + '  </div>'
      + '  <div style="background:#fef3c7;border-right:4px solid #f59e0b;padding:12px;border-radius:8px;text-align:right;font-size:0.85rem;color:#92400e;margin-bottom:20px;">'
      + '    <strong>للتجديد:</strong><br>📞 اتصل: <strong dir="ltr">+249111729111</strong>'
      + '  </div>'
      + '  <button id="renewal-close-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#0d3b66,#1e6091);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:800;cursor:pointer;">فهمت، سأتواصل للتجديد</button>'
      + '</div>';
    document.documentElement.appendChild(wrapper);
    document.getElementById('renewal-close-btn').addEventListener('click', function() { wrapper.remove(); });
  }

  const EULA_KEY = 'kodnaqi_eula_accepted';
  const EULA_VERSION = '1.0';

  function hasAcceptedEULA() {
    try {
      const accepted = localStorage.getItem(EULA_KEY);
      if (!accepted) return false;
      const data = JSON.parse(accepted);
      return data.version === EULA_VERSION && data.accepted === true;
    } catch(e) { return false; }
  }

  function acceptEULA() {
    try {
      localStorage.setItem(EULA_KEY, JSON.stringify({ version: EULA_VERSION, accepted: true, date: Date.now() }));
      return true;
    } catch(e) { return false; }
  }

  function showEULADialog() {
    const old = document.getElementById('kodnaqi-eula-dialog');
    if (old) old.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'kodnaqi-eula-dialog';
    wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:16px;direction:rtl;';
    wrapper.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:600px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,0.5);">
        <div style="background:linear-gradient(135deg,#0d3b66,#1e6091);color:#fff;padding:20px;border-radius:16px 16px 0 0;text-align:center;">
          <h2 style="margin:0;font-size:1.3rem;">📋 اتفاقية استخدام KodNaqi</h2>
        </div>
        <div style="flex:1;overflow-y:auto;padding:20px;font-size:0.9rem;line-height:1.8;color:#334155;">
          <p>جميع البيانات تُخزن محليًا على جهازك فقط. لا نجمع أو نشارك بياناتك مع أي طرف ثالث.</p>
        </div>
        <div style="padding:20px;border-top:1px solid #e2e8f0;display:flex;gap:12px;">
          <button id="eula-accept" style="flex:1;padding:14px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:800;cursor:pointer;">✅ أوافق</button>
        </div>
      </div>`;
    document.documentElement.appendChild(wrapper);
    document.getElementById('eula-accept').addEventListener('click', function() { acceptEULA(); wrapper.remove(); location.reload(); });
  }

  function checkEULA() { if (!hasAcceptedEULA()) { showEULADialog(); return false; } return true; }

  const LOCK_KEY = 'kodnaqi_expiry_lock';
  function setExpiryLock(on) { try { if (on) localStorage.setItem(LOCK_KEY, '1'); else localStorage.removeItem(LOCK_KEY); } catch(e) {} }
  function isExpiryLocked() { try { return localStorage.getItem(LOCK_KEY) === '1'; } catch(e) { return false; } }

  function ensureExpiryOverlay() {
    if (document.getElementById('kodnaqi-expiry-lock')) return;
    const div = document.createElement('div');
    div.id = 'kodnaqi-expiry-lock';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.96);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;';
    div.innerHTML = `
      <div style="max-width:520px;width:100%;background:#fff;border-radius:14px;padding:22px;text-align:center;">
        <h2 style="margin:0 0 10px;color:#991b1b;">انتهت صلاحية الترخيص</h2>
        <p style="margin:0 0 14px;color:#334155;line-height:1.8;">تم إيقاف النظام مؤقتًا. بياناتك محفوظة ولم تُحذف. للمتابعة، أدخل مفتاح ترخيص جديد.</p>
        <button onclick="window.KodNaqiLicense.showDialog()" style="width:100%;padding:12px;border:0;border-radius:10px;background:linear-gradient(135deg,#0d3b66,#1e6091);color:#fff;font-weight:800;cursor:pointer;">فتح إدارة الترخيص</button>
      </div>`;
    document.documentElement.appendChild(div);
  }

  function removeExpiryOverlay() { const el = document.getElementById('kodnaqi-expiry-lock'); if (el) el.remove(); }

  function safeGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch(e) { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); return true; } catch(e) { return false; } }

  async function getMyDeviceCode() {
    if (window.KodNaqiSecurity && window.KodNaqiSecurity.getDeviceCode) {
      return await window.KodNaqiSecurity.getDeviceCode();
    }
    return 'ERR-000';
  }

  function formatDeviceCode(code) {
    if (!code || code.length !== 6) return code || '';
    return code.slice(0, 3) + '-' + code.slice(3);
  }

  // ═══ دالة التحقق من السيرفر (تم إصلاحها للأوفلاين) ═══
  async function checkServer(payload) {
    if (!payload || !payload.id) return { ok: true };
    if (!window.KodNaqiSecurity || !window.KodNaqiSecurity.checkServerStatus) return { ok: true };

    try {
      const remote = await window.KodNaqiSecurity.checkServerStatus(payload.id);
      console.log('🔍 [DEBUG] checkServerStatus result:', JSON.stringify(remote));

      if (remote.ok) {
        if (remote.status === 'revoked' || remote.status === 'suspended') {
          return { ok: false, valid: false, reason: 'server_' + remote.status };
        }
        return { ok: true };
      }

      // 🛠️ إصلاح: إذا لم يوجد المفتاح في السيرفر، نسمح بالعمل محلياً
      if (remote.reason === 'not_found') {
        console.warn('License not found in server, allowing offline access.');
        return { ok: true }; 
      }

      if (remote.reason === 'no_config') {
        return { ok: false, valid: false, reason: 'no_config' };
      }
      if (remote.reason === 'http_401' || remote.reason === 'http_403') {
        return { ok: false, valid: false, reason: 'server_auth_failed' };
      }

      console.warn('⚠️ Network error detected, allowing offline access.');
      return { ok: true };
    } catch (e) {
      console.warn('⚠️ Exception in checkServer, allowing offline access.', e);
      return { ok: true };
    }
  }

  async function verify(key) {
    if (!key) return { valid: false, reason: 'empty' };
    const trimmed = String(key).trim();
    if (trimmed.startsWith('KOD-')) return { valid: false, reason: 'old_format', message: 'مفتاح قديم' };
    if (!trimmed.startsWith('KOD2.')) return { valid: false, reason: 'format' };
    if (!window.KodNaqiSecurity || !window.KodNaqiSecurity.verifyLicense) return { valid: false, reason: 'security_not_loaded' };
    
    const localResult = await window.KodNaqiSecurity.verifyLicense(trimmed);
    if (!localResult.valid) {
      console.log('❌ localResult failed:', localResult);
      return localResult;
    }
    const serverResult = await checkServer(localResult.payload);
    if (!serverResult.ok) {
      console.log('❌ serverResult failed:', serverResult);
      return serverResult;
    }
    return localResult;
  }

  async function activate(key) {
    const check = await verify(key);
    if (!check.valid) return check;
    const data = { key: key, payload: check.payload, deviceCode: check.deviceCode, activatedAt: Date.now() };
    safeSet(STORAGE_KEY, JSON.stringify(data));
    setExpiryLock(false);
    removeExpiryOverlay();
    try { await applyRestrictions(); } catch(e) {}
    if (typeof showActivationSuccess === 'function') showActivationSuccess(check.payload);
    return { valid: true, payload: check.payload };
  }

  // ═══ حالة الترخيص (تم إصلاحها بالكامل) ═══
  async function getLicenseStatus() {
    const raw = safeGet(STORAGE_KEY);
    if (!raw) return { status: 'none' }; // 🛠️ إصلاح: منع الانهيار إذا لم يوجد مفتاح

    let data;
    try { data = JSON.parse(raw); } catch(e) { safeDel(STORAGE_KEY); return { status: 'none' }; }
    
    const check = await verify(data.key);
    if (!check.valid) return { status: 'invalid', reason: check.reason, message: check.message, data };
    
    const p = check.payload;

    // 🛡️ 1. حماية ضد التلاعب بساعة الجهاز (تم إضافة await)
    try {
        const lastSeen = await window.KodNaqiSecurity.getLastSeenMax(); // 🛠️ إصلاح
        const now = Date.now();
        if (lastSeen && (now < lastSeen - 86400000)) {
            return { status: 'invalid', reason: 'clock_tampering', message: 'تم اكتشاف خطأ في تاريخ الجهاز.' };
        }
        window.KodNaqiSecurity.updateLastSeen(now);
    } catch(e) { console.warn('Clock check failed', e); }

    // 🛑 2. فحص تاريخ الانتهاء
    if (p.expires && Date.now() > p.expires) {
        return { status: 'invalid', reason: 'expired', message: 'انتهت صلاحية الترخيص. يرجى التجديد.' };
    }

    const daysLeft = p.expires ? Math.ceil((p.expires - Date.now()) / 86400000) : Infinity;
    return { status: 'valid', payload: p, daysLeft, data };
  }

  async function getTrialStatus() {
    if (safeGet('kodnaqi_ever_activated') === 'true') return { active: false, daysLeft: 0, startMs: 0, elapsed: 0, expired: true };
    let start = safeGet(TRIAL_KEY);
    if (!start) {
      start = String(Date.now());
      safeSet(TRIAL_KEY, start);
      try { await window.KodNaqiSecurity.updateLastSeen(Date.now()); } catch(e) {}
    }
    const startMs = parseInt(start, 10) || Date.now();
    const elapsed = Date.now() - startMs;
    const totalMs = TRIAL_DAYS * 86400000;
    const remaining = totalMs - elapsed;
    const daysLeft = Math.max(0, Math.ceil(remaining / 86400000));
    return { active: remaining > 0, daysLeft, startMs, elapsed, expired: remaining <= 0 };
  }

  async function getActivePayload() {
    const st = await getLicenseStatus();
    if (st.status === 'valid') return st.payload;
    if (st.status === 'invalid') return null;
    const trial = await getTrialStatus();
    if (trial.active) return { tier: 'TRIAL' };
    return null;
  }

  async function getActiveTier() {
    const p = await getActivePayload();
    if (p) return p.tier;
    const st = await getLicenseStatus();
    if (st.status === 'invalid') return null;
    const trial = await getTrialStatus();
    return trial.active ? 'TRIAL' : null;
  }

  async function checkTierLimit(kind, currentCount) {
    const tier = await getActiveTier();
    if (!tier) return { ok: false, reason: 'no_license', limit: 0 };
    const limits = getTierLimits(tier);
    const limit = limits[kind] !== undefined ? limits[kind] : 0;
    if (limit === Infinity) return { ok: true, limit: Infinity, tier };
    const count = parseInt(currentCount, 10) || 0;
    if (count >= limit) return { ok: false, reason: 'limit_reached', limit, current: count, tier };
    return { ok: true, limit, current: count, tier };
  }

  async function getTierInfo() {
    const tier = await getActiveTier();
    if (!tier) return null;
    return { tier, limits: getTierLimits(tier), features: TIER_FEATURES[tier] || [] };
  }

  async function hasFeature(feature) {
    const p = await getActivePayload();
    if (!p) return false;
    return (TIER_FEATURES[p.tier] || []).indexOf(feature) !== -1;
  }

  async function applyRestrictions() {
    checkEULA();
    checkRenewalReminder().catch(function(){});
    if (isExpiryLocked()) {
      document.documentElement.setAttribute('data-tier', 'EXPIRED');
      ensureExpiryOverlay();
      return;
    }
    const tier = (await getActiveTier()) || 'NONE';
    document.documentElement.setAttribute('data-tier', tier);
    document.querySelectorAll('[data-require-tier]').forEach(function(el) {
      const req = (el.getAttribute('data-require-tier') || '').split(',').map(s => s.trim());
      el.style.display = (req.indexOf(tier) !== -1 || req.indexOf('*') !== -1) ? '' : 'none';
    });
  }

  function showActivationInput() { /* ... (نفس الكود القديم) ... */ }

  async function enforceLicenseOnStartup() {
    try {
      const st = await getLicenseStatus();
      if (st.status === 'valid') return;
      const trial = await getTrialStatus();
      if (st.status === 'none' && trial.active) return;
      showLockScreen(st);
    } catch(e) {
      console.warn('License check failed.', e);
    }
  }

  function showLockScreen(status) {
    let overlay = document.getElementById('kn-lock-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'kn-lock-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
      document.body.appendChild(overlay);
    }
    let msg = 'تم إيقاف النظام مؤقتاً. يرجى تجديد الاشتراك.';
    if (status.reason === 'clock_tampering') msg = 'تم اكتشاف خطأ في تاريخ الجهاز. يرجى تصحيح تاريخ الكمبيوتر.';
    overlay.innerHTML = `
      <div style="background:white;padding:30px;border-radius:16px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.1);border-top:5px solid #dc2626;">
        <div style="font-size:3rem;margin-bottom:15px;">🔒</div>
        <h2 style="color:#dc2626;margin:0 0 10px;font-weight:900;">تنبيه الترخيص</h2>
        <p style="color:#475569;margin-bottom:25px;line-height:1.7;font-size:1.05rem;">${msg}</p>
        <button onclick="window.KodNaqiLicense.showDialog();" style="width:100%;padding:15px;background:linear-gradient(135deg,#0d3b66,#1e6091);color:white;border:none;border-radius:10px;font-weight:bold;font-size:1.1rem;cursor:pointer;">🔑 إدخال مفتاح الترخيص</button>
      </div>`;
  }

  async function showDialog() { /* ... (نفس الكود القديم) ... */ }
  
  function generateKey() { throw new Error('ممنوع'); }

  window.KodNaqiLicense = {
    verify, checkEULA, checkRenewalReminder, activate, getMyDeviceCode, formatDeviceCode,
    hasFeature, applyRestrictions, checkTierLimit, getTierInfo, getTierLimits, showDialog,
    getLicenseStatus, getTrialStatus, getActiveTier, generate: generateKey,
    STORAGE_KEY, TRIAL_KEY, TIER_NAMES, TIER_FEATURES,
    showLockScreen, showActivationInput
  };

  async function startupCheck() {
    try { await applyRestrictions(); } catch(e) { console.warn('Restrictions error', e); }
    try { await enforceLicenseOnStartup(); } catch(e) { console.warn('Lock error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startupCheck);
  else startupCheck();

  console.log('[License] v2 loaded');
})();

const DEV_MODE_KEY = 'kodnaqi_dev_mode';
function isDevMode() { try { return localStorage.getItem(DEV_MODE_KEY) === 'true'; } catch(e) { return false; } }
const DEV_PASSWORD = 'kodnaqi2026dev';
function enableDevMode() { if (prompt('كلمة المرور:') !== DEV_PASSWORD) return alert('خطأ'); localStorage.setItem(DEV_MODE_KEY, 'true'); location.reload(); }
function disableDevMode() { localStorage.removeItem(DEV_MODE_KEY); localStorage.removeItem('kodnaqi_license'); location.reload(); }
if (window.KodNaqiLicense) { window.KodNaqiLicense.enableDevMode = enableDevMode; window.KodNaqiLicense.disableDevMode = disableDevMode; window.KodNaqiLicense.isDevMode = isDevMode; }

function showActivationSuccess(payload) {
  if (localStorage.getItem('kodnaqi_activation_shown') === 'true') return;
  const toast = document.createElement('div');
  toast.id = 'kodnaqi-toast';
  toast.className = 'toast-card show';
  toast.innerHTML = `<div style="padding:20px;background:#059669;color:white;border-radius:10px;">🎊 تم تفعيل باقتك بنجاح!</div>`;
  document.body.appendChild(toast);
  setTimeout(() => { if(toast.parentNode) toast.remove(); }, 4000);
  localStorage.setItem('kodnaqi_activation_shown', 'true');
}
window.showActivationSuccess = showActivationSuccess;
