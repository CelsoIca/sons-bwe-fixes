// ═══════════════════════════════════════════════════
//  SONS BWE FIXES — app.js
//  Lógica principal com integração Firebase
// ═══════════════════════════════════════════════════

import {
  onAuth, loginEmail, loginGoogle, registerEmail, logout,
  getUserProfile, listenTracks, listenAlbums,
  addTrack, updateTrack, deleteTrack, toggleTrackActive,
  toggleLikeTrack, incrementListeners, incrementDownloads,
  getStats
} from './firebase.js';

// ─── PALETA DE CORES ───
const colors = [
  'linear-gradient(135deg,#ec9731,#f5b554)',
  'linear-gradient(135deg,#314595,#223488)',
  'linear-gradient(135deg,#223488,#314595)',
  'linear-gradient(135deg,#ec9731,#314595)',
  'linear-gradient(135deg,#314595,#ec9731)',
  'linear-gradient(135deg,#192035,#314595)',
];

// ─── ESTADO GLOBAL ───
let currentUser    = null;
let userProfile    = null;
let tracks         = [];
let albums         = [];
let currentTrack   = 0;
let isPlaying      = false;
let isShuffle      = false;
let isRepeat       = false;
let progressInterval = null;
let unsubTracks    = null;
let unsubAlbums    = null;
let editingTrackId = null;

// ════════════════════════════════════════
//  AUTH — Inicialização
// ════════════════════════════════════════

onAuth(async (user) => {
  if (user) {
    currentUser = user;
    userProfile = await getUserProfile(user.uid);
    hideAuthOverlay();
    initApp();
  } else {
    currentUser = null;
    userProfile = null;
    showAuthOverlay();
    destroyListeners();
  }
});

function showAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'flex';
}
function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

// ─── LOGIN FORM ───
window.authLogin = async function() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!email || !pass) return showAuthError('Preencha todos os campos.');
  showAuthLoading('A entrar...');
  const { error } = await loginEmail(email, pass);
  hideAuthLoading();
  if (error) showAuthError(error);
};

window.authRegister = async function() {
  const name  = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!name || !email || !pass) return showAuthError('Preencha todos os campos.');
  showAuthLoading('A criar conta...');
  const { error } = await registerEmail(email, pass, name);
  hideAuthLoading();
  if (error) showAuthError(error);
};

window.authGoogle = async function() {
  showAuthLoading('A entrar com Google...');
  const { error } = await loginGoogle();
  hideAuthLoading();
  if (error) showAuthError(error);
};

window.authLogout = async function() {
  await logout();
  showToast('👋 Sessão terminada');
};

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('show');
}
function showAuthLoading(msg) {
  document.getElementById('auth-loading').textContent = msg;
}
function hideAuthLoading() {
  document.getElementById('auth-loading').textContent = '';
}

// ─── AUTH TABS ───
window.switchAuthTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('auth-error').classList.remove('show');

  const nameField = document.getElementById('auth-name-wrap');
  const btnLogin  = document.getElementById('btn-auth-login');
  const btnReg    = document.getElementById('btn-auth-register');

  if (tab === 'login') {
    nameField.style.display = 'none';
    btnLogin.style.display  = 'block';
    btnReg.style.display    = 'none';
  } else {
    nameField.style.display = 'block';
    btnLogin.style.display  = 'none';
    btnReg.style.display    = 'block';
  }
};

// ════════════════════════════════════════
//  APP INIT — após login
// ════════════════════════════════════════

function initApp() {
  // Actualizar UI com dados do utilizador
  const name = userProfile?.displayName || currentUser.displayName || 'Utilizador';
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
  document.querySelectorAll('.user-initial').forEach(el => el.textContent = name[0].toUpperCase());

  // Mostrar / ocultar menu admin
  if (userProfile?.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }

  // Iniciar listeners do Firestore em tempo real
  unsubTracks = listenTracks(data => {
    tracks = data;
    renderAll();
  });
  unsubAlbums = listenAlbums(data => {
    albums = data;
    renderCards();
  });

  // Carregar stats do admin se for admin
  if (userProfile?.role === 'admin') loadAdminStats();

  nav('home');
}

function destroyListeners() {
  if (unsubTracks) { unsubTracks(); unsubTracks = null; }
  if (unsubAlbums) { unsubAlbums(); unsubAlbums = null; }
}

// ════════════════════════════════════════
//  NAVEGAÇÃO
// ════════════════════════════════════════

window.nav = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    const txt = n.textContent.toLowerCase();
    if (page === 'home'      && txt.includes('início'))     n.classList.add('active');
    if (page === 'library'   && txt.includes('biblioteca')) n.classList.add('active');
    if (page === 'albums'    && txt.includes('álbuns'))     n.classList.add('active');
    if (page === 'eps'       && txt.includes('eps'))        n.classList.add('active');
    if (page === 'singles'   && txt.includes('singles'))    n.classList.add('active');
    if (page === 'mixtapes'  && txt.includes('mixtapes'))   n.classList.add('active');
    if (page === 'fan'       && txt.includes('fã'))         n.classList.add('active');
    if (page === 'admin'     && txt.includes('admin'))      n.classList.add('active');
    if (page === 'search'    && txt.includes('descobrir'))  n.classList.add('active');
  });
};

// ════════════════════════════════════════
//  RENDER — Listas e Cards
// ════════════════════════════════════════

function renderTrackRow(t, idx) {
  const typeMap = { album:'type-album', ep:'type-ep', single:'type-single', mixtape:'type-mixtape' };
  const typeLbl = { album:'Álbum', ep:'EP', single:'Single', mixtape:'Mixtape' };
  const isLiked = userProfile?.likes?.includes(t.id) || false;
  const bg = t.coverURL
    ? `url(${t.coverURL}) center/cover`
    : colors[idx % colors.length];
  return `
  <div class="track-row ${currentTrack === idx ? 'playing' : ''}" onclick="playTrack(${idx})">
    <div class="track-num">${currentTrack === idx ? '▶' : idx + 1}</div>
    <div class="track-info">
      <div class="track-thumb" style="background:${bg}">${t.coverURL ? '' : (t.emoji || '🎵')}</div>
      <div>
        <div class="track-name">${t.title}</div>
        <div class="track-artist">${t.artist}</div>
      </div>
    </div>
    <div class="track-album">${t.album || '—'}</div>
    <div class="track-cat"><span class="card-type ${typeMap[t.cat] || ''}">${typeLbl[t.cat] || t.cat}</span></div>
    <div class="track-duration">${t.dur || '—'}</div>
    <div class="track-actions">
      <button class="icon-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation();handleLike('${t.id}',this)" title="Like">${isLiked ? '♥' : '♡'}</button>
      <button class="icon-btn" onclick="event.stopPropagation();handleDownload('${t.id}','${t.audioURL || ''}')" title="Download">⬇</button>
    </div>
  </div>`;
}

window.renderAll = function() {
  const activeTracks = tracks.filter(t => t.active !== false);
  const el_home   = document.getElementById('track-list-home');
  const el_lib    = document.getElementById('track-list-lib');
  const el_search = document.getElementById('track-list-search');
  if (el_home)   el_home.innerHTML   = activeTracks.slice(0, 6).map((t, i) => renderTrackRow(t, i)).join('');
  if (el_lib)    el_lib.innerHTML    = activeTracks.map((t, i) => renderTrackRow(t, i)).join('');
  if (el_search) el_search.innerHTML = activeTracks.map((t, i) => renderTrackRow(t, i)).join('');
  // badge contagem
  const badge = document.querySelector('.nav-item .badge');
  if (badge) badge.textContent = activeTracks.length;
  renderAdmin();
  renderFan();
};

window.renderCards = function() {
  const homeGrid = document.getElementById('card-grid-home');
  if (homeGrid) homeGrid.innerHTML = albums.slice(0, 6).map(a => cardHTML(a)).join('');
  ['albums','eps','singles','mixtapes'].forEach(cat => {
    const key = { albums:'album', eps:'ep', singles:'single', mixtapes:'mixtape' }[cat];
    const filtered = albums.filter(a => a.type === key);
    const el = document.getElementById('grid-' + cat);
    if (el) el.innerHTML = filtered.length
      ? filtered.map(a => cardHTML(a)).join('')
      : `<div class="empty-state" style="grid-column:1/-1"><div class="e-ico">📭</div><p>Sem itens nesta categoria</p></div>`;
  });
};

function cardHTML(a) {
  const typeMap = { album:'type-album', ep:'type-ep', single:'type-single', mixtape:'type-mixtape' };
  const typeLbl = { album:'Álbum', ep:'EP', single:'Single', mixtape:'Mixtape' };
  const bg = a.coverURL ? `url(${a.coverURL}) center/cover` : colors[Math.floor(Math.random() * colors.length)];
  return `<div class="card" onclick="showToast('▶ A reproduzir ${a.name}')">
    <div class="card-art" style="background:${bg}">
      ${a.coverURL ? '' : (a.emoji || '🎵')}
      <div class="play-overlay"><span>▶</span></div>
    </div>
    <span class="card-type ${typeMap[a.type] || ''}">${typeLbl[a.type] || a.type}</span>
    <div class="card-name">${a.name}</div>
    <div class="card-sub">${a.artist} • ${a.year || ''}</div>
  </div>`;
}

// ════════════════════════════════════════
//  PLAYER
// ════════════════════════════════════════

window.playTrack = async function(idx) {
  const activeTracks = tracks.filter(t => t.active !== false);
  if (!activeTracks[idx]) return;
  currentTrack = idx;
  const t = activeTracks[idx];

  // UI
  const thumb = document.getElementById('player-thumb');
  thumb.style.background = t.coverURL ? `url(${t.coverURL}) center/cover` : colors[idx % colors.length];
  thumb.textContent = t.coverURL ? '' : (t.emoji || '🎵');
  document.getElementById('player-name').textContent   = t.title;
  document.getElementById('player-artist').textContent = t.artist;
  document.getElementById('time-total').textContent    = t.dur || '0:00';

  // Reset progresso
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('time-curr').textContent     = '0:00';
  isPlaying = true;
  document.getElementById('play-btn').textContent = '⏸';

  // Incrementar ouvintes no Firestore
  await incrementListeners(t.id);

  // Iniciar progresso visual
  const [m, s] = (t.dur || '3:00').split(':');
  startProgress(parseInt(m) * 60 + parseInt(s));
  renderAll();
};

function startProgress(totalSec) {
  clearInterval(progressInterval);
  const fill = document.getElementById('progress-fill');
  const curr = document.getElementById('time-curr');
  let elapsed = 0;
  progressInterval = setInterval(() => {
    if (!isPlaying) return;
    elapsed++;
    const pct = Math.min((elapsed / totalSec) * 100, 100);
    fill.style.width = pct + '%';
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    curr.textContent = m + ':' + String(s).padStart(2, '0');
    if (elapsed >= totalSec) {
      clearInterval(progressInterval);
      if (isRepeat) { elapsed = 0; startProgress(totalSec); }
      else nextTrack();
    }
  }, 1000);
}

window.togglePlay = function() {
  isPlaying = !isPlaying;
  document.getElementById('play-btn').textContent = isPlaying ? '⏸' : '▶';
  if (isPlaying) {
    const t = tracks.filter(t => t.active !== false)[currentTrack];
    if (t) { const [m,s] = (t.dur || '3:00').split(':'); startProgress(parseInt(m)*60+parseInt(s)); }
  } else {
    clearInterval(progressInterval);
  }
};

window.nextTrack = function() {
  const n = tracks.filter(t => t.active !== false).length;
  playTrack(isShuffle ? Math.floor(Math.random() * n) : (currentTrack + 1) % n);
};

window.prevTrack = function() {
  const n = tracks.filter(t => t.active !== false).length;
  playTrack((currentTrack - 1 + n) % n);
};

window.toggleShuffle = function() {
  isShuffle = !isShuffle;
  document.getElementById('shuffle-btn').classList.toggle('active', isShuffle);
  showToast(isShuffle ? '🔀 Modo aleatório activado' : '🔀 Modo aleatório desactivado');
};

window.toggleRepeat = function() {
  isRepeat = !isRepeat;
  document.getElementById('repeat-btn').classList.toggle('active', isRepeat);
  showToast(isRepeat ? '🔁 Repetir activado' : '🔁 Repetir desactivado');
};

window.seekTo = function(e, bar) {
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  document.getElementById('progress-fill').style.width = (pct * 100) + '%';
};

window.setVolume = function(e, bar) {
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  document.getElementById('vol-fill').style.width = (pct * 100) + '%';
};

window.toggleLikePlayer = function() {
  const btn = document.getElementById('player-like-btn');
  btn.classList.toggle('liked');
  btn.textContent = btn.classList.contains('liked') ? '♥' : '♡';
};

// ─── LIKE ───
window.handleLike = async function(trackId, btn) {
  if (!currentUser) return showToast('🔒 Inicia sessão para dar like.');
  const isNowLiked = await toggleLikeTrack(currentUser.uid, trackId);
  btn.classList.toggle('liked', isNowLiked);
  btn.textContent = isNowLiked ? '♥' : '♡';
  userProfile = await getUserProfile(currentUser.uid);
  showToast(isNowLiked ? '❤️ Adicionado aos favoritos!' : '💔 Removido dos favoritos');
};

// ─── DOWNLOAD ───
window.handleDownload = async function(trackId, audioURL) {
  if (!audioURL) return showToast('⚠️ Ficheiro de áudio não disponível.');
  await incrementDownloads(trackId);
  const a = document.createElement('a');
  a.href = audioURL;
  a.download = '';
  a.target = '_blank';
  a.click();
  showToast('⬇️ Download iniciado!');
};

window.downloadTrack = function() {
  const activeTracks = tracks.filter(t => t.active !== false);
  if (activeTracks[currentTrack]) {
    handleDownload(activeTracks[currentTrack].id, activeTracks[currentTrack].audioURL);
  }
};

// ════════════════════════════════════════
//  FILTROS / PESQUISA
// ════════════════════════════════════════

window.filterTracks = function(q, scope) {
  const lower = q.toLowerCase();
  const activeTracks = tracks.filter(t => t.active !== false);
  const filtered = activeTracks.filter(t =>
    t.title?.toLowerCase().includes(lower) ||
    t.artist?.toLowerCase().includes(lower) ||
    t.album?.toLowerCase().includes(lower)
  );
  const id = scope === 'lib' ? 'track-list-lib' : scope === 'search' ? 'track-list-search' : 'track-list-home';
  document.getElementById(id).innerHTML = filtered.length
    ? filtered.map((t, i) => renderTrackRow(t, activeTracks.indexOf(t))).join('')
    : `<div class="empty-state"><div class="e-ico">🔍</div><p>Sem resultados para "${q}"</p></div>`;
};

window.filterCat = function(cat, btn) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const activeTracks = tracks.filter(t => t.active !== false);
  const filtered = cat === 'all' ? activeTracks : activeTracks.filter(t => t.cat === cat);
  document.getElementById('track-list-lib').innerHTML = filtered.length
    ? filtered.map((t, i) => renderTrackRow(t, i)).join('')
    : `<div class="empty-state"><div class="e-ico">📭</div><p>Sem músicas nesta categoria</p></div>`;
};

// ════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════

async function loadAdminStats() {
  const stats = await getStats();
  const map = {
    'stat-tracks':     stats.totalTracks,
    'stat-listeners':  stats.totalListeners.toLocaleString(),
    'stat-likes':      stats.totalLikes.toLocaleString(),
    'stat-downloads':  stats.totalDownloads.toLocaleString(),
    'stat-users':      stats.totalUsers
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

window.renderAdmin = function() {
  const typeMap = { album:'type-album', ep:'type-ep', single:'type-single', mixtape:'type-mixtape' };
  const typeLbl = { album:'Álbum', ep:'EP', single:'Single', mixtape:'Mixtape' };
  const el = document.getElementById('admin-track-list');
  if (!el) return;
  el.innerHTML = tracks.map((t, i) => `
  <div class="admin-row ${t.active ? '' : 'disabled'}">
    <div style="color:var(--text3);font-size:.85rem">${i + 1}</div>
    <div>
      <div style="font-weight:600;font-size:.88rem">${t.title}</div>
      <div style="color:var(--text3);font-size:.78rem">${t.artist}</div>
    </div>
    <div><span class="card-type ${typeMap[t.cat] || ''}">${typeLbl[t.cat] || t.cat}</span></div>
    <div style="color:var(--text2);font-size:.85rem">${t.dur || '—'}</div>
    <div style="font-size:.85rem">${(t.listeners || 0).toLocaleString()}</div>
    <div style="font-size:.85rem">${(t.likes || 0).toLocaleString()}</div>
    <div><span class="status-badge ${t.active ? 'status-active' : 'status-disabled'}">${t.active ? 'Activo' : 'Inactivo'}</span></div>
    <div class="admin-actions">
      <button class="a-btn" onclick="openEditModal('${t.id}')">✏️</button>
      <button class="a-btn warn" onclick="adminToggleActive('${t.id}',${!!t.active})">${t.active ? '🔕' : '🔔'}</button>
      <button class="a-btn" onclick="adminMoveTrack(${i},-1)">↑</button>
      <button class="a-btn" onclick="adminMoveTrack(${i},1)">↓</button>
      <button class="a-btn danger" onclick="adminDelete('${t.id}','${t.audioURL||''}','${t.coverURL||''}')">🗑️</button>
    </div>
  </div>`).join('');
};

window.adminToggleActive = async function(trackId, current) {
  await toggleTrackActive(trackId, current);
  showToast(current ? '🔕 Faixa desactivada' : '✅ Faixa activada');
};

window.adminDelete = async function(trackId, audioURL, coverURL) {
  if (!confirm('Eliminar esta música? Acção irreversível.')) return;
  const { error } = await deleteTrack(trackId, audioURL, coverURL);
  if (error) showToast('❌ Erro: ' + error);
  else showToast('🗑️ Música eliminada');
};

window.adminMoveTrack = function(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= tracks.length) return;
  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  renderAdmin();
  showToast('↕️ Ordem actualizada (não persistida sem arrastar)');
};

// ─── ADICIONAR MÚSICA ───
window.adminAddTrack = async function() {
  const title    = document.getElementById('add-title').value.trim();
  const artist   = document.getElementById('add-artist').value.trim();
  const album    = document.getElementById('add-album').value.trim();
  const cat      = document.getElementById('add-cat').value.toLowerCase();
  const genre    = document.getElementById('add-genre').value.trim();
  const year     = document.getElementById('add-year').value;
  const audioFile  = document.getElementById('add-audio').files[0];
  const coverFile  = document.getElementById('add-cover').files[0];

  if (!title || !artist) return showToast('⚠️ Título e artista são obrigatórios.');
  showToast('⏳ A carregar música...');

  const { id, error } = await addTrack(
    { title, artist, album, cat, genre, year: parseInt(year) || new Date().getFullYear(), dur: '0:00' },
    audioFile, coverFile
  );
  if (error) showToast('❌ Erro: ' + error);
  else {
    showToast('✅ Música registada com sucesso!');
    adminTab('music', document.querySelector('.admin-tab'));
  }
};

// ─── EDITAR MÚSICA ───
window.openEditModal = function(trackId) {
  const t = tracks.find(t => t.id === trackId);
  if (!t) return;
  editingTrackId = trackId;
  document.getElementById('edit-title').value  = t.title  || '';
  document.getElementById('edit-artist').value = t.artist || '';
  document.getElementById('edit-album').value  = t.album  || '';
  const catVal = t.cat ? t.cat.charAt(0).toUpperCase() + t.cat.slice(1) : 'Album';
  document.getElementById('edit-cat').value = catVal;
  document.getElementById('modal-overlay').classList.add('open');
};

window.saveEdit = async function() {
  if (!editingTrackId) return;
  const data = {
    title:  document.getElementById('edit-title').value,
    artist: document.getElementById('edit-artist').value,
    album:  document.getElementById('edit-album').value,
    cat:    document.getElementById('edit-cat').value.toLowerCase()
  };
  const { error } = await updateTrack(editingTrackId, data);
  document.getElementById('modal-overlay').classList.remove('open');
  showToast(error ? '❌ Erro ao guardar' : '💾 Alterações guardadas!');
};

window.filterAdmin = function(q) {
  const lower = q.toLowerCase();
  const filtered = tracks.filter(t =>
    t.title?.toLowerCase().includes(lower) ||
    t.artist?.toLowerCase().includes(lower)
  );
  // Re-renderizar só com resultados filtrados
  const typeMap = { album:'type-album', ep:'type-ep', single:'type-single', mixtape:'type-mixtape' };
  const typeLbl = { album:'Álbum', ep:'EP', single:'Single', mixtape:'Mixtape' };
  const el = document.getElementById('admin-track-list');
  if (!el) return;
  el.innerHTML = filtered.map((t, i) => `
  <div class="admin-row ${t.active ? '' : 'disabled'}">
    <div style="color:var(--text3)">${i+1}</div>
    <div><div style="font-weight:600;font-size:.88rem">${t.title}</div><div style="font-size:.78rem;color:var(--text3)">${t.artist}</div></div>
    <div><span class="card-type ${typeMap[t.cat]||''}">${typeLbl[t.cat]||t.cat}</span></div>
    <div style="color:var(--text2)">${t.dur||'—'}</div>
    <div>${(t.listeners||0).toLocaleString()}</div>
    <div>${(t.likes||0).toLocaleString()}</div>
    <div><span class="status-badge ${t.active?'status-active':'status-disabled'}">${t.active?'Activo':'Inactivo'}</span></div>
    <div class="admin-actions">
      <button class="a-btn" onclick="openEditModal('${t.id}')">✏️</button>
      <button class="a-btn warn" onclick="adminToggleActive('${t.id}',${!!t.active})">${t.active?'🔕':'🔔'}</button>
      <button class="a-btn danger" onclick="adminDelete('${t.id}','${t.audioURL||''}','${t.coverURL||''}')">🗑️</button>
    </div>
  </div>`).join('');
};

window.filterAdminCat = function(cat) {
  if (!cat) { renderAdmin(); return; }
  const filtered = tracks.filter(t => t.cat === cat);
  const tmp = tracks;
  tracks = filtered;
  renderAdmin();
  tracks = tmp;
};

// ════════════════════════════════════════
//  FAN PROFILE
// ════════════════════════════════════════

window.renderFan = function() {
  if (!userProfile) return;
  const topTracks = [...tracks].sort((a, b) => (b.listeners||0) - (a.listeners||0)).slice(0, 5);
  const el = document.getElementById('fan-top-tracks');
  if (el) el.innerHTML = topTracks.map((t, i) => `
  <div class="activity-item">
    <div style="color:var(--text3);font-size:.82rem;min-width:20px;text-align:center">${i+1}</div>
    <div style="font-size:1.2rem">${t.emoji || '🎵'}</div>
    <div style="flex:1"><div style="font-weight:600;font-size:.88rem">${t.title}</div><div style="font-size:.78rem;color:var(--text3)">${t.artist}</div></div>
    <div style="font-size:.8rem;color:var(--text2)">${t.dur||'—'}</div>
    <button class="icon-btn" onclick="handleDownload('${t.id}','${t.audioURL||''}')" title="Download">⬇</button>
  </div>`).join('');

  // Favoritos
  const favIds = userProfile.likes || [];
  const favTracks = tracks.filter(t => favIds.includes(t.id));
  const elFav = document.getElementById('fan-fav-list');
  if (elFav) elFav.innerHTML = favTracks.length
    ? favTracks.map(t => `
    <div class="activity-item">
      <div style="font-size:1.2rem">${t.emoji||'🎵'}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:.88rem">${t.title}</div><div style="font-size:.78rem;color:var(--text3)">${t.artist}</div></div>
      <button class="icon-btn liked" onclick="handleLike('${t.id}',this)">♥</button>
      <button class="icon-btn" onclick="handleDownload('${t.id}','${t.audioURL||''}')">⬇</button>
    </div>`).join('')
    : '<div class="empty-state"><div class="e-ico">❤️</div><p>Ainda sem favoritos</p></div>';

  // Contadores
  document.querySelectorAll('.fan-likes-count').forEach(el => el.textContent = favIds.length);
};

// ════════════════════════════════════════
//  TABS
// ════════════════════════════════════════

window.adminTab = function(tab, btn) {
  ['music','add','users','analytics'].forEach(t => {
    const el = document.getElementById('admin-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'analytics') loadAdminStats();
};

window.fanTab = function(tab, btn) {
  ['activity','favorites','playlists','downloads'].forEach(t => {
    const el = document.getElementById('fan-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.fan-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

// ════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════

window.closeModal = function(e) {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.remove('open');
};

// ════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════

let toastTimer;
window.showToast = function(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
};
