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

  async function toDataUrl(url) {
    try {
      var r = await fetch(url);
      if (!r.ok) return '';
      var bl = await r.blob();
      return await new Promise(function (res) {
        var fr = new FileReader();
        fr.onloadend = function () { res(String(fr.result || '')); };
        fr.readAsDataURL(bl);
      });
    } catch (e) { return ''; }
  }

  async function withLogo(br) {
    br = br || {};
    if (!br.logoData) {
      var d = await toDataUrl('./logo.png');
      if (d) br.logoData = d;
    }
    return br;
  }

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
    return { visit: visit, patient: patient || {}, visitTests: visitTests, tests: tests, parameters: parameters, results: results, brand: await withLogo(getBrand()) };
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

  function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function knPrintPlugin() {
    var C = window.Capacitor;
    if (!C) return null;
    if (C.Plugins && C.Plugins.KNPrint) return C.Plugins.KNPrint;
    if (typeof C.registerPlugin === 'function') {
      try { return C.registerPlugin('KNPrint'); } catch (e) {}
    }
    return null;
  }

  async function doPrint(html, filename, opts) {
    if (isNativeApp()) {
      var K = knPrintPlugin();
      if (K) {
        try {
          var args = { html: html, jobName: String(filename || 'KodNaqi').replace(/\.pdf$/i, '') };
          if (opts && opts.widthMm) { args.widthMm = opts.widthMm; args.heightMm = opts.heightMm; }
          await K.printHtml(args);
          return true;
        } catch (e) {
          console.warn('native print failed', e);
          alert('تعذر فتح نافذة الطباعة: ' + ((e && e.message) || e));
          return false;
        }
      }
    }
    return await doPrintWeb(html, filename);
  }

  async function doPrintWeb(html, filename) {
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
      await doPrint(html, 'Invoice_' + visitId + '.pdf', { widthMm: 58, heightMm: 200 });
    } catch(e) {
      alert('❌ تعذرت طباعة الفاتورة: ' + e.message);
      console.error(e);
    }
  };

  // ===== Bluetooth thermal printing (ESC/POS raster image) =====
  var BT_PRINT_WIDTH = 384;
  var BT_SHOW_LOGO = false;
  var BT_KEY = 'kn_bt_printer';

  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = function () { res(null); };
      i.src = src;
    });
  }

  function invoiceModel(b) {
    var tm = {}, seen = {}, items = [], total = 0;
    arr(b.tests).forEach(function (t) { tm[t.id] = t; });
    arr(b.visitTests).forEach(function (x) {
      if (seen[x.test_id]) return;
      seen[x.test_id] = true;
      var t = tm[x.test_id];
      var price = parseFloat(x.price || (t ? t.price : 0)) || 0;
      total += price;
      items.push({ name: t ? (t.name || t.name_ar || '-') : '-', price: price });
    });
    var v = b.visit || {};
    var paid = parseFloat(v.paid || 0) || 0;
    var discount = parseFloat(v.discount || 0) || 0;
    var net = total - discount;
    return { items: items, total: total, discount: discount, net: net, paid: paid, remaining: net - paid };
  }

  async function renderInvoiceCanvas(b) {
    var W = BT_PRINT_WIDTH, M = 6, FONT = 'Tahoma, Arial, sans-serif';
    var m = invoiceModel(b), v = b.visit || {}, p = b.patient || {}, br = b.brand || {};
    var vcode = v.serial || ('KN-V-' + v.id);
    var tall = document.createElement('canvas');
    tall.width = W; tall.height = 3000;
    var c = tall.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, tall.height);
    c.fillStyle = '#000'; c.strokeStyle = '#000'; c.textBaseline = 'top';
    var y = 6;
    function font(size, bold) { c.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; }
    function fit(t, max) {
      t = String(t);
      if (c.measureText(t).width <= max) return t;
      while (t.length > 1 && c.measureText(t + '..').width > max) t = t.slice(0, -1);
      return t + '..';
    }
    function center(t, size, bold) {
      font(size, bold); c.textAlign = 'center';
      c.fillText(fit(t, W - 2 * M), W / 2, y); y += size + 8;
    }
    function row(l, r, size, bold, fitLeft) {
      font(size, bold);
      l = String(l); r = String(r);
      var lw = c.measureText(l).width, rw = c.measureText(r).width;
      if (fitLeft) l = fit(l, W - 2 * M - rw - 10); else r = fit(r, W - 2 * M - lw - 10);
      c.textAlign = 'left'; c.fillText(l, M, y);
      c.textAlign = 'right'; c.fillText(r, W - M, y);
      y += size + 8;
    }
    function dash() {
      c.setLineDash([4, 3]); c.lineWidth = 1; c.beginPath();
      c.moveTo(M, y + 3); c.lineTo(W - M, y + 3); c.stroke(); c.setLineDash([]); y += 10;
    }
    function num(n) { return n.toLocaleString('en-US') + ' SDG'; }

    if (BT_SHOW_LOGO) {
      var lg = await loadImg(br.logoData || './logo.png');
      if (lg) {
        var lh = 56, lwid = lg.width * lh / lg.height;
        c.drawImage(lg, (W - lwid) / 2, y, lwid, lh); y += lh + 8;
      }
    }
    center(br.labName || 'KodNaqi', 24, true);
    if (br.phone) center(br.phone, 18, false);
    dash();
    row('Invoice #:', vcode, 20, false, false);
    row('Date:', fmtDate(Date.now(), true), 20, false, false);
    row('Patient:', p.name || '-', 20, true, false);
    if (p.age) row('Age:', p.age, 20, false, false);
    if (p.phone) row('Phone:', p.phone, 20, false, false);
    dash();
    m.items.forEach(function (it) { row(it.name, num(it.price), 20, false, true); });
    dash();
    row('Subtotal:', num(m.total), 20, false, false);
    if (m.discount > 0) row('Discount:', '-' + num(m.discount), 20, false, false);
    row('TOTAL:', num(m.net), 26, true, false);
    row('Paid:', num(m.paid), 20, false, false);
    if (m.remaining > 0) row('Remaining:', num(m.remaining), 22, true, false);
    else if (m.remaining < 0) row('Change:', num(Math.abs(m.remaining)), 20, false, false);
    else center('PAID IN FULL', 22, true);
    dash();

    var qr = await loadImg(makeQR(qrPayload(b)));
    if (qr) { c.drawImage(qr, Math.round((W - qr.width) / 2), y); y += qr.height + 8; }
    var bc = await loadImg(makeBarcode(vcode));
    if (bc) {
      var bw = Math.min(bc.width, W);
      c.drawImage(bc, Math.round((W - bw) / 2), y, bw, bc.height); y += bc.height + 6;
    }
    center(vcode, 18, false);
    center('Thank you', 18, false);
    y += 6;

    var out = document.createElement('canvas');
    out.width = W; out.height = Math.ceil(y);
    var oc = out.getContext('2d');
    oc.fillStyle = '#fff'; oc.fillRect(0, 0, W, out.height);
    oc.drawImage(tall, 0, 0);
    return out;
  }

  function canvasToEscPos(canvas) {
    var w = canvas.width, h = canvas.height;
    var px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var bpr = Math.ceil(w / 8);
    var out = [0x1B, 0x40];
    var BAND = 128;
    for (var y0 = 0; y0 < h; y0 += BAND) {
      var rows = Math.min(BAND, h - y0);
      out.push(0x1D, 0x76, 0x30, 0x00, bpr & 255, bpr >> 8, rows & 255, rows >> 8);
      for (var y = y0; y < y0 + rows; y++) {
        for (var xb = 0; xb < bpr; xb++) {
          var bt = 0;
          for (var bit = 0; bit < 8; bit++) {
            var x = xb * 8 + bit;
            if (x < w) {
              var i = (y * w + x) * 4;
              var lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
              if (px[i + 3] > 127 && lum < 150) bt |= (0x80 >> bit);
            }
          }
          out.push(bt);
        }
      }
    }
    out.push(0x1B, 0x64, 0x04);
    return new Uint8Array(out);
  }

  function bytesToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function btPlugin() {
    var C = window.Capacitor;
    if (!C) return null;
    if (C.Plugins && C.Plugins.ThermalPrinter) return C.Plugins.ThermalPrinter;
    if (typeof C.registerPlugin === 'function') {
      try { return C.registerPlugin('ThermalPrinter'); } catch (e) {}
    }
    return null;
  }

  function btErrorMessage(e) {
    var code = e && e.code;
    var map = {
      unavailable: 'البلوتوث غير متاح على هذا الجهاز',
      not_found: 'الطابعة غير موجودة. تأكد من تشغيلها ومن اقترانها بالهاتف',
      permission_denied: 'لم يتم منح إذن البلوتوث. اسمح به من إعدادات التطبيق',
      connect_failed: 'تعذر الاتصال بالطابعة. تأكد أنها مشغلة ومتصلة (واي فاي: على نفس الشبكة، بلوتوث: قريبة وغير متصلة بجهاز آخر)',
      write_failed: 'انقطع الاتصال أثناء الطباعة. أعد المحاولة',
      invalid_data: 'بيانات الطباعة غير صالحة',
      invalid_transport: 'نوع الاتصال غير صحيح'
    };
    return map[code] || (e && e.message) || String(e);
  }

  async function pickBtPrinter(P) {
    var res = await P.list({ transport: 'bluetooth' });
    var devs = arr(res && res.devices);
    if (!devs.length) throw new Error('لا توجد طابعة مقترنة. اقترن بالطابعة أولا من إعدادات البلوتوث في الهاتف.');
    var saved = '';
    try { saved = localStorage.getItem(BT_KEY) || ''; } catch (e) {}
    var chosen = devs.filter(function (d) { return d.address === saved; })[0];
    if (!chosen && devs.length === 1) chosen = devs[0];
    if (!chosen) {
      var msg = 'اختر رقم الطابعة:\n' + devs.map(function (d, i) { return (i + 1) + ') ' + (d.name || d.address); }).join('\n');
      chosen = devs[(parseInt(window.prompt(msg, '1'), 10) || 0) - 1];
    }
    if (!chosen) throw new Error('لم يتم اختيار طابعة');
    try { localStorage.setItem(BT_KEY, chosen.address); } catch (e) {}
    return chosen;
  }

  function showBtPreview(canvas) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.8);overflow:auto;padding:12px;text-align:center;';
    d.innerHTML = '<div style="color:#fff;font:14px sans-serif;margin-bottom:8px;direction:rtl">معاينة شكل الطباعة الحرارية. الطباعة الفعلية عبر البلوتوث تعمل داخل تطبيق APK فقط. اضغط للإغلاق.</div>';
    var im = new Image();
    im.src = canvas.toDataURL('image/png');
    im.style.cssText = 'background:#fff;max-width:100%;';
    d.appendChild(im);
    d.onclick = function () { d.remove(); };
    document.body.appendChild(d);
  }

  function getPrinterCfg() {
    try { return JSON.parse(localStorage.getItem('kn_thermal_cfg') || 'null'); } catch (e) { return null; }
  }

  function savePrinterCfg(c) {
    try { localStorage.setItem('kn_thermal_cfg', JSON.stringify(c)); } catch (e) {}
  }

  window.KNPrinterSetup = function () {
    return new Promise(function (resolve) {
      var cfg = getPrinterCfg() || { type: 'bluetooth', port: 9100 };
      var native = isNativeApp();
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;direction:rtl;font-family:Tahoma,sans-serif;';
      var inp = 'width:100%;padding:8px;margin-top:6px;box-sizing:border-box;border:1px solid #ccc;border-radius:6px;font-size:15px;';
      d.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:16px;width:100%;max-width:380px;color:#111;">' +
        '<div style="font-weight:bold;font-size:17px;margin-bottom:10px;">إعداد الطابعة الحرارية</div>' +
        '<label style="margin-left:16px;"><input type="radio" name="knp-type" value="bluetooth"> بلوتوث</label>' +
        '<label><input type="radio" name="knp-type" value="tcp"> WiFi / شبكة</label>' +
        '<div id="knp-bt" style="margin-top:10px;">' +
          '<select id="knp-dev" style="' + inp + '"></select>' +
          '<div style="font-size:12px;color:#666;margin-top:4px;">اقرن الطابعة أولا من إعدادات بلوتوث الهاتف ثم اخترها هنا.</div>' +
        '</div>' +
        '<div id="knp-tcp" style="margin-top:10px;display:none;">' +
          '<input id="knp-host" placeholder="عنوان IP للطابعة مثل 192.168.1.50" style="' + inp + 'direction:ltr;">' +
          '<input id="knp-port" placeholder="المنفذ 9100" style="' + inp + 'direction:ltr;">' +
          '<div style="font-size:12px;color:#666;margin-top:4px;">يجب أن يكون الهاتف والطابعة على نفس شبكة الواي فاي.</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:14px;">' +
          '<button id="knp-save" style="flex:1;padding:10px;border:0;border-radius:8px;background:#0d3b66;color:#fff;font-size:15px;">حفظ</button>' +
          '<button id="knp-cancel" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;background:#fff;font-size:15px;">إلغاء</button>' +
        '</div></div>';
      document.body.appendChild(d);

      var $ = function (id) { return d.querySelector('#' + id); };
      var radios = d.querySelectorAll('input[name="knp-type"]');
      function showType(t) {
        $('knp-bt').style.display = t === 'bluetooth' ? '' : 'none';
        $('knp-tcp').style.display = t === 'tcp' ? '' : 'none';
      }
      Array.prototype.forEach.call(radios, function (r) {
        r.checked = r.value === cfg.type;
        r.onchange = function () { showType(r.value); };
      });
      showType(cfg.type);
      $('knp-host').value = cfg.host || '';
      $('knp-port').value = cfg.port || 9100;

      var sel = $('knp-dev');
      sel.innerHTML = '<option value="">' + (native ? 'جاري البحث عن الطابعات...' : 'متاح داخل التطبيق فقط') + '</option>';
      if (native) {
        (async function () {
          try {
            var P = btPlugin();
            if (!P) throw new Error('no plugin');
            try { await P.requestPermission({ transport: 'bluetooth' }); } catch (e) {}
            var res = await P.list({ transport: 'bluetooth' });
            var devs = arr(res && res.devices);
            sel.innerHTML = devs.length ? '' : '<option value="">لا توجد طابعة مقترنة</option>';
            devs.forEach(function (x) {
              var o = document.createElement('option');
              o.value = x.address;
              o.textContent = (x.name || 'Printer') + ' (' + x.address + ')';
              o.setAttribute('data-name', x.name || '');
              if (x.address === cfg.address) o.selected = true;
              sel.appendChild(o);
            });
          } catch (e) {
            sel.innerHTML = '<option value="">تعذر قراءة الطابعات. اسمح بإذن البلوتوث</option>';
          }
        })();
      }

      function close(v) { d.remove(); resolve(v); }
      $('knp-cancel').onclick = function () { close(null); };
      $('knp-save').onclick = function () {
        var type = d.querySelector('input[name="knp-type"]:checked').value;
        var out;
        if (type === 'tcp') {
          var host = $('knp-host').value.trim();
          var port = parseInt($('knp-port').value, 10) || 9100;
          if (!host) return alert('اكتب عنوان IP الطابعة');
          out = { type: 'tcp', host: host, port: port };
        } else {
          var opt = sel.options[sel.selectedIndex];
          if (!opt || !opt.value) return alert('اختر طابعة بلوتوث من القائمة');
          out = { type: 'bluetooth', address: opt.value, name: opt.getAttribute('data-name') || '' };
        }
        savePrinterCfg(out);
        close(out);
      };
    });
  }

  window.printViaBluetooth = async function(visitId) {
    var native = isNativeApp();
    try {
      if (!visitId) return alert('خطأ: رقم الزيارة غير موجود.');
      var bundle = await fetchBundle(visitId);
      var canvas = await renderInvoiceCanvas(bundle);
      if (!native) return showBtPreview(canvas);
      var P = btPlugin();
      if (!P) return alert('إضافة الطابعة الحرارية غير مثبتة في هذا الإصدار من التطبيق.');
      var cfg = getPrinterCfg();
      var ok = cfg && ((cfg.type === 'bluetooth' && cfg.address) || (cfg.type === 'tcp' && cfg.host));
      if (!ok) { cfg = await window.KNPrinterSetup(); if (!cfg) return; }
      var data = bytesToBase64(canvasToEscPos(canvas));
      if (cfg.type === 'tcp') {
        await P.print({ transport: 'tcp', host: cfg.host, port: cfg.port || 9100, data: data });
      } else {
        var perm = await P.requestPermission({ transport: 'bluetooth', address: cfg.address });
        if (perm && perm.granted === false) throw { code: 'permission_denied' };
        await P.print({ transport: 'bluetooth', address: cfg.address, data: data });
      }
    } catch (e) {
      console.error(e);
      if (window.confirm('فشلت الطباعة: ' + btErrorMessage(e) + '\n\nهل تريد تغيير إعدادات الطابعة؟')) window.KNPrinterSetup();
    }
  };
  window.printThermal = window.printViaBluetooth;



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
