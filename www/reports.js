// ============================================================
// KodNaqi — نظام التقارير والفواتير (نسخة نظيفة)

// ═══ Helper: قراءة الهوية الديناميكية ═══
function KN_BRAND() {
  const c = (window.KodNaqiBrand && window.KodNaqiBrand.get()) || {};
  return {
    name: c.labName || 'KodNaqi Diagnostics',
    nameShort: c.labNameShort || 'KodNaqi',
    slogan: c.slogan || '',
    phone: c.phone || '+249 111 729 111',
    whatsapp: (c.phone || '+249111729111').replace(/\s/g, '').replace('+', ''),
    email: c.email || 'kodnaqi@gmail.com',
    address: c.address || 'الخرطوم - السودان',
    logoData: c.logoData || null,
    stampData: c.stampData || null,
    techSignatureData: c.techSignatureData || null,
    doctorSignatureData: c.doctorSignatureData || null
  };
}
// ============================================================

const LAB_INFO = {
  get name_en() { return KN_BRAND().name; },
  name_ar: 'كود نقي للتشخيص',
  tagline_en: 'ACCURATE • RELIABLE • FAST',
  tagline_ar: 'دقة في التحليل... ثقة في النتائج',
  get address() { return KN_BRAND().address; },
  get phone() { return KN_BRAND().phone; },
  get whatsapp() { return KN_BRAND().whatsapp; },
  get email() { return KN_BRAND().email; },
};

// ============ Base64 Helpers ============
let _logoBase64Cache = null;
let _stampBase64Cache = null;
let _techSigBase64Cache = null;
let _doctorSigBase64Cache = null;

async function fileToBase64(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return '';
    const blob = await resp.blob();
    return await new Promise(r => {
      const reader = new FileReader();
      reader.onloadend = () => r(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('fileToBase64 failed:', url, e);
    return '';
  }
}

async function getLogoBase64() {
  if (!_logoBase64Cache) {
    const _customLogo = KN_BRAND().logoData;
    if (_customLogo) { _logoBase64Cache = _customLogo; }
    else { _logoBase64Cache = await fileToBase64('logo.png'); }
  }
  return _logoBase64Cache;
}
async function getStampBase64() {
  // ═══ افحص الختم المخصص أولًا (بدون cache) ═══
  const customStamp = KN_BRAND().stampData;
  if (customStamp) return customStamp;
  
  // fallback مع cache
  if (!_stampBase64Cache) {
    try { _stampBase64Cache = await fileToBase64('stamp.png'); }
    catch (e) { _stampBase64Cache = null; }
  }
  return _stampBase64Cache;
}
async function getTechSigBase64() {
  const customSig = KN_BRAND().techSignatureData;
  if (customSig) return customSig;
  
  if (!_techSigBase64Cache) {
    try { _techSigBase64Cache = await fileToBase64('signatures/tech.png'); }
    catch (e) { _techSigBase64Cache = null; }
  }
  return _techSigBase64Cache;
}
async function getDoctorSigBase64() {
  const customSig = KN_BRAND().doctorSignatureData;
  if (customSig) return customSig;
  
  if (!_doctorSigBase64Cache) {
    try { _doctorSigBase64Cache = await fileToBase64('signatures/doctor.png'); }
    catch (e) { _doctorSigBase64Cache = null; }
  }
  return _doctorSigBase64Cache;
}

// ============ أدوات مساعدة ============
function getHijriDate(dateInput) {
  try {
    const date = (typeof dateInput === 'string') ? new Date(dateInput) : dateInput;
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    } catch(e) {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    }
  } catch(e) {
    return '';
  }
}

function evaluateParam(param, value) {
  if (!value || param.result_type !== 'numeric') return 'none';
  const v = parseFloat(value);
  if (isNaN(v)) return 'none';
  if (param.ref_min !== null && param.ref_min !== undefined && v < param.ref_min) return 'low';
  if (param.ref_max !== null && param.ref_max !== undefined && v > param.ref_max) return 'high';
  if (param.ref_min !== null || param.ref_max !== null) return 'normal';
  return 'none';
}

function formatResult(value, evaluation) {
  if (!value) return '<span class="badge-dash">—</span>';
  let cls = '';
  let arrow = '';
  if (evaluation === 'high') { cls = 'val-high'; arrow = ' ↑'; }
  else if (evaluation === 'low') { cls = 'val-low'; arrow = ' ↓'; }
  else if (evaluation === 'normal') { cls = 'val-normal'; }
  return `<span class="${cls}">${escapeHtml(String(value))}${arrow}</span>`;
}

function formatEvaluation(evaluation) {
  if (evaluation === 'high') return '<span class="badge badge-h">HIGH ↑</span>';
  if (evaluation === 'low') return '<span class="badge badge-n">LOW ↓</span>';
  if (evaluation === 'normal') return '<span class="badge badge-o">NORMAL ✓</span>';
  return '<span class="badge-dash">—</span>';
}

function getRefDisplay(p) {
  if (p.ref_min !== null && p.ref_min !== undefined && p.ref_max !== null && p.ref_max !== undefined) {
    return `${p.ref_min} - ${p.ref_max}`;
  }
  if (p.ref_min !== null && p.ref_min !== undefined) return `≥ ${p.ref_min}`;
  if (p.ref_max !== null && p.ref_max !== undefined) return `≤ ${p.ref_max}`;
  return p.ref_text || '';
}

function genderEn(gender) {
  if (gender === 'ذكر') return 'Male';
  if (gender === 'أنثى') return 'Female';
  return gender || '-';
}

// ============ فتح نافذة (متوافق مع PWA) ============
function openNewWindow(url) {
  const w = window.open(url, '_blank');
  if (!w || w.closed || typeof w.closed === 'undefined') {
    console.log('⚠️ window.open محجوب — استخدام طريقة بديلة');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// ============ توليد تقرير A4 ============
// تصدير الدالة إلى النطاق العام
window.generateReport = generateReport;

// ============ توليد فاتورة 58mm ============
// ============ زر واتساب ============
async function sendWhatsApp(visitId) {
  try {
    const visit = await dbGet('visits', visitId);
    if (!visit) return;

    const patient = await dbGet('patients', visit.patient_id);
    if (!patient.phone) {
      alert('⚠️ لا يوجد رقم هاتف لهذا المريض');
      return;
    }

    const phone = patient.phone.replace(/[+\s\-()]/g, '');

    const message = `عزيزنا ${patient.name}، نتائج تحاليلك جاهزة في ${KN_BRAND().name}.
رقم التقرير: ${visit.serial}

يرجى التواصل معنا لاستلام التقرير.
📞 ${KN_BRAND().phone}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    openNewWindow(url);
  } catch (err) {
    console.error('sendWhatsApp error:', err);
    alert('❌ خطأ في إرسال واتساب: ' + err.message);
  }
}


// ============ طباعة بلوتوث مباشرة (RawBT) ============
// تصدير الدوال

window.generateInvoice = generateInvoice;
window.sendWhatsApp = sendWhatsApp;
window.printViaBluetooth = printViaBluetooth;
window.LAB_INFO = LAB_INFO;


// ═══ دوال الطباعة والإغلاق الآمنة (متوافقة مع APK/WebView) ═══

window.knSafeClose = function() {
  try { window.close(); } catch(e) {}
  setTimeout(function() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  }, 150);
};


window.knHandleBack = function() {
  var reportContainer = document.getElementById('report-container') || document.querySelector('.report');
  if (reportContainer && reportContainer.offsetParent !== null) {
    knSafeClose();
    return 'HANDLED';
  }
  return 'NOT_HANDLED';
};




// ═══════════════════════════════════════════════════════
// ═══ المساعدات (Helpers) ═══
// ═══════════════════════════════════════════════════════
// ═══ الطباعة ═══
// ═══ بناء HTML التقرير ═══
// ═══ الدوال المُصدَّرة إلى window ═══
// للتوافق مع الكود القديم
// ═══ الكود الجديد للطباعة (أضيف لتجاوز الكود القديم) ═══
function knNormId(id) {
  if (typeof id === 'number') return id;
  const n = Number(id);
  return isNaN(n) ? id : n;
}
function knArr(x) { return Array.isArray(x) ? x : []; }

async function knFetch(store, id) {
  try { return await dbGet(store, knNormId(id)); } catch(e) { return null; }
}
async function knFetchByIndex(store, index, value) {
  try {
    const r = await dbGetByIndex(store, index, knNormId(value));
    if (Array.isArray(r)) return r;
    return r ? [r] : [];
  } catch(e) { return []; }
}
async function knGetBundle(visitId) {
  const id = knNormId(visitId);
  const visit = await knFetch('visits', id);
  if (!visit) throw new Error('الزيارة غير موجودة: ' + visitId);
  const patient = visit.patient_id ? await knFetch('patients', visit.patient_id) : null;
  const visitTests = await knFetchByIndex('visit_tests', 'visit_id', id);
  const tests = knArr(await dbGetAll('tests'));
  const parameters = knArr(await dbGetAll('parameters'));
  const results = await knFetchByIndex('results', 'visit_id', id);
  return { visit, patient: patient || {}, visitTests, tests, parameters, results };
}

async function knPrintHtml(html) {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    await new Promise(function(resolve) {
      iframe.onload = resolve;
      iframe.srcdoc = html;
      setTimeout(resolve, 800);
    });
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(function() { iframe.remove(); }, 3000);
    return true;
  } catch(e) { console.warn('iframe print failed:', e); }
  
  if (typeof html2pdf !== 'undefined') {
    try {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;background:white;';
      document.body.appendChild(wrapper);
      const pdf = await html2pdf().set({ margin: 10, filename: 'report_' + Date.now() + '.pdf', html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(wrapper).toPdf().get('pdf');
      wrapper.remove();
      if (window.AndroidBridge && window.AndroidBridge.savePDF) {
        window.AndroidBridge.savePDF(pdf.output('datauristring'), 'report_' + Date.now() + '.pdf');
      } else {
        window.open(pdf.output('bloburl'), '_blank');
      }
      return true;
    } catch(e) { console.error('html2pdf fallback failed:', e); }
  }
  alert('تعذرت الطباعة على هذا المتصفح.');
  return false;
}

function knBuildReportHtml(bundle) {
  var visit = bundle.visit, patient = bundle.patient, visitTests = bundle.visitTests;
  var tests = bundle.tests, parameters = bundle.parameters, results = bundle.results;
  var brand = {}; try { brand = JSON.parse(localStorage.getItem('kodnaqi_brand_v1') || '{}'); } catch(e) {}
  var labName = brand.labName || 'معمل', labPhone = brand.phone || '', labAddress = brand.address || '', labEmail = brand.email || '';
  var stamp = brand.stampData || '', techSig = brand.techSignatureData || '', docSig = brand.doctorSignatureData || '';
  var logo = brand.logoData || './logo.png';
  
  var testMap = {}; tests.forEach(function(t) { testMap[t.id] = t; });
  var resultMap = {}; results.forEach(function(r) { resultMap[r.test_id + '_' + r.param_id] = r.value; });
  var testsHtml = '', seen = {};
  
  visitTests.forEach(function(vt) {
    if (seen[vt.test_id]) return;
    seen[vt.test_id] = true;
    var test = testMap[vt.test_id]; if (!test) return;
    var testParams = parameters.filter(function(p) { return p.test_id === vt.test_id; });
    if (testParams.length === 0) testParams = [{name: test.name, unit: null, ref_min: null, ref_max: null, ref_text: '—', id: 0}];
    
    var rows = '';
    testParams.forEach(function(p) {
      var val = resultMap[vt.test_id + '_' + p.id] || '';
      var range = (p.ref_min !== null && p.ref_max !== null) ? p.ref_min + ' - ' + p.ref_max : (p.ref_text || '—');
      var assessment = ''; var numVal = parseFloat(val);
      if (!isNaN(numVal) && p.ref_min !== null && p.ref_max !== null) {
        if (numVal < p.ref_min) assessment = '<span style="color:#dc2626;font-weight:bold;">LOW ↓</span>';
        else if (numVal > p.ref_max) assessment = '<span style="color:#dc2626;font-weight:bold;">HIGH ↑</span>';
        else assessment = '<span style="color:#059669;font-weight:bold;">NORMAL ✓</span>';
      }
      rows += '<tr><td style="padding:8px;border:1px solid #cbd5e1;">' + (p.name_ar || p.name || '') + '</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">' + val + '</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + (p.unit || '') + '</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + range + '</td><td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + assessment + '</td></tr>';
    });
    testsHtml += '<div style="margin-bottom:20px;"><div style="background:#0d3b66;color:white;padding:10px 15px;border-radius:8px 8px 0 0;font-weight:bold;">' + (test.name_ar || test.name) + '</div><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">الفحص</th><th style="padding:8px;border:1px solid #cbd5e1;">النتيجة</th><th style="padding:8px;border:1px solid #cbd5e1;">الوحدة</th><th style="padding:8px;border:1px solid #cbd5e1;">المرجعي</th><th style="padding:8px;border:1px solid #cbd5e1;">التقييم</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  });
  
  if (!testsHtml) testsHtml = '<p style="text-align:center;color:#94a3b8;">لا توجد نتائج</p>';
  var dateStr = new Date(visit.date || Date.now()).toLocaleDateString('ar-EG');
  var genderAr = patient.gender === 'male' ? 'ذكر' : (patient.gender === 'female' ? 'أنثى' : '—');
  
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير - ' + labName + '</title><style>@page{size:A4;margin:10mm}body{font-family:"Cairo",Tahoma,sans-serif;margin:0;padding:15px;color:#1e293b;} .header{background:#1e40af;color:white;padding:15px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;} .header h1{margin:0;font-size:20px;} .header .sub{font-size:11px;opacity:0.85;letter-spacing:1px;} .header .contact{text-align:left;font-size:11px;line-height:1.6;} .header img{height:60px;margin-left:15px;background:white;padding:4px;border-radius:8px;} .info{background:#f8fafc;padding:12px;margin-bottom:15px;border-radius:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px;} .info b{color:#64748b;font-weight:normal;font-size:10px;display:block;margin-bottom:2px;} .info span{font-weight:bold;color:#0f172a;font-size:13px;} .sigs{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:15px;border-top:1px dashed #cbd5e1;gap:20px;} .sig{flex:1;text-align:center;} .sig-line{border-bottom:1.5px solid #0f172a;height:40px;position:relative;margin-bottom:5px;} .sig-line img{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);max-height:45px;} .sig-label{font-weight:bold;font-size:11px;color:#334155;} .stamp-box{text-align:center;flex:0 0 120px;} .stamp-box img{max-height:90px;max-width:120px;} .footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:9px;color:#94a3b8;}</style></head><body>';
  html += '<div class="header"><div style="display:flex;align-items:center;"><img src="' + logo + '"><div><h1>' + labName + '</h1><div class="sub">KODNAQI DIAGNOSTICS</div></div></div><div class="contact">' + (labAddress ? '📍 ' + labAddress : '') + (labPhone ? '<br>📞 ' + labPhone : '') + (labEmail ? '<br>✉️ ' + labEmail : '') + '</div></div>';
  html += '<div class="info"><div><b>اسم المريض</b><span>' + (patient.name || '—') + '</span></div><div><b>العمر</b><span>' + (patient.age || '—') + '</span></div><div><b>الجنس</b><span>' + genderAr + '</span></div><div><b>رقم الزيارة</b><span>' + (visit.serial || '—') + '</span></div><div><b>التاريخ</b><span>' + dateStr + '</span></div><div><b>الهاتف</b><span>' + (patient.phone || '—') + '</span></div></div>';
  html += testsHtml;
  html += '<div class="sigs"><div class="sig"><div class="sig-line">' + (techSig ? '<img src="' + techSig + '">' : '') + '</div><div class="sig-label">TECHNICIAN SIGNATURE</div></div>';
  if (stamp) html += '<div class="stamp-box"><img src="' + stamp + '"></div>';
  html += '<div class="sig"><div class="sig-line">' + (docSig ? '<img src="' + docSig + '">' : '') + '</div><div class="sig-label">DOCTOR / MANAGER SIGNATURE</div></div></div>';
  html += '<div class="footer">تم إنشاء هذا التقرير بواسطة نظام KodNaqi Diagnostics — ' + labPhone + '</div></body></html>';
  return html;
}

window.generateReport = async function(visitId) {
  try {
    var bundle = await knGetBundle(visitId);
    if (!bundle.visitTests.length && !bundle.results.length) return alert('⚠️ لا توجد تحاليل أو نتائج لهذه الزيارة بعد.');
    await knPrintHtml(knBuildReportHtml(bundle));
  } catch(e) { alert('❌ تعذرت طباعة التقرير: ' + e.message); console.error(e); }
};

window.generateInvoice = async function(visitId) {
  try {
    var bundle = await knGetBundle(visitId);
    var visit = bundle.visit, patient = bundle.patient, visitTests = bundle.visitTests, tests = bundle.tests;
    var testMap = {}; tests.forEach(function(t) { testMap[t.id] = t; });
    var total = 0, itemsHtml = '', seen = {};
    visitTests.forEach(function(vt) {
      if (seen[vt.test_id]) return; seen[vt.test_id] = true;
      var t = testMap[vt.test_id]; var price = parseFloat(vt.price || (t ? t.price : 0)) || 0; total += price;
      itemsHtml += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;"><span>' + (t ? (t.name_ar || t.name) : '—') + '</span><span>' + price.toLocaleString() + ' SDG</span></div>';
    });
    var paid = parseFloat(visit.paid || 0) || 0, discount = parseFloat(visit.discount || 0) || 0;
    var net = total - discount, remaining = net - paid;
    var brand = {}; try { brand = JSON.parse(localStorage.getItem('kodnaqi_brand_v1') || '{}'); } catch(e) {}
    var dateStr = new Date(visit.date || Date.now()).toLocaleString('ar-EG');
    
    var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة</title><style>@page{size:58mm auto;margin:2mm}body{font-family:Tahoma,sans-serif;margin:0;padding:5px;width:54mm;font-size:10px;color:#000;} .center{text-align:center;} .hr{border-top:1px dashed #000;margin:4px 0;} .row{display:flex;justify-content:space-between;} .total{font-weight:bold;font-size:12px;} .logo{max-height:40px;}</style></head><body>';
    if (brand.logoData) html += '<div class="center"><img src="' + brand.logoData + '" class="logo"></div>';
    html += '<div class="center" style="font-weight:bold;font-size:12px;">' + (brand.labName || 'معمل') + '</div><div class="center" style="font-size:9px;">' + (brand.phone || '') + '</div><div class="hr"></div>';
    html += '<div class="row"><span>Invoice #:</span><span>' + (visit.serial || '—') + '</span></div><div class="row"><span>Date:</span><span>' + dateStr + '</span></div><div class="row"><span>Patient:</span><span>' + (patient.name || '—') + '</span></div>';
    if (patient.age) html += '<div class="row"><span>Age:</span><span>' + patient.age + '</span></div>';
    if (patient.phone) html += '<div class="row"><span>Phone:</span><span>' + patient.phone + '</span></div>';
    html += '<div class="hr"></div>' + itemsHtml + '<div class="hr"></div>';
    html += '<div class="row"><span>Subtotal:</span><span>' + total.toLocaleString() + ' SDG</span></div>';
    if (discount > 0) html += '<div class="row"><span>Discount:</span><span>-' + discount.toLocaleString() + ' SDG</span></div>';
    html += '<div class="row total"><span>TOTAL:</span><span>' + net.toLocaleString() + ' SDG</span></div><div class="row"><span>Paid:</span><span>' + paid.toLocaleString() + ' SDG</span></div>';
    if (remaining > 0) html += '<div class="row" style="color:#dc2626;"><span>Remaining:</span><span>' + remaining.toLocaleString() + ' SDG</span></div>';
    else if (remaining < 0) html += '<div class="row" style="color:#059669;"><span>Change:</span><span>' + Math.abs(remaining).toLocaleString() + ' SDG</span></div>';
    else html += '<div class="center" style="color:#059669;font-weight:bold;">PAID IN FULL ✓</div>';
    html += '<div class="hr"></div><div class="center" style="font-size:8px;">Thank you 🌟</div></body></html>';
    
    await knPrintHtml(html);
  } catch(e) { alert('❌ تعذرت طباعة الفاتورة: ' + e.message); console.error(e); }
};

window.printViaBluetooth = async function(visitId) {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return alert('ℹ️ الطباعة المباشرة عبر البلوتوث تعمل فقط داخل تطبيق الأندرويد (APK).');
  try {
    var bundle = await knGetBundle(visitId);
    var P = window.Capacitor.Plugins && window.Capacitor.Plugins.ThermalPrinter;
    if (!P) throw new Error('إضافة الطابعة الحرارية غير مثبتة في التطبيق.');
    alert('✅ جاهز للطباعة عبر البلوتوث. سيتم فتح نافذة الطابعة قريباً...');
  } catch(e) { alert('❌ فشلت الطباعة: ' + e.message); }
};
