/*! KNPrint — Clean Printing Engine v1.0 */
(function() {
  'use strict';

  if (typeof html2canvas === 'undefined') {
    var _s = document.createElement('script');
    _s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(_s);
  }

  function fmtDate(x, withTime) {
    var d = new Date(x || Date.now());
    if (isNaN(d)) return '';
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var t = pad(d.getDate()) + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
    if (!withTime) return t;
    var use12 = false;
    var h = d.getHours(), mi = pad(d.getMinutes());
    if (!use12) return t + ', ' + pad(h) + ':' + mi;
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return t + ', ' + pad(h) + ':' + mi + ' ' + ap;
  }

  function normId(id) { var n = Number(id); return isNaN(n) ? id : n; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  async function getSafe(s, id) { try { return await dbGet(s, normId(id)); } catch(e) { return null; } }
  async function getByIndexSafe(s, i, v) {
    try {
      var r = await dbGetByIndex(s, i, normId(v));
      return Array.isArray(r) ? r : (r ? [r] : []);
    } catch(e) { return []; }
  }
  async function getAllSafe(s) { try { return arr(await dbGetAll(s)); } catch(e) { return []; } }

  function getBrand() {
    try {
      var keys = ['kodnaqi_brand_v1', 'kodnaqi_brand', 'brand', 'kodnaqi_brand_data'];
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (raw) {
          var p = JSON.parse(raw);
          if (p && (p.labName || p.stampData)) return p;
        }
      }
    } catch(e) {}
    return {};
  }

  async function fetchBundle(visitId) {
    var id = normId(visitId);
    var visit = await getSafe('visits', id);
    if (!visit) throw new Error('الزيارة غير موجودة');
    var patient = visit.patient_id ? await getSafe('patients', visit.patient_id) : null;
    var visitTests = await getByIndexSafe('visit_tests', 'visit_id', id);
    var tests = await getAllSafe('tests');
    var parameters = await getAllSafe('parameters');
    var results = await getByIndexSafe('results', 'visit_id', id);
    return { visit: visit, patient: patient || {}, visitTests: visitTests, tests: tests, parameters: parameters, results: results, brand: getBrand() };
  }

  function genderEn(g) {
    var x = String(g == null ? '' : g).trim().toLowerCase();
    if (x === 'male' || x === 'm' || x === 'ذكر') return 'Male';
    if (x === 'female' || x === 'f' || x === 'أنثى' || x === 'انثى') return 'Female';
    return '—';
  }

  function qrPayload(b) {
    var v = b.visit || {}, p = b.patient || {};
    var d = new Date(v.date || Date.now());
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ds = isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var lines = ['KodNaqi Diagnostics', 'Visit: ' + (v.serial || ('KN-V-' + v.id))];
    if (p.serial) lines.push('File: ' + p.serial);
    if (ds) lines.push('Date: ' + ds);
    return lines.join('\n');
  }

  function makeQR(text) {
    try {
      if (typeof QRCode === 'undefined' || !text) return '';
      var d = document.createElement('div');
      new QRCode(d, { text: String(text), width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M });
      var c = d.querySelector('canvas');
      if (c) return c.toDataURL('image/png');
      var im = d.querySelector('img');
      return im ? im.src : '';
    } catch (e) { return ''; }
  }

  function makeBarcode(text) {
    try {
      if (typeof JsBarcode === 'undefined' || !text) return '';
      var c = document.createElement('canvas');
      JsBarcode(c, String(text), { format: 'CODE128', width: 2, height: 50, displayValue: false, margin: 0 });
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function buildReportHTML(b) {
    var v = b.visit, p = b.patient, vt = b.visitTests, t = b.tests, pr = b.parameters, r = b.results, br = b.brand;
    var logo = br.logoData || './logo.png';
    var stamp = br.stampData || '';
    var techSig = br.techSignatureData || '';
    var docSig = br.doctorSignatureData || '';
    
    var testMap = {}, paramMap = {}, resultMap = {};
    for (var i = 0; i < t.length; i++) testMap[t[i].id] = t[i];
    for (var i = 0; i < pr.length; i++) paramMap[pr[i].id] = pr[i];
    for (var i = 0; i < r.length; i++) resultMap[r[i].test_id + '_' + r[i].param_id] = r[i].value;
    
    var testsHTML = '';
    var seen = {};
    for (var i = 0; i < vt.length; i++) {
      var testId = vt[i].test_id;
      if (seen[testId]) continue;
      seen[testId] = true;
      
      var test = testMap[testId];
      if (!test) continue;
      
      var testParams = pr.filter(function(x) { return x.test_id === testId; });
      if (testParams.length === 0) testParams = [{ name: test.name, unit: null, ref_min: null, ref_max: null, ref_text: '—', id: 0 }];
      
      var rows = '';
      for (var j = 0; j < testParams.length; j++) {
        var par = testParams[j];
        var val = resultMap[testId + '_' + par.id] || '';
        var range = (par.ref_min !== null && par.ref_max !== null) ? (par.ref_min + ' - ' + par.ref_max) : (par.ref_text || '—');
        var assess = '';
        var numVal = parseFloat(val);
        if (!isNaN(numVal) && par.ref_min !== null && par.ref_max !== null) {
          if (numVal < par.ref_min) assess = '<span style="color:#dc2626;font-weight:bold;">LOW ↓</span>';
          else if (numVal > par.ref_max) assess = '<span style="color:#dc2626;font-weight:bold;">HIGH ↑</span>';
          else assess = '<span style="color:#059669;font-weight:bold;">NORMAL ✓</span>';
        }
        rows += '<tr>' +
          '<td style="padding:8px;border:1px solid #cbd5e1;">' + (par.name || par.name_ar || '') + '</td>' +
          '<td style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">' + val + '</td>' +
          '<td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + (par.unit || '') + '</td>' +
          '<td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + range + '</td>' +
          '<td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + assess + '</td>' +
        '</tr>';
      }
      
      testsHTML += '<div style="margin-bottom:20px;">' +
        '<div style="background:#0d3b66;color:white;padding:10px 15px;border-radius:8px 8px 0 0;font-weight:bold;">' + (test.name || test.name_ar) + '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead><tr style="background:#f1f5f9;">' +
            '<th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">Test</th>' +
            '<th style="padding:8px;border:1px solid #cbd5e1;">Result</th>' +
            '<th style="padding:8px;border:1px solid #cbd5e1;">Unit</th>' +
            '<th style="padding:8px;border:1px solid #cbd5e1;">Reference</th>' +
            '<th style="padding:8px;border:1px solid #cbd5e1;">Flag</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>';
    }
    
    if (!testsHTML) testsHTML = '<p style="text-align:center;color:#94a3b8;">No results</p>';
    
    var dateStr = fmtDate(v.date);
    var genderAr = genderEn(p.gender);
    var labName = br.labName || 'KodNaqi';
    var labPhone = br.phone || '';
    var labAddress = br.address || '';
    var labEmail = br.email || '';
    
    var css = '@page{size:A4;margin:10mm}body{font-family:"Cairo",Tahoma,sans-serif;margin:0;padding:15px;color:#1e293b;}' +
      '.header{background:#1e40af;color:white;padding:15px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;}' +
      '.header h1{margin:0;font-size:20px;}.header .sub{font-size:11px;opacity:0.85;letter-spacing:1px;}' +
      '.header .contact{text-align:left;font-size:11px;line-height:1.6;}' +
      '.header img{height:60px;margin-left:15px;background:white;padding:4px;border-radius:8px;}' +
      '.info{background:#f8fafc;padding:12px;margin-bottom:15px;border-radius:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px;}' +
      '.info b{color:#64748b;font-weight:normal;font-size:10px;display:block;margin-bottom:2px;}' +
      '.info span{font-weight:bold;color:#0f172a;font-size:13px;}' +
      '.sigs{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;padding-top:15px;border-top:1px dashed #cbd5e1;gap:20px;}' +
      '.sig{flex:1;text-align:center;}' +
      '.sig-line{border-bottom:1.5px solid #0f172a;height:40px;position:relative;margin-bottom:5px;}' +
      '.sig-line img{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);max-height:45px;}' +
      '.sig-label{font-weight:bold;font-size:11px;color:#334155;}' +
      '.stamp-box{text-align:center;flex:0 0 120px;}' +
      '.stamp-box img{max-height:90px;max-width:120px;}' +
      '.footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:9px;color:#94a3b8;}';
    
    var html = '<!DOCTYPE html><html dir="ltr"><head><meta charset="utf-8"><title>Report - ' + labName + '</title><style>' + css + '</style></head><body>';
    html += '<div class="header">' +
      '<div style="display:flex;align-items:center;">' +
        '<img src="' + logo + '">' +
        '<div><h1>' + labName + '</h1><div class="sub">KODNAQI DIAGNOSTICS</div></div>' +
      '</div>' +
      '<div class="contact">' + (labAddress ? '📍 ' + labAddress + '<br>' : '') + (labPhone ? '📞 ' + labPhone : '') + (labEmail ? '<br>✉️ ' + labEmail : '') + '</div>' +
    '</div>';
    html += '<div class="info">' +
      '<div><b>Patient Name</b><span>' + (p.name || '—') + '</span></div>' +
      '<div><b>Age</b><span>' + (p.age || '—') + '</span></div>' +
      '<div><b>Gender</b><span>' + genderAr + '</span></div>' +
      '<div><b>Visit No.</b><span>' + (v.serial || '—') + '</span></div>' +
      '<div><b>Date</b><span>' + dateStr + '</span></div>' +
      '<div><b>Phone</b><span>' + (p.phone || '—') + '</span></div>' +
    '</div>';
    html += testsHTML;
    html += '<div class="sigs">' +
      '<div class="sig"><div class="sig-line">' + (techSig ? '<img src="' + techSig + '">' : '') + '</div><div class="sig-label">TECHNICIAN SIGNATURE</div></div>';
    if (stamp) html += '<div class="stamp-box"><img src="' + stamp + '"></div>';
    html += '<div class="sig"><div class="sig-line">' + (docSig ? '<img src="' + docSig + '">' : '') + '</div><div class="sig-label">DOCTOR / MANAGER SIGNATURE</div></div>' +
    '</div>';
    html += '<div class="footer">Report generated by KodNaqi Diagnostics</div>';
    html += '</body></html>';
    
    return html;
  }

  function buildInvoiceHTML(b) {
    var v = b.visit, p = b.patient, vt = b.visitTests, t = b.tests, br = b.brand;
    var logo = br.logoData || './logo.png';
    var labName = br.labName || 'KodNaqi';
    var labPhone = br.phone || '';
    
    var testMap = {};
    for (var i = 0; i < t.length; i++) testMap[t[i].id] = t[i];
    
    var itemsHTML = '';
    var total = 0;
    var seen = {};
    for (var i = 0; i < vt.length; i++) {
      var testId = vt[i].test_id;
      if (seen[testId]) continue;
      seen[testId] = true;
      var test = testMap[testId];
      var price = parseFloat(vt[i].price || (test ? test.price : 0)) || 0;
      total += price;
      itemsHTML += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;">' +
        '<span>' + (test ? (test.name || test.name_ar) : '—') + '</span>' +
        '<span>' + price.toLocaleString() + ' SDG</span>' +
      '</div>';
    }
    
    var paid = parseFloat(v.paid || 0) || 0;
    var discount = parseFloat(v.discount || 0) || 0;
    var net = total - discount;
    var remaining = net - paid;
    var dateStr = fmtDate(Date.now(), true);
    
    var css = '@page{size:58mm auto;margin:2mm}body{font-family:Tahoma,sans-serif;margin:0 auto;padding:5px;width:54mm;font-size:10px;color:#000;}' +
      '.center{text-align:center;}' +
      '.hr{border-top:1px dashed #000;margin:4px 0;}' +
      '.row{display:flex;justify-content:space-between;}' +
      '.total{font-weight:bold;font-size:12px;}' +
      '.logo{max-height:40px;}';
    
    var html = '<!DOCTYPE html><html dir="ltr"><head><meta charset="utf-8"><title>Invoice</title><style>' + css + '</style></head><body>';
    if (logo) html += '<div class="center"><img src="' + logo + '" class="logo"></div>';
    html += '<div class="center" style="font-weight:bold;font-size:12px;">' + labName + '</div>';
    html += '<div class="center" style="font-size:9px;">' + labPhone + '</div>';
    html += '<div class="hr"></div>';
    html += '<div class="row"><span>Invoice #:</span><span>' + (v.serial || '—') + '</span></div>';
    html += '<div class="row"><span>Date:</span><span>' + dateStr + '</span></div>';
    html += '<div class="row"><span>Patient:</span><span>' + (p.name || '—') + '</span></div>';
    if (p.age) html += '<div class="row"><span>Age:</span><span>' + p.age + '</span></div>';
    if (p.phone) html += '<div class="row"><span>Phone:</span><span>' + p.phone + '</span></div>';
    html += '<div class="hr"></div>';
    html += itemsHTML;
    html += '<div class="hr"></div>';
    html += '<div class="row"><span>Subtotal:</span><span>' + total.toLocaleString() + ' SDG</span></div>';
    if (discount > 0) html += '<div class="row"><span>Discount:</span><span>-' + discount.toLocaleString() + ' SDG</span></div>';
    html += '<div class="row total"><span>TOTAL:</span><span>' + net.toLocaleString() + ' SDG</span></div>';
    html += '<div class="row"><span>Paid:</span><span>' + paid.toLocaleString() + ' SDG</span></div>';
    if (remaining > 0) html += '<div class="row" style="color:#dc2626;"><span>Remaining:</span><span>' + remaining.toLocaleString() + ' SDG</span></div>';
    else if (remaining < 0) html += '<div class="row" style="color:#059669;"><span>Change:</span><span>' + Math.abs(remaining).toLocaleString() + ' SDG</span></div>';
    else html += '<div class="center" style="color:#059669;font-weight:bold;">PAID IN FULL ✓</div>';
    html += '<div class="hr"></div>';
    var qrI = makeQR(qrPayload(b));
    if (qrI) html += '<div class="center" style="margin-top:4px;"><img src="' + qrI + '" style="width:34mm;height:34mm;"></div>';
    var bcI = makeBarcode(v.serial);
    if (bcI) html += '<div class="center" style="margin-top:4px;"><img src="' + bcI + '" style="width:48mm;height:12mm;"></div><div class="center" style="font-size:9px;letter-spacing:1px;">' + (v.serial || '') + '</div>';
    html += '<div class="center" style="font-size:8px;">Thank you 🌟</div>';
    html += '</body></html>';
    
    return html;
  }

  function printHtmlViaIframe(html) {
    return new Promise(function(resolve) {
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      iframe.srcdoc = html;
      iframe.onload = function() {
        setTimeout(function() {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch(e) {
            console.warn('Print failed, will fallback:', e);
          }
          setTimeout(function() {
            iframe.remove();
            resolve(true);
          }, 2000);
        }, 500);
      };
      document.body.appendChild(iframe);
    });
  }

  async function printHtmlViaPdfFallback(html, filename) {
    if (typeof html2canvas === 'undefined') {
      alert('مكتبة الطباعة لم تُحمّل بعد. انتظر ثوانٍ وحاول مجدداً.');
      return false;
    }
    try {
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;background:white;';
      document.body.appendChild(wrapper);
      
      var canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      wrapper.remove();
      
      var printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>' + (filename || 'Print') + '</title></head><body style="margin:0;"><img src="' + imgData + '" style="width:100%;" onload="window.print();"></body></html>');
        printWindow.document.close();
      }
      return true;
    } catch(e) {
      console.error('PDF fallback failed:', e);
      alert('فشلت الطباعة: ' + e.message);
      return false;
    }
  }

  async function doPrint(html, filename) {
    try {
      await printHtmlViaIframe(html);
      return true;
    } catch(e) {
      console.warn('Iframe failed, trying PDF fallback');
      return await printHtmlViaPdfFallback(html, filename);
    }
  }

  window.generateReport = async function(visitId) {
    try {
      if (!visitId) return alert('⚠️ خطأ: رقم الزيارة غير موجود.');
      var bundle = await fetchBundle(visitId);
      if (!bundle.visitTests.length && !bundle.results.length) {
        return alert('⚠️ لا توجد تحاليل أو نتائج لهذه الزيارة بعد.');
      }
      var html = buildReportHTML(bundle);
      await doPrint(html, 'Report_' + visitId + '.pdf');
    } catch(e) {
      alert('❌ تعذرت طباعة التقرير: ' + e.message);
      console.error(e);
    }
  };

  window.generateInvoice = async function(visitId) {
    try {
      if (!visitId) return alert('⚠️ خطأ: رقم الزيارة غير موجود.');
      var bundle = await fetchBundle(visitId);
      var html = buildInvoiceHTML(bundle);
      await doPrint(html, 'Invoice_' + visitId + '.pdf');
    } catch(e) {
      alert('❌ تعذرت طباعة الفاتورة: ' + e.message);
      console.error(e);
    }
  };

  window.printViaBluetooth = async function(visitId) {
    var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!isNative) {
      return alert('ℹ️ الطباعة المباشرة عبر البلوتوث تعمل فقط داخل تطبيق الأندرويد (APK).\n\nفي المتصفح، استخدم زر "طباعة الفاتورة" الذي يفتح نافذة الطباعة العادية.');
    }
    try {
      var bundle = await fetchBundle(visitId);
      var P = window.Capacitor.Plugins && window.Capacitor.Plugins.ThermalPrinter;
      if (!P) {
        return alert('⚠️ إضافة الطابعة الحرارية غير مثبتة.\nيرجى التواصل مع المطور.');
      }
      var html = buildInvoiceHTML(bundle);
      await P.print({ data: btoa(unescape(encodeURIComponent(html))) });
    } catch(e) {
      alert('❌ فشلت الطباعة: ' + e.message);
      console.error(e);
    }
  };

  window.KNPrint = {
    generateReport: window.generateReport,
    generateInvoice: window.generateInvoice,
    printViaBluetooth: window.printViaBluetooth,
    fetchBundle: fetchBundle,
    buildReportHTML: buildReportHTML,
    buildInvoiceHTML: buildInvoiceHTML
  };

  console.log('[KNPrint] Engine v1.0 loaded');
})();
