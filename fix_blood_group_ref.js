window.addEventListener('load', function () {
  setTimeout(async function () {
    var FLAG = 'kn_fix_bg_ref_v1';
    try {
      if (localStorage.getItem(FLAG)) return;
      if (typeof dbGetAll !== 'function' || typeof dbPut !== 'function') return;
      var params = (await dbGetAll('parameters')) || [];
      if (!params.length) return;
      var n = 0;
      for (var i = 0; i < params.length; i++) {
        var p = params[i];
        var nm = String(p.name || '').trim();
        if (nm === 'ABO Group' && p.ref_text === 'O') { p.ref_text = null; await dbPut('parameters', p); n++; }
        else if (nm === 'Rh Factor' && p.ref_text === 'Positive') { p.ref_text = null; await dbPut('parameters', p); n++; }
      }
      localStorage.setItem(FLAG, '1');
      console.log('fix_blood_group_ref: updated', n);
    } catch (e) { console.error('fix_blood_group_ref failed', e); }
  }, 2500);
});
