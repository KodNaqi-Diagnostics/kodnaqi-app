// ============================================================
// KodNaqi — نظام تسجيل الدخول
// ============================================================

const AUTH_KEYS = {
  USERS: 'kodnaqi_users',
  SESSION: 'kodnaqi_session',
  ATTEMPTS: 'kodnaqi_attempts',
};

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 5 * 60 * 1000;
const SESSION_DURATION = 8 * 60 * 60 * 1000;
const REMEMBER_DURATION = 30 * 24 * 60 * 60 * 1000;

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_kodnaqi_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
  try { const users = localStorage.getItem(AUTH_KEYS.USERS); return users ? JSON.parse(users) : {}; } catch (e) { return {}; }
}

function saveUsers(users) { localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(users)); }

async function initDefaultAdmin() {
  console.log('👥 عدد المستخدمين:', Object.keys(getUsers()).length);
}

function getAttempts() {
  try { const a = localStorage.getItem(AUTH_KEYS.ATTEMPTS); return a ? JSON.parse(a) : { count: 0, lockedUntil: 0 }; } catch (e) { return { count: 0, lockedUntil: 0 }; }
}

function saveAttempts(data) { localStorage.setItem(AUTH_KEYS.ATTEMPTS, JSON.stringify(data)); }
function isLocked() { return getAttempts().lockedUntil > Date.now(); }
function getLockRemaining() { const r = getAttempts().lockedUntil - Date.now(); return r <= 0 ? 0 : Math.ceil(r / 1000); }
function recordFailedAttempt() {
  const a = getAttempts(); a.count += 1;
  if (a.count >= MAX_ATTEMPTS) { a.lockedUntil = Date.now() + LOCK_DURATION; a.count = 0; }
  saveAttempts(a); return a;
}
function resetAttempts() { saveAttempts({ count: 0, lockedUntil: 0 }); }

function saveSession(username, rememberMe) {
  try { localStorage.setItem('kodnaqi_last_user', username); } catch (e) {}
  const duration = rememberMe ? REMEMBER_DURATION : SESSION_DURATION;
  localStorage.setItem(AUTH_KEYS.SESSION, JSON.stringify({ username, expiresAt: Date.now() + duration, startedAt: Date.now() }));
}

function getSession() {
  try {
    const s = localStorage.getItem(AUTH_KEYS.SESSION);
    if (!s) return null;
    const session = JSON.parse(s);
    if (session.expiresAt < Date.now()) { localStorage.removeItem(AUTH_KEYS.SESSION); return null; }
    return session;
  } catch (e) { return null; }
}

function clearSession() { localStorage.removeItem(AUTH_KEYS.SESSION); }
function isAuthenticated() { return getSession() !== null; }

async function login(username, password, rememberMe) {
  if (isLocked()) return { success: false, error: `🔒 الحساب مقفل. حاول بعد ${Math.ceil(getLockRemaining()/60)} دقيقة.` };
  const users = getUsers();
  const user = users[username];
  if (!user) {
    const a = recordFailedAttempt();
    return { success: false, error: `❌ اسم المستخدم غير صحيح. المتبقي: ${MAX_ATTEMPTS - a.count}` };
  }
  if (await hashPassword(password) !== user.passwordHash) {
    const a = recordFailedAttempt();
    return { success: false, error: `❌ كلمة المرور غير صحيحة. المتبقي: ${MAX_ATTEMPTS - a.count}` };
  }
  resetAttempts();
  saveSession(username, rememberMe);
  return { success: true, user: user };
}

function logout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  clearSession();
  switchToLoginMode();
  showLoginScreen();
}

async function changePassword(oldPassword, newPassword, confirmPassword) {
  const session = getSession();
  if (!session) return { success: false, error: '❌ لم يتم العثور على الجلسة' };
  const users = getUsers(); const user = users[session.username];
  if (!user) return { success: false, error: '❌ المستخدم غير موجود' };
  if (await hashPassword(oldPassword) !== user.passwordHash) return { success: false, error: '❌ كلمة المرور الحالية خاطئة' };
  if (newPassword.length < 6) return { success: false, error: '❌ كلمة المرور قصيرة' };
  if (newPassword !== confirmPassword) return { success: false, error: '❌ كلمتا المرور غير متطابقتين' };
  user.passwordHash = await hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
}

function getCurrentUser() {
  const session = getSession(); if (!session) return null;
  return getUsers()[session.username] || null;
}

function showLoginScreen() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideLoginScreen() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

async function handleLoginForm(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('loginRemember')?.checked || false;
  const btn = document.getElementById('loginBtn');

  if (!username || !password) {
    if (window.showKNToast) window.showKNToast('الرجاء إدخال اسم المستخدم وكلمة المرور', 'warning');
    else alert('⚠️ أدخل البيانات أولاً!');
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = 'جاري التحقق...'; }

  try {
    const result = await login(username, password, rememberMe);
    if (result.success) {
      hideLoginScreen();
      if (typeof postLoginInit === 'function') await postLoginInit();
      else if (typeof loadDashboard === 'function') await loadDashboard();
    } else {
      if (btn) { btn.disabled = false; btn.innerHTML = 'تسجيل الدخول'; }
      if (window.showKNToast) window.showKNToast(result.error, 'error');
      else alert(result.error);
      const passInput = document.getElementById('loginPassword'); if (passInput) passInput.value = '';
      if (isLocked()) startLockCountdown();
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = 'تسجيل الدخول'; }
    if (window.showKNToast) window.showKNToast('خطأ: ' + err.message, 'error');
  }
}

function startLockCountdown() {
  const btn = document.getElementById('loginBtn');
  const interval = setInterval(() => {
    if (!isLocked()) { clearInterval(interval); if (btn) { btn.disabled = false; btn.innerHTML = 'تسجيل الدخول'; } return; }
    const sec = getLockRemaining(); const min = Math.floor(sec / 60); const s = sec % 60;
    if (btn) { btn.disabled = true; btn.innerHTML = `🔒 انتظر ${min}:${String(s).padStart(2, '0')}`; }
  }, 1000);
}

async function setupAuth() {
  await initDefaultAdmin();
  if (isAuthenticated()) { hideLoginScreen(); return true; }
  if (Object.keys(getUsers()).length === 0) { showLoginScreen(); switchToCreateAccountMode(); return false; }
  showLoginScreen(); switchToLoginMode();
  if (isLocked()) startLockCountdown();
  return false;
}

function switchToCreateAccountMode() {
  const title = document.getElementById('loginTitle'); if (title) title.textContent = '🆕 إنشاء حساب المدير';
  const submitBtn = document.getElementById('loginBtn'); if (submitBtn) { submitBtn.textContent = 'إنشاء الحساب'; submitBtn.setAttribute('onclick', 'handleCreateAccount(event)'); }
  const confirmGroup = document.getElementById('confirmPasswordGroup'); if (confirmGroup) confirmGroup.style.display = 'block';
  const rememberGroup = document.getElementById('rememberMeGroup'); if (rememberGroup) rememberGroup.style.display = 'none';
  const userInput = document.getElementById('loginUsername'); if (userInput) { userInput.value = 'admin'; userInput.placeholder = 'اختر اسم مستخدم'; }
  const passInput = document.getElementById('loginPassword'); if (passInput) passInput.placeholder = 'اختر كلمة مرور';
  const confirmInput = document.getElementById('loginPasswordConfirm'); if (confirmInput) confirmInput.placeholder = 'أعد كتابة كلمة المرور';
}

function switchToLoginMode() {
  const title = document.getElementById('loginTitle'); if (title) title.textContent = 'تسجيل الدخول';
  const submitBtn = document.getElementById('loginBtn'); if (submitBtn) { submitBtn.textContent = 'تسجيل الدخول'; submitBtn.setAttribute('onclick', 'handleLoginForm(event)'); }
  const confirmGroup = document.getElementById('confirmPasswordGroup'); if (confirmGroup) confirmGroup.style.display = 'none';
  const rememberGroup = document.getElementById('rememberMeGroup'); if (rememberGroup) rememberGroup.style.display = 'block';
  const userInput = document.getElementById('loginUsername'); if (userInput) { userInput.value = ''; userInput.placeholder = 'اسم المستخدم'; }
  const passInput = document.getElementById('loginPassword'); if (passInput) { passInput.value = ''; passInput.placeholder = 'كلمة المرور'; }
}

async function handleCreateAccount(event) {
  if (event) event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const confirm = document.getElementById('loginPasswordConfirm')?.value || '';
  const btn = document.getElementById('loginBtn');

  if (!username || username.length < 3) { if (window.showKNToast) window.showKNToast('اسم المستخدم 3 أحرف على الأقل', 'warning'); return; }
  if (!password || password.length < 6) { if (window.showKNToast) window.showKNToast('كلمة المرور 6 أحرف على الأقل', 'warning'); return; }
  if (password !== confirm) { if (window.showKNToast) window.showKNToast('كلمتا المرور غير متطابقتين', 'error'); return; }

  if (btn) { btn.disabled = true; btn.innerHTML = 'جاري الإنشاء...'; }
  try {
    const users = getUsers();
    if (users[username]) { if (window.showKNToast) window.showKNToast('الاسم محجوز', 'error'); if (btn) { btn.disabled = false; btn.innerHTML = 'إنشاء الحساب'; } return; }
    users[username] = { username, passwordHash: await hashPassword(password), fullName: username === 'admin' ? 'مدير المعمل' : username, role: 'admin' };
    saveUsers(users); saveSession(username, true); hideLoginScreen();
    if (typeof postLoginInit === 'function') await postLoginInit();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = 'إنشاء الحساب'; }
    if (window.showKNToast) window.showKNToast('خطأ: ' + err.message, 'error');
  }
}

function showChangePasswordModal() {
  document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('confirmPassword').value = '';
  new bootstrap.Modal(document.getElementById('passwordModal')).show();
}

async function handleChangePassword() {
  const oldPw = document.getElementById('oldPassword').value; const newPw = document.getElementById('newPassword').value; const confirmPw = document.getElementById('confirmPassword').value;
  if (!oldPw || !newPw || !confirmPw) { if (window.showKNToast) window.showKNToast('املأ كل الحقول', 'warning'); return; }
  const result = await changePassword(oldPw, newPw, confirmPw);
  if (result.success) { bootstrap.Modal.getInstance(document.getElementById('passwordModal')).hide(); if (window.showKNToast) window.showKNToast('تم التغيير بنجاح', 'success'); }
  else { if (window.showKNToast) window.showKNToast(result.error, 'error'); }
}

function updateAccountDisplay() {
  const user = getCurrentUser(); if (user) { const el = document.getElementById('currentUserDisplay'); if (el) el.textContent = user.fullName || user.username; }
}

async function loginWithBiometric(username) {
  try {
    username = username || localStorage.getItem('kodnaqi_last_user') || 'admin';
    const users = getUsers(); let user = users[username];
    if (!user) { const firstAdmin = Object.keys(users).find(k => users[k].role === 'admin'); if (firstAdmin) username = firstAdmin; else throw new Error('لا يوجد حساب'); }
    saveSession(username, true); hideLoginScreen();
    if (typeof postLoginInit === 'function') await postLoginInit();
    return { success: true, user: users[username] };
  } catch (err) { return { success: false, error: err.message }; }
}

window.login = login; window.logout = logout; window.changePassword = changePassword;
window.getCurrentUser = getCurrentUser; window.isAuthenticated = isAuthenticated;
window.isLocked = isLocked; window.getLockRemaining = getLockRemaining;
window.setupAuth = setupAuth; window.handleLoginForm = handleLoginForm;
window.showLoginScreen = showLoginScreen; window.hideLoginScreen = hideLoginScreen;
window.showChangePasswordModal = showChangePasswordModal; window.handleChangePassword = handleChangePassword;
window.updateAccountDisplay = updateAccountDisplay; window.loginWithBiometric = loginWithBiometric;
window.switchToCreateAccountMode = switchToCreateAccountMode; window.switchToLoginMode = switchToLoginMode;
window.handleCreateAccount = handleCreateAccount;
