// Phone lock: the app opens only on phones that have an unlock code made for that phone's code.
// Unlock codes are ECDSA P-256 signatures made by the owner's private link-maker page;
// this file holds only the public key, which can check a code but cannot make one.
(function () {
  var APP = window.LOCK_APP || { id: 'X', name: 'App' };
  var PUB = {"kty": "EC", "crv": "P-256", "x": "OxLLIK5RqtLGRyzO8u1zTDmBi2qL2uZt8GXnXqOyoQA", "y": "kT7-Spd4zNSGU-HYNMbPlRjFdUxSo-fusBL8nu4SEKQ"};
  var KCODE = 'aw189-phone-code-' + APP.id, KUNL = 'aw189-unlock-' + APP.id;
  var de = document.documentElement;
  de.classList.add('locked');
  var st = document.createElement('style');
  st.textContent = 'html.locked body > *:not(#lockscreen){display:none !important}' +
    '#lockscreen{position:fixed;inset:0;z-index:9999;overflow-y:auto;background:#0f1b2e;color:#eef3fb;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:calc(24px + env(safe-area-inset-top)) 18px calc(30px + env(safe-area-inset-bottom))}' +
    '#lockscreen .lk{max-width:520px;margin:0 auto}' +
    '#lockscreen h1{font-size:1.35rem;margin:4px 0 4px}#lockscreen .sub{color:#9fb1cc;font-size:.9rem;margin-bottom:16px}' +
    '#lockscreen .card{background:#16263f;border:1px solid #2b4166;border-radius:12px;padding:14px;margin:12px 0}' +
    '#lockscreen .code{font:700 1.9rem/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-align:center;padding:10px 0;user-select:all;-webkit-user-select:all}' +
    '#lockscreen button{font:inherit;font-weight:600;padding:11px 16px;border-radius:999px;border:1px solid #5aa9ff;background:#5aa9ff;color:#06121f;width:100%;margin-top:8px}' +
    '#lockscreen button.ghost{background:transparent;color:#5aa9ff}' +
    '#lockscreen textarea{font:inherit;font-size:.95rem;width:100%;min-height:88px;border-radius:8px;border:1px solid #2b4166;background:#0b1526;color:#eef3fb;padding:10px;box-sizing:border-box}' +
    '#lockscreen .note{font-size:.82rem;color:#9fb1cc}#lockscreen .msg{margin-top:8px;font-size:.9rem;min-height:1.2em}' +
    '#lockscreen .bad{color:#ff5d5d}#lockscreen .ok{color:#2fbf71}#lockscreen ol{padding-left:20px;margin:6px 0}#lockscreen li{margin:4px 0}' +
    '.lock-who{font-size:.75rem;color:#9fb1cc;text-align:center;margin:18px 0 6px}';
  (document.head || de).appendChild(st);

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function phoneCode() {
    var c = get(KCODE);
    if (c && /^[A-Z]-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)) return c;
    var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = new Uint8Array(8), s = '';
    crypto.getRandomValues(r);
    for (var i = 0; i < 8; i++) s += A[r[i] % A.length];
    c = APP.id + '-' + s.slice(0, 4) + '-' + s.slice(4);
    set(KCODE, c);
    return c;
  }
  function b64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var keyP = null;
  function key() { return keyP || (keyP = crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])); }
  // token: base64url(name) "." base64url(signature over "<phone code>|<name>")
  function check(token) {
    var m = /([A-Za-z0-9_-]{2,60})\.([A-Za-z0-9_-]{85,87})/.exec(token || '');
    if (!m) return Promise.resolve(null);
    var name;
    try { name = new TextDecoder().decode(b64u(m[1])); } catch (e) { return Promise.resolve(null); }
    var msg = new TextEncoder().encode(phoneCode() + '|' + name);
    return key().then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, b64u(m[2]), msg); })
      .then(function (ok) { return ok ? { name: name, token: m[0] } : null; }, function () { return null; });
  }
  function open(name) {
    de.classList.remove('locked');
    var ls = document.getElementById('lockscreen'); if (ls) ls.remove();
    var main = document.querySelector('main');
    if (main && !document.querySelector('.lock-who')) { var d = document.createElement('div'); d.className = 'lock-who'; d.textContent = 'Unlocked for ' + name + ' on this phone · ' + phoneCode(); main.appendChild(d); }
    window.LOCK_USER = name;
  }
  function show() {
    var code = phoneCode();
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var d = document.createElement('div'); d.id = 'lockscreen';
    d.innerHTML = '<div class="lk"><h1>' + APP.name + '</h1><div class="sub">This app opens only on approved phones.</div>' +
      (ios && !standalone ? '<div class="card" style="border-color:#ffb020"><b style="color:#ffb020">First add it to your Home Screen.</b><div class="note" style="margin-top:4px">Tap Share → Add to Home Screen, then open the app from the home-screen icon and ask for your code from there. The home-screen app has its own phone code, so a code made for Safari will not unlock it.</div></div>' : '') +
      '<div class="card"><div class="note">Your phone code</div><div class="code" id="lk-code"></div>' +
      '<button type="button" id="lk-send">Send my code</button>' +
      '<ol class="note"><li>Send this code to the person who shared the app with you.</li><li>They send you back an unlock message.</li><li>Copy that whole message, paste it below and tap Unlock.</li></ol></div>' +
      '<div class="card"><textarea id="lk-in" placeholder="Paste the unlock message here" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>' +
      '<button type="button" id="lk-go">Unlock</button><button type="button" class="ghost" id="lk-paste">Paste from clipboard</button><div class="msg" id="lk-msg"></div></div>' +
      '<div class="note">The unlock works only on this phone and this app. A new phone, deleting the app, or clearing Safari data needs a new code.</div></div>';
    document.body.appendChild(d);
    document.getElementById('lk-code').textContent = code;
    var msgEl = document.getElementById('lk-msg');
    var req = APP.name + ' unlock request. My phone code: ' + code;
    document.getElementById('lk-send').onclick = function () {
      if (navigator.share) { navigator.share({ text: req }).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(req) : Promise.reject()).then(function () { msgEl.className = 'msg ok'; msgEl.textContent = 'Copied. Paste it into a message.'; }, function () { msgEl.className = 'msg'; msgEl.textContent = 'Copy the code above and send it.'; });
    };
    document.getElementById('lk-paste').onclick = function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { msgEl.className = 'msg'; msgEl.textContent = 'Long-press the box and choose Paste.'; return; }
      navigator.clipboard.readText().then(function (t) { document.getElementById('lk-in').value = t; go(); }, function () { msgEl.className = 'msg'; msgEl.textContent = 'Long-press the box and choose Paste.'; });
    };
    function go() {
      var t = document.getElementById('lk-in').value;
      msgEl.className = 'msg'; msgEl.textContent = 'Checking…';
      check(t).then(function (r) {
        if (r) { set(KUNL, r.token); open(r.name); return; }
        // several unlocks in one message (one per app): try each
        var all = t.match(/[A-Za-z0-9_-]{2,60}\.[A-Za-z0-9_-]{85,87}/g) || [];
        var i = 0;
        (function next() {
          if (i >= all.length) { msgEl.className = 'msg bad'; msgEl.textContent = all.length ? 'That unlock was made for a different phone code or app. Ask for one made for ' + code + '.' : 'No unlock found in that text. Paste the whole message.'; return; }
          check(all[i++]).then(function (r2) { if (r2) { set(KUNL, r2.token); open(r2.name); } else next(); });
        })();
      });
    }
    document.getElementById('lk-go').onclick = go;
  }
  function start() {
    if (!window.crypto || !crypto.subtle) { show(); return; }
    // an unlock can also arrive in the link (#unlock=...)
    var h = /[#&]unlock=([^&]+)/.exec(location.hash);
    var saved = get(KUNL);
    (h ? check(decodeURIComponent(h[1])) : Promise.resolve(null)).then(function (r) {
      if (r) { set(KUNL, r.token); history.replaceState(null, '', location.pathname + location.search); return r; }
      return saved ? check(saved) : null;
    }).then(function (r) { if (r) open(r.name); else show(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
