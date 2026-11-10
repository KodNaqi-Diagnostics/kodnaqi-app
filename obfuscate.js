const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const wwwDir = path.join(rootDir, 'www');
const distDir = path.join(rootDir, 'www_dist');
const libDir = path.join(rootDir, 'lib');

// 1. تحضير مجلد www (نسخ الملفات من الجذر)
console.log('⏳ جاري تجهيز ملفات المشروع...');
if (fs.existsSync(wwwDir)) fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(wwwDir);

const files = fs.readdirSync(rootDir);
for (const file of files) {
    if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.json') || file.endsWith('.png')) {
        // استثناء الملفات التي لا يجب نسخها
        if (!['package.json', 'package-lock.json', 'main.js', 'preload.js', 'trial-manager.js', 'obfuscate.js'].includes(file)) {
            fs.copyFileSync(path.join(rootDir, file), path.join(wwwDir, file));
        }
    }
}

// نسخ مجلد lib إذا كان موجوداً
if (fs.existsSync(libDir)) {
    fs.cpSync(libDir, path.join(wwwDir, 'lib'), { recursive: true });
}

// 2. نسخ www إلى www_dist
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(wwwDir, distDir, { recursive: true });

// 3. إعدادات التشفير
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// 4. دالة التشفير
function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'lib') processDirectory(fullPath);
        } else if (file.endsWith('.js') && file !== 'sw.js' && file !== 'quiet.js') {
            try {
                const code = fs.readFileSync(fullPath, 'utf8');
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscationOptions).getObfuscatedCode();
                fs.writeFileSync(fullPath, obfuscatedCode, 'utf8');
                console.log(`✅ تم تشفير: ${file}`);
            } catch (err) {
                console.error(`❌ فشل تشفير: ${file}`, err);
            }
        }
    }
}

console.log('⏳ جاري تشفير ملفات الواجهة...');
processDirectory(distDir);
console.log('🚀 اكتمل التشفير! الملفات المشفرة جاهزة في www_dist');
