window.addEventListener('load', function () {
  setTimeout(async function () {
    var FLAG = 'kn_fix_dup_serials_v1';
    try {
      if (localStorage.getItem(FLAG)) return;
      if (typeof dbGetAll !== 'function' || typeof dbPut !== 'function') return;
      var visits = (await dbGetAll('visits')) || [];
      if (!visits.length) return;
      visits.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var seen = {}, dups = [], maxByYear = {};
      visits.forEach(function (v) {
        var m = /^KN-(\d{4})-(\d+)$/.exec(v.serial || '');
        if (m) {
          var n = parseInt(m[2], 10);
          if (!maxByYear[m[1]] || n > maxByYear[m[1]]) maxByYear[m[1]] = n;
        }
        if (seen[v.serial]) dups.push(v); else seen[v.serial] = true;
      });
      var fixed = [];
      for (var i = 0; i < dups.length; i++) {
        var v = dups[i];
        var m2 = /^KN-(\d{4})-/.exec(v.serial || '');
        if (!m2) continue;
        var year = m2[1];
        var next = (maxByYear[year] || 0) + 1;
        maxByYear[year] = next;
        var old = v.serial;
        v.serial = 'KN-' + year + '-' + String(next).padStart(6, '0');
        await dbPut('visits', v);
        fixed.push(old + ' → ' + v.serial);
      }
      Object.keys(maxByYear).forEach(function (y) {
        var key = 'kodnaqi_serial_visit_' + y;
        var cur = parseInt(localStorage.getItem(key) || '0', 10) || 0;
        if (maxByYear[y] > cur) localStorage.setItem(key, String(maxByYear[y]));
      });
      localStorage.setItem(FLAG, '1');
      if (fixed.length) alert('تم تصحيح أرقام الزيارات المكررة:\n' + fixed.join('\n'));
    } catch (e) { console.error('fix serials failed', e); }
  }, 2000);
});
