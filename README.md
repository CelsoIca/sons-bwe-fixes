# 🎵 Sons Bwe Fixes — Music Streaming

Web app de streaming de música moderna com integração Firebase.

---

## 📁 Estrutura de Ficheiros

```
sons-bwe-fixes/
├── index.html     ← Página principal (HTML)
├── style.css      ← Todos os estilos (paleta ATLA)
├── app.js         ← Lógica da aplicação (ES Modules)
├── firebase.js    ← Integração Firebase (Auth, Firestore, Storage)
└── README.md      ← Este ficheiro
```

---

## 🚀 Como Configurar o Firebase

### 1. Criar Projecto Firebase
1. Acede a [console.firebase.google.com](https://console.firebase.google.com)
2. Clica em **"Adicionar projecto"**
3. Dá um nome: `sons-bwe-fixes`
4. Clica em **Continuar** até criar

### 2. Activar Serviços

**Authentication:**
- No menu lateral → **Authentication** → **Começar**
- Activa **Email/Password** e **Google**

**Firestore Database:**
- No menu lateral → **Firestore Database** → **Criar base de dados**
- Escolhe **Modo de produção** e a região mais próxima

**Storage:**
- No menu lateral → **Storage** → **Começar**
- Aceita as regras padrão

### 3. Obter as Credenciais
1. Vai a ⚙️ **Definições do projecto**
2. Em **"As suas apps"** → clica em **`</>`** (Web)
3. Regista a app com o nome `sons-bwe-fixes`
4. Copia o objecto `firebaseConfig`

### 4. Colar as Credenciais
Abre o ficheiro `firebase.js` e substitui:

```javascript
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",          // ← substitui
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};
```

### 5. Configurar Regras do Firestore
No Firebase Console → Firestore → **Regras**, cola:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Qualquer utilizador autenticado pode ler músicas
    match /tracks/{trackId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Cada utilizador gere o seu próprio perfil
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Playlists do utilizador
    match /users/{userId}/playlists/{playlistId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Álbuns — só admin escreve
    match /albums/{albumId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 6. Configurar Regras do Storage
No Firebase Console → Storage → **Regras**, cola:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /audio/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /covers/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 7. Criar Conta de Administrador
1. Regista uma conta normal na app
2. No Firebase Console → Firestore → colecção `users`
3. Encontra o documento do teu utilizador
4. Edita o campo `role` de `"fan"` para `"admin"`
5. Recarrega a app — o menu de Administrador aparecerá

---

## 🌐 Hospedar no GitHub Pages

1. Cria um repositório público no GitHub: `sons-bwe-fixes`
2. Faz upload de todos os 4 ficheiros
3. Vai a **Settings → Pages**
4. Em Branch selecciona `main` e pasta `/(root)`
5. Clica **Save**
6. O site fica disponível em: `https://teu-username.github.io/sons-bwe-fixes/`

### ⚠️ Importante — Domínio Autorizado no Firebase
Após hospedar, vai ao Firebase Console:
- **Authentication → Settings → Domínios autorizados**
- Adiciona: `teu-username.github.io`

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🔐 Login / Registo | Email + Google OAuth |
| 🎵 Player | Play, pause, próxima, anterior, shuffle, repeat |
| ⬇️ Download | Download directo com contador no Firestore |
| ❤️ Likes | Sistema de likes por utilizador |
| 📂 Categorias | Álbuns, EPs, Singles, Mixtapes |
| 🔍 Pesquisa | Filtro em tempo real |
| 👤 Perfil de Fã | Estatísticas, favoritos, actividade |
| ⚙️ Admin | Gestão de músicas, upload, edição, desactivação |
| 📊 Analytics | Ouvintes, likes, downloads em tempo real |
| 🔄 Tempo Real | Dados sincronizados via Firestore `onSnapshot` |

---

## 🎨 Paleta de Cores (ATLA)

| Cor | Hex | Uso |
|---|---|---|
| Azul médio | `#314595` | Superfícies, sidebar, cards |
| Azul escuro | `#223488` | Fundo profundo, gradientes |
| Laranja | `#ec9731` | Botões, player, accents |
| Branco | `#ffffff` | Texto principal |
