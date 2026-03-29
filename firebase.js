// ═══════════════════════════════════════════════════
//  SONS BWE FIXES — Firebase Integration
//  Substitua os valores abaixo com os dados do seu
//  projecto no Firebase Console:
//  https://console.firebase.google.com
// ═══════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ─── ⚠️ SUBSTITUA AQUI COM AS SUAS CREDENCIAIS FIREBASE ───
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};

// ─── INICIALIZAR ───
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);
const provider = new GoogleAuthProvider();

// ════════════════════════════════════════
//  AUTH — Autenticação
// ════════════════════════════════════════

/** Login com email e password */
export async function loginEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: traduzirErro(e.code) };
  }
}

/** Registo com email e password */
export async function registerEmail(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Guardar perfil do utilizador no Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      displayName: displayName || "Utilizador",
      email: email,
      role: "fan",          // "fan" ou "admin"
      plan: "basic",        // "basic" ou "premium"
      tracksPlayed: 0,
      likes: [],
      downloads: [],
      playlists: [],
      joinedAt: serverTimestamp()
    });
    return { user: cred.user, error: null };
  } catch (e) {
    return { user: null, error: traduzirErro(e.code) };
  }
}

/** Login com Google */
export async function loginGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    // Criar perfil se não existir
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: "fan",
        plan: "basic",
        tracksPlayed: 0,
        likes: [],
        downloads: [],
        playlists: [],
        joinedAt: serverTimestamp()
      });
    }
    return { user, error: null };
  } catch (e) {
    return { user: null, error: traduzirErro(e.code) };
  }
}

/** Logout */
export async function logout() {
  await signOut(auth);
}

/** Observar estado de autenticação */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Obter perfil do utilizador */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ════════════════════════════════════════
//  MÚSICAS — CRUD
// ════════════════════════════════════════

/** Listar todas as músicas activas (tempo real) */
export function listenTracks(callback) {
  const q = query(collection(db, "tracks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(tracks);
  });
}

/** Listar músicas por categoria */
export function listenTracksByCategory(cat, callback) {
  const q = query(
    collection(db, "tracks"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    const tracks = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.cat === cat && t.active !== false);
    callback(tracks);
  });
}

/** Adicionar nova música (admin) */
export async function addTrack(trackData, audioFile, coverFile) {
  try {
    let audioURL = null;
    let coverURL = null;

    // Upload do ficheiro de áudio
    if (audioFile) {
      const audioRef = ref(storage, `audio/${Date.now()}_${audioFile.name}`);
      const uploadAudio = await uploadBytesResumable(audioRef, audioFile);
      audioURL = await getDownloadURL(uploadAudio.ref);
    }

    // Upload da capa
    if (coverFile) {
      const coverRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
      const uploadCover = await uploadBytesResumable(coverRef, coverFile);
      coverURL = await getDownloadURL(uploadCover.ref);
    }

    const docRef = await addDoc(collection(db, "tracks"), {
      ...trackData,
      audioURL,
      coverURL,
      listeners: 0,
      likes: 0,
      downloads: 0,
      active: true,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, error: null };
  } catch (e) {
    return { id: null, error: e.message };
  }
}

/** Editar música (admin) */
export async function updateTrack(trackId, data) {
  try {
    await updateDoc(doc(db, "tracks", trackId), {
      ...data,
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

/** Eliminar música (admin) */
export async function deleteTrack(trackId, audioURL, coverURL) {
  try {
    await deleteDoc(doc(db, "tracks", trackId));
    // Apagar ficheiros do Storage
    if (audioURL) await deleteObject(ref(storage, audioURL)).catch(() => {});
    if (coverURL) await deleteObject(ref(storage, coverURL)).catch(() => {});
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

/** Activar / Desactivar música (admin) */
export async function toggleTrackActive(trackId, currentState) {
  await updateDoc(doc(db, "tracks", trackId), { active: !currentState });
}

/** Incrementar contador de ouvintes */
export async function incrementListeners(trackId) {
  await updateDoc(doc(db, "tracks", trackId), {
    listeners: increment(1)
  });
}

/** Incrementar contador de downloads */
export async function incrementDownloads(trackId) {
  await updateDoc(doc(db, "tracks", trackId), {
    downloads: increment(1)
  });
}

// ════════════════════════════════════════
//  LIKES — por utilizador
// ════════════════════════════════════════

/** Dar / retirar like numa música */
export async function toggleLikeTrack(uid, trackId) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const likes = snap.data().likes || [];
  const isLiked = likes.includes(trackId);

  await updateDoc(userRef, {
    likes: isLiked
      ? likes.filter(id => id !== trackId)
      : [...likes, trackId]
  });
  // Actualizar contador global na música
  await updateDoc(doc(db, "tracks", trackId), {
    likes: increment(isLiked ? -1 : 1)
  });
  return !isLiked;
}

// ════════════════════════════════════════
//  PLAYLISTS — do utilizador
// ════════════════════════════════════════

/** Criar playlist */
export async function createPlaylist(uid, name) {
  const ref2 = await addDoc(collection(db, "users", uid, "playlists"), {
    name,
    tracks: [],
    createdAt: serverTimestamp()
  });
  return ref2.id;
}

/** Adicionar faixa à playlist */
export async function addToPlaylist(uid, playlistId, trackId) {
  const plRef = doc(db, "users", uid, "playlists", playlistId);
  const snap = await getDoc(plRef);
  if (!snap.exists()) return;
  const tracks = snap.data().tracks || [];
  if (!tracks.includes(trackId)) {
    await updateDoc(plRef, { tracks: [...tracks, trackId] });
  }
}

// ════════════════════════════════════════
//  ÁLBUNS / CATEGORIAS
// ════════════════════════════════════════

/** Listar álbuns (tempo real) */
export function listenAlbums(callback) {
  const q = query(collection(db, "albums"), orderBy("year", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Adicionar álbum */
export async function addAlbum(albumData) {
  return await addDoc(collection(db, "albums"), {
    ...albumData,
    createdAt: serverTimestamp()
  });
}

// ════════════════════════════════════════
//  STATS (Admin)
// ════════════════════════════════════════

/** Obter estatísticas globais */
export async function getStats() {
  const [tracksSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "tracks")),
    getDocs(collection(db, "users"))
  ]);
  const tracks = tracksSnap.docs.map(d => d.data());
  return {
    totalTracks:    tracks.length,
    totalListeners: tracks.reduce((a, t) => a + (t.listeners || 0), 0),
    totalLikes:     tracks.reduce((a, t) => a + (t.likes || 0), 0),
    totalDownloads: tracks.reduce((a, t) => a + (t.downloads || 0), 0),
    totalUsers:     usersSnap.size
  };
}

// ─── UTILITÁRIO ───
function traduzirErro(code) {
  const erros = {
    "auth/user-not-found":       "Utilizador não encontrado.",
    "auth/wrong-password":       "Password incorrecta.",
    "auth/email-already-in-use": "Email já está em uso.",
    "auth/weak-password":        "Password demasiado fraca (mín. 6 caracteres).",
    "auth/invalid-email":        "Email inválido.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/network-request-failed":"Erro de ligação. Verifique a internet."
  };
  return erros[code] || "Ocorreu um erro. Tente novamente.";
}

export { auth, db, storage };
