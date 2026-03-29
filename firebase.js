// ═══════════════════════════════════════════════════
//  SONS BWE FIXES — firebase-config.js
//  Configuração partilhada por todos os ficheiros HTML
//  ⚠️  Substitua os valores com os do seu projecto Firebase
// ═══════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};

// Inicializar apenas uma vez
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// ─── Função utilitária: upload de imagem para Firebase Storage ───
async function uploadImagem(file, pasta) {
  if (!file) return null;
  const ref = storage.ref(`${pasta}/${Date.now()}_${file.name}`);
  const snap = await ref.put(file);
  return await snap.ref.getDownloadURL();
}

// ─── Toast global (usado por todas as páginas) ───
function showToast(titulo, msg, tipo = 'success') {
  const t   = document.getElementById('toast');
  const box = document.getElementById('toast-icon-box');
  const ico = document.getElementById('toast-icon');
  if (!t) return;
  document.getElementById('toast-title').innerText = titulo;
  document.getElementById('toast-msg').innerText   = msg;
  box.className = `w-10 h-10 rounded-full flex items-center justify-center ${tipo === 'success' ? 'bg-emerald-500' : tipo === 'error' ? 'bg-red-500' : 'bg-[#ec9731]'}`;
  ico.className = `fa-solid ${tipo === 'success' ? 'fa-check' : tipo === 'error' ? 'fa-xmark' : 'fa-info'}`;
  t.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
  setTimeout(() => t.classList.add('opacity-0', 'scale-90', 'pointer-events-none'), 4000);
}

// ─── Tradução de erros Firebase ───
function traduzirErro(code) {
  const mapa = {
    'auth/email-already-in-use': 'Este email já está em uso.',
    'auth/invalid-email':        'Email inválido.',
    'auth/weak-password':        'Password deve ter pelo menos 6 caracteres.',
    'auth/wrong-password':       'Password incorrecta.',
    'auth/user-not-found':       'Utilizador não encontrado.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/network-request-failed': 'Erro de ligação. Verifique a internet.'
  };
  return mapa[code] || 'Ocorreu um erro. Tente novamente.';
}
