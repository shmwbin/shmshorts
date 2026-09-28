(() => {
  'use strict';
  const SHEET_API = 'https://script.google.com/macros/s/AKfycby7rtnrKKi0qfw5APEeMunxw7zcv6onlvFls4MbkQPWt9h9IqycuYi9JTOahEm4h_tM/exec';
  const $ = (s) => document.querySelector(s);
  const feed = $('#feed');
  let items = [];
  let index = 0;
  let xp = Number(localStorage.getItem('teenmind-xp') || 0);
  let muted = true;
  let installPrompt = null;
  let startY = 0;
  let startX = 0;
  let toastTimer;
  $('#score').textContent = bn(xp);

  function bn(value) { return Number(value).toLocaleString('bn-BD'); }
  function safeText(value, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function addXp(amount) { xp += amount; localStorage.setItem('teenmind-xp', String(xp)); $('#score').textContent = bn(xp); }
  function setState(message, retry = false) {
    feed.replaceChildren();
    const box = document.createElement('div'); box.className = 'state-card';
    const wrap = document.createElement('div'); const text = document.createElement('div'); text.textContent = message; wrap.append(text);
    if (retry) { const button = document.createElement('button'); button.textContent = 'আবার চেষ্টা করুন'; button.addEventListener('click', load); wrap.append(button); }
    box.append(wrap); feed.append(box);
  }
  function normalize(raw) {
    const type = safeText(raw.type || raw.Type, 'video').toLowerCase();
    const mediaUrl = safeText(raw.mediaUrl || raw.media_url || raw.MediaUrl || raw.url || raw.URL);
    if (!mediaUrl) return null;
    let parsed;
    try { parsed = new URL(mediaUrl, location.href); } catch { return null; }
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const isVideo = ['video', 'short', 'youtube'].includes(type);
    if (isVideo && !youtubeId(mediaUrl)) return null;
    return { type: isVideo ? 'video' : 'image', tag: safeText(raw.tag || raw.Tag, '✨ শেখার শর্টস'), title: safeText(raw.title || raw.Title, 'নতুন কিছু শিখুন'), caption: safeText(raw.caption || raw.description || raw.Description), mediaUrl, creator: safeText(raw.creator || raw.channel || raw.Channel, 'TeenMind') };
  }
  function youtubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0];
      if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
        if (u.pathname === '/watch') return u.searchParams.get('v');
        const match = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/); return match && match[1];
      }
    } catch { /* invalid URL */ }
    return null;
  }
  function render() {
    const item = items[index]; if (!item) return;
    feed.replaceChildren();
    const card = document.createElement('article'); card.className = 'short-card';
    if (item.type === 'video') {
      const frame = document.createElement('iframe'); frame.className = 'media-frame';
      const id = youtubeId(item.mediaUrl);
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&playsinline=1&loop=1&playlist=${encodeURIComponent(id)}&rel=0`;
      frame.title = item.title; frame.allow = 'autoplay; encrypted-media; picture-in-picture'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      card.append(frame);
    } else {
      const img = document.createElement('img'); img.className = 'media-image'; img.src = item.mediaUrl; img.alt = item.title; img.loading = 'eager'; img.onerror = () => { img.remove(); toast('ছবিটি লোড করা যায়নি'); }; card.append(img);
    }
    const shade = document.createElement('div'); shade.className = 'media-shade'; card.append(shade);
    const copy = document.createElement('div'); copy.className = 'card-copy';
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = item.tag;
    const title = document.createElement('h1'); title.className = 'title'; title.textContent = item.title;
    copy.append(tag, title);
    if (item.caption) { const caption = document.createElement('p'); caption.className = 'caption'; caption.textContent = item.caption; copy.append(caption); }
    const creator = document.createElement('div'); creator.className = 'creator'; const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = item.creator.slice(0, 1); const name = document.createElement('span'); name.textContent = item.creator; creator.append(avatar, name); copy.append(creator); card.append(copy); feed.append(card);
    const liked = getLikes().includes(index); $('[data-action="like"]').classList.toggle('liked', liked); $('.action-icon', $('[data-action="like"]')).textContent = liked ? '♥' : '♡'; $('#like-count').textContent = bn(120 + getLikes().length);
  }
  function getLikes() { try { return JSON.parse(localStorage.getItem('teenmind-liked') || '[]'); } catch { return []; } }
  function move(delta) { if (!items.length) return; const next = index + delta; if (next < 0 || next >= items.length) { toast(next < 0 ? 'এটাই প্রথম শর্ট' : 'আর কোনো শর্ট নেই'); return; } index = next; render(); if (delta > 0) addXp(15); }
  async function load() {
    setState('শর্টস লোড হচ্ছে…');
    try {
      const response = await fetch(SHEET_API, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid feed data');
      items = data.map(normalize).filter(Boolean);
      for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
      if (!items.length) { setState('শিটে দেখানোর মতো বৈধ ভিডিও বা ছবি নেই।'); return; }
      index = 0; render();
    } catch (error) { console.error('Feed load failed', error); setState('ইন্টারনেট বা Google Sheet সংযোগে সমস্যা হয়েছে।', true); }
  }

  $('[data-action="next"]').addEventListener('click', () => move(1));
  $('[data-action="like"]').addEventListener('click', () => {
    const liked = getLikes(); const at = liked.indexOf(index);
    if (at >= 0) liked.splice(at, 1); else { liked.push(index); addXp(25); }
    localStorage.setItem('teenmind-liked', JSON.stringify(liked)); render();
  });
  $('[data-action="share"]').addEventListener('click', async () => {
    const item = items[index]; if (!item) return;
    try { if (navigator.share) await navigator.share({ title: item.title, text: item.caption || item.title, url: item.mediaUrl }); else { await navigator.clipboard.writeText(item.mediaUrl); toast('ভিডিওর লিংক কপি হয়েছে'); } }
    catch (err) { if (err.name !== 'AbortError') toast('শেয়ার করা যায়নি'); }
  });
  $('[data-action="comment"]').addEventListener('click', () => toast('কমেন্ট ফিচারের জন্য সার্ভার/API সংযোগ লাগবে'));
  $('#sound-toggle').addEventListener('click', () => { muted = !muted; $('#sound-toggle').textContent = muted ? '🔇' : '🔊'; $('#sound-toggle').setAttribute('aria-label', muted ? 'শব্দ চালু করুন' : 'শব্দ বন্ধ করুন'); render(); });
  feed.addEventListener('touchstart', e => { const t = e.changedTouches[0]; startY = t.screenY; startX = t.screenX; }, { passive: true });
  feed.addEventListener('touchend', e => { const t = e.changedTouches[0]; const dy = startY - t.screenY; const dx = startX - t.screenX; if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.2) move(dy > 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'ArrowDown') move(1); if (e.key === 'ArrowUp') move(-1); });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#install-banner').classList.remove('hidden'); });
  $('#install-btn').addEventListener('click', async () => { if (!installPrompt) { toast('ব্রাউজারের মেনু থেকে Install app বেছে নিন'); return; } installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#install-banner').classList.add('hidden'); });
  $('#close-banner').addEventListener('click', () => $('#install-banner').classList.add('hidden'));
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline support unavailable', err)));
  load();
})();
