const { app, BrowserWindow, ipcMain, protocol, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');
const { autoUpdater } = require('electron-updater');

// ✅ 1. تفعيل SharedArrayBuffer لمنع الشاشة السوداء
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// ✅ 2. تسجيل البروتوكول المخصص (يجب أن يكون قبل whenReady)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// ✅ 3. دالة توليد كود الجهاز الثابت (6 حروف)
function generateStableDeviceCode() {
  try {
    const id = machineIdSync();
    const hash = crypto.createHash('sha256').update(id).digest('hex');
    const code = hash.substring(0, 6).toUpperCase();
    return `${code.substring(0, 3)}-${code.substring(3, 6)}`;
  } catch (e) {
    console.error('[DeviceCode] Error:', e);
    return 'ERR-000';
  }
}

// ✅ 4. إعدادات التحديث التلقائي
autoUpdater.autoDownload = false;

// ✅ 5. إنشاء النافذة الرئيسية
function createWindow() {
  // البحث عن الأيقونة
  const iconPath = [
    path.join(__dirname, 'www', 'logo.png'),
    path.join(__dirname, 'logo.png')
  ].find(fs.existsSync);

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // تحميل الصفحة عبر البروتوكول المخصص
  win.loadURL('app://./index.html');
  
  // إظهار النافذة فقط عندما تكون جاهزة (لمنع الشاشة البيضاء)
  win.once('ready-to-show', () => win.show());

// منع التطبيق من الانتقال لصفحات خارجية داخل النافذة
win.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('app://')) {
    event.preventDefault();
    shell.openExternal(url);
  }
});

  // منع فتح النوافذ الخارجية داخل التطبيق (أمان)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ✅ 6. تهيئة التطبيق (تحدث مرة واحدة فقط)
app.whenReady().then(() => {
  
  // معالجة طلبات الملفات (app://) بكفاءة عالية
  protocol.handle('app', async (request) => {
    try {
      // تنظيف الرابط من أي استعلامات مثل ?v=1
      let url = request.url.replace('app://', '').split('?')[0];
      url = decodeURIComponent(url);
      
      // إزالة النقطة والسلاش من بداية المسار
      if (url.startsWith('./')) url = url.substring(2);
      if (url.startsWith('/')) url = url.substring(1);

      // البحث عن الملف في مجلد www
      const filePath = path.join(__dirname, 'www', url);
      const data = await fs.promises.readFile(filePath);
      
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html', 
        '.css': 'text/css', 
        '.js': 'application/javascript',
        '.json': 'application/json', 
        '.png': 'image/png', 
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', 
        '.woff': 'font/woff', 
        '.woff2': 'font/woff2', 
        '.ttf': 'font/ttf'
      };
      
      return new Response(data, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'cross-origin'
        }
      });
    } catch (e) {
      // في حال عدم وجود الملف، نعيد 404 بصمت
      return new Response('Not Found', { status: 404 });
    }
  });

  // إعداد قناة الاتصال لجلب كود الجهاز
  ipcMain.handle('get-device-code', () => generateStableDeviceCode());

  // إنشاء النافذة
  createWindow();

  // إعادة إنشاء النافذة على الماك (سلوك قياسي)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // تشغيل التحديث التلقائي (فقط إذا كان التطبيق مبنياً وليس في وضع التطوير)
  if (app.isPackaged) {
    // فحص التحديثات كل 4 ساعات
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
    autoUpdater.checkForUpdates().catch(() => {});
  }
});

// إغلاق التطبيق عند إغلاق كل النوافذ (باستثناء الماك)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ═══════════════════════════════════════════════════
// 🔄 أحداث التحديث التلقائي
// ═══════════════════════════════════════════════════
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'تحديث جديد متاح',
    message: 'يوجد إصدار جديد من KodNaqi. هل تريد تحميله الآن؟',
    buttons: ['نعم', 'لاحقاً']
  }).then(result => {
    if (result.response === 0) autoUpdater.downloadUpdate();
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'جاهز للتثبيت',
    message: 'تم تحميل التحديث. هل تريد إعادة تشغيل التطبيق الآن؟',
    buttons: ['إعادة تشغيل', 'لاحقاً']
  }).then(result => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err);
});
