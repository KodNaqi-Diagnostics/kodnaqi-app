const { app, safeStorage, ipcMain } = require('electron');
const Store = require('electron-store').default;
const { machineIdSync } = require('node-machine-id');
const { execSync } = require('child_process');

// إعداد المتجر المشفر
const store = new Store({
    name: 'kodnaqi-secure-data',
    encryptionKey: 'KODNAQI_SECRET_KEY_2026', // مفتاح التشفير
    clearInvalidConfig: true
});

// دالة لجلب تاريخ أول تشغيل من الريجستري (Windows)
function getTrialDateFromRegistry() {
    try {
        const machineId = machineIdSync();
        // نبحث في الريجستري عن مفتاح خاص بهذا الجهاز
        const result = execSync(`reg query "HKCU\\Software\\KodNaqi" /v TrialDate_${machineId}`, { encoding: 'utf-8', stdio: 'pipe' });
        const match = result.match(/TrialDate_\w+\s+REG_SZ\s+(\d+)/);
        if (match) return parseInt(match[1]);
    } catch (e) {
        // المفتاح غير موجود (أول تشغيل)
    }
    return null;
}

// دالة لحفظ تاريخ أول تشغيل في الريجستري
function saveTrialDateToRegistry(timestamp) {
    try {
        const machineId = machineIdSync();
        execSync(`reg add "HKCU\\Software\\KodNaqi" /v TrialDate_${machineId} /t REG_SZ /d ${timestamp} /f`, { stdio: 'ignore' });
    } catch (e) {
        console.error('Failed to save to registry:', e);
    }
}

// دالة جلب أو إنشاء تاريخ بدء التجربة
function getOrCreateTrialStart() {
    const machineId = machineIdSync();
    let trialDate = null;

    // 1. البحث في electron-store (المشفر)
    const storedData = store.get(`trial_${machineId}`);
    if (storedData) {
        trialDate = storedData;
    } else {
        // 2. البحث في الريجستري
        trialDate = getTrialDateFromRegistry();
    }

    // 3. إذا لم يوجد في أي مكان، فهذا أول تشغيل
    if (!trialDate) {
        trialDate = Date.now();
        // حفظ في المتجر المشفر
        store.set(`trial_${machineId}`, trialDate);
        // حفظ في الريجستري
        saveTrialDateToRegistry(trialDate);
    } else {
        // تأكد من وجوده في الاثنين (في حال مسح أحدهما)
        store.set(`trial_${machineId}`, trialDate);
        saveTrialDateToRegistry(trialDate);
    }

    return trialDate;
}

// دالة لحساب الأيام المتبقية
function getTrialStatus() {
    const trialStart = getOrCreateTrialStart();
    const now = Date.now();
    const diffMs = now - trialStart;
    const trialDays = 14;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, trialDays - diffDays);

    return {
        isTrialActive: daysLeft > 0,
        daysLeft: daysLeft,
        trialStartDate: trialStart
    };
}

// تصدير الدوال لاستخدامها في main.js
module.exports = {
    getTrialStatus,
    getOrCreateTrialStart
};
