const { app, BrowserWindow, session, protocol, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

// ✅ 1. تفعيل SharedArrayBuffer (يبقى كإجراء احترازي)
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// ✅ 2. تسجيل بروتوكول app:// (يجب أن يكون قبل app.whenReady)
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
        return 'ERR-000';
    }
}

// ✅ 4. الاستماع لطلب الكود من الواجهة
const { ipcMain } = require('electron');
ipcMain.handle('get-device-code', () => {
    return generateStableDeviceCode();
});

function getIndexPath() {
  const candidates = [
    path.join(__dirname, 'www', 'index.html'),
    path.join(__dirname, 'index.html')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function getIconPath() {
  const candidates = [
    path.join(__dirname, 'www', 'logo.png'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, 'www', 'icon-512.png'),
    path.join(__dirname, 'icon-512.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // ✅ 5. ربط ملف preload
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // ✅ 6. تحميل الصفحة عبر البروتوكول المخصص
  win.loadURL('app://./index.html'); // ⚠️ تأكد أن اسم الملف هو index.html
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  // ✅ 7. معالجة طلبات app:// وإضافة الرؤوس الأمنية
  protocol.handle('app', (request) => {
    const url = request.url.replace('app://', '');
    // إزالة النقطة في بداية المسار إذا وجدت
    const filePath = path.join(__dirname, 'www', url.replace(/^\.\//, ''));
    try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(data, {
            headers: {
                'Content-Type': contentType,
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Resource-Policy': 'cross-origin'
            }
        });
    } catch (e) {
        return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ═══════════════════════════════════════════════════
// 🔄 التحديث التلقائي (مع الحفاظ على الكود الأصلي)
// ═══════════════════════════════════════════════════
const { autoUpdater } = require('electron-updater');
autoUpdater.autoDownload = false;

app.whenReady().then(() => {
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(function () {});
  }, 4 * 60 * 60 * 1000);
  autoUpdater.checkForUpdates().catch(function () {});
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'تحديث جديد متاح',
    message: 'يوجد إصدار جديد من KodNaqi. هل تريد تحميله الآن؟',
    buttons: ['نعم', 'لاحقاً']
  }).then(result => {
    if (result.response === 0) { autoUpdater.downloadUpdate(); }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'جاهز للتثبيت',
    message: 'تم تحميل التحديث. هل تريد إعادة تشغيل التطبيق الآن؟',
    buttons: ['إعادة تشغيل', 'لاحقاً']
  }).then(result => {
    if (result.response === 0) { autoUpdater.quitAndInstall(); }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
});
