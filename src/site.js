import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { allowedEmailDomain, firebaseConfig } from "./firebase-config.js";

const body = document.body;
const pageName = body.dataset.page || "";
const menuButton = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageSelects = document.querySelectorAll("[data-language-select]");

let auth = null;
let db = null;
let authMode = "signin";
let authReadyPromise = null;
let currentUser = null;
let lastTrigger = null;
let currentUserIsAdmin = false;

const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const authCopy = {
  signin: {
    title: "登入社員入口",
    subtitle: `請使用 ${allowedEmailDomain} 信箱與你設定的密碼登入。`,
    submitLabel: "Sign In",
    hint: `第一次使用請先建立帳號，只接受 ${allowedEmailDomain} 信箱。`,
  },
  signup: {
    title: "建立社員帳號",
    subtitle: `使用 ${allowedEmailDomain} 信箱註冊，之後就能直接登入。`,
    submitLabel: "Create Account",
    hint: "密碼建議至少 8 碼，建立完成後會自動登入。",
  },
};

const authErrorMessages = {
  "auth/email-already-in-use": "這個學校信箱已經註冊過了，請直接登入。",
  "auth/invalid-credential": "信箱或密碼不正確，請再確認一次。",
  "auth/invalid-email": "請輸入正確的學校信箱格式。",
  "auth/missing-password": "請輸入密碼。",
  "auth/network-request-failed": "目前無法連線到 Firebase，請檢查網路後重試。",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
  "auth/user-disabled": "這個帳號目前無法使用，請聯絡管理者。",
  "auth/user-not-found": "找不到這個帳號，請先建立帳號。",
  "auth/weak-password": "密碼強度不足，請至少使用 8 碼。",
};

const modalMarkup = `
  <div class="modal" data-login-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="login-title">登入社員入口</h2>
          <p class="modal-subtitle" data-auth-subtitle></p>
        </div>
        <button class="modal-close" data-close-login type="button" aria-label="關閉登入視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="auth-switch" role="tablist" aria-label="登入模式切換">
          <button class="auth-tab is-active" data-auth-tab="signin" type="button" role="tab" aria-selected="true">
            登入
          </button>
          <button class="auth-tab" data-auth-tab="signup" type="button" role="tab" aria-selected="false">
            註冊
          </button>
        </div>

        <div class="auth-status-card" data-auth-status hidden>
          <p class="auth-status-label">Signed In</p>
          <p class="auth-status-email" data-auth-email></p>
          <p class="login-note" data-auth-status-hint></p>
          <div class="auth-status-actions">
            <a class="button-secondary auth-admin-link" data-auth-admin-link href="./members.html" hidden>會員名單</a>
            <button class="button-secondary auth-signout" data-auth-signout type="button">Sign Out</button>
          </div>
        </div>

        <form class="form-grid" data-login-form novalidate>
          <div class="form-field">
            <label for="login-email">學校信箱</label>
            <input
              id="login-email"
              name="email"
              placeholder="b11207001@mail.ntust.edu.tw"
              type="email"
              autocomplete="email"
            />
          </div>
          <div class="form-field">
            <label for="login-password">密碼</label>
            <input
              id="login-password"
              name="password"
              placeholder="至少 8 碼"
              type="password"
              autocomplete="current-password"
            />
          </div>
          <div class="form-field" data-auth-confirm-field hidden>
            <label for="login-password-confirm">確認密碼</label>
            <input
              id="login-password-confirm"
              name="passwordConfirm"
              placeholder="再次輸入密碼"
              type="password"
              autocomplete="new-password"
            />
          </div>
          <p class="login-note" data-login-hint></p>
          <button class="login-button modal-submit" data-auth-submit type="submit">Sign In</button>
        </form>
      </div>
    </div>
  </div>
`;

const getLoginButtons = () => document.querySelectorAll("[data-open-login]");

const rememberLoginButtonLabels = () => {
  getLoginButtons().forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
  });
};

const normalizeSchoolEmail = (email) => email.trim().toLowerCase();
const isAllowedSchoolEmail = (email) => normalizeSchoolEmail(email).endsWith(allowedEmailDomain);

const getFriendlyAuthError = (error) =>
  authErrorMessages[error.code] || "登入流程出了點問題，請稍後再試一次。";

const closeMobileNav = () => {
  if (!menuButton || !mobileNav) {
    return;
  }

  menuButton.setAttribute("aria-expanded", "false");
  mobileNav.classList.remove("is-open");
};

const ensureLoginModal = () => {
  const existing = document.querySelector("[data-login-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", modalMarkup);
  return document.querySelector("[data-login-modal]");
};

const getModalElements = () => {
  const loginModal = ensureLoginModal();

  return {
    loginModal,
    loginForm: loginModal.querySelector("[data-login-form]"),
    loginHint: loginModal.querySelector("[data-login-hint]"),
    authSubtitle: loginModal.querySelector("[data-auth-subtitle]"),
    authSubmit: loginModal.querySelector("[data-auth-submit]"),
    authTabs: loginModal.querySelectorAll("[data-auth-tab]"),
    confirmField: loginModal.querySelector("[data-auth-confirm-field]"),
    confirmInput: loginModal.querySelector("#login-password-confirm"),
    emailInput: loginModal.querySelector("#login-email"),
    passwordInput: loginModal.querySelector("#login-password"),
    statusCard: loginModal.querySelector("[data-auth-status]"),
    statusEmail: loginModal.querySelector("[data-auth-email]"),
    statusHint: loginModal.querySelector("[data-auth-status-hint]"),
    adminLink: loginModal.querySelector("[data-auth-admin-link]"),
    signOutButton: loginModal.querySelector("[data-auth-signout]"),
    closeButtons: loginModal.querySelectorAll("[data-close-login]"),
  };
};

const setHint = (message, tone = "default") => {
  const { loginHint } = getModalElements();
  loginHint.textContent = message;
  loginHint.classList.remove("is-error", "is-success");

  if (tone === "error") {
    loginHint.classList.add("is-error");
  } else if (tone === "success") {
    loginHint.classList.add("is-success");
  }
};

const setAuthMode = (mode) => {
  authMode = mode;

  const { loginModal, authSubtitle, authSubmit, authTabs, confirmField, confirmInput, passwordInput } =
    getModalElements();

  loginModal.querySelector(".modal-title").textContent = authCopy[mode].title;
  authSubtitle.textContent = authCopy[mode].subtitle;
  authSubmit.textContent = authCopy[mode].submitLabel;
  confirmField.hidden = mode !== "signup";

  if (mode === "signup") {
    passwordInput.setAttribute("autocomplete", "new-password");
  } else {
    passwordInput.setAttribute("autocomplete", "current-password");
    confirmInput.value = "";
  }

  authTabs.forEach((tab) => {
    const active = tab.dataset.authTab === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  if (!currentUser) {
    setHint(authCopy[mode].hint);
  }
};

const updateAuthView = () => {
  const { loginForm, statusCard, statusEmail, statusHint, adminLink, signOutButton } = getModalElements();

  if (currentUser) {
    loginForm.hidden = true;
    statusCard.hidden = false;
    signOutButton.hidden = false;
    adminLink.hidden = !currentUserIsAdmin;
    statusEmail.textContent = currentUser.email || "";
    statusHint.textContent = currentUserIsAdmin
      ? "你目前是管理員，可以查看會員名單。"
      : "你已登入社員入口。";
    return;
  }

  loginForm.hidden = false;
  statusCard.hidden = true;
  signOutButton.hidden = true;
  adminLink.hidden = true;
  statusEmail.textContent = "";
  statusHint.textContent = "";
  setAuthMode(authMode);
};

const updateLoginButtons = () => {
  rememberLoginButtonLabels();

  getLoginButtons().forEach((button) => {
    if (button.classList.contains("login-button")) {
      button.textContent = currentUser ? "Account" : button.dataset.defaultLabel;
    }
  });
};

const getAdminDocRef = (uid) => doc(db, "admins", uid);
const getMemberDocRef = (uid) => doc(db, "members", uid);

const loadAdminStatus = async (user) => {
  if (!db || !user?.uid) {
    currentUserIsAdmin = false;
    return false;
  }

  const adminDoc = await getDoc(getAdminDocRef(user.uid));
  currentUserIsAdmin = adminDoc.exists();
  return currentUserIsAdmin;
};

const ensureAuthReady = async () => {
  if (authReadyPromise) {
    return authReadyPromise;
  }

  if (!firebaseConfigured) {
    setHint("請先在 src/firebase-config.js 填入 Firebase 專案設定。");
    return null;
  }

  authReadyPromise = (async () => {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      currentUserIsAdmin = false;

      if (user) {
        await loadAdminStatus(user);
      }

      updateLoginButtons();
      updateAuthView();

      if (pageName === "members") {
        await renderMembersPage();
      }
    });

    return auth;
  })();

  return authReadyPromise;
};

const openLoginModal = async (trigger) => {
  const { loginModal, emailInput } = getModalElements();
  lastTrigger = trigger || null;
  loginModal.hidden = false;
  body.classList.add("modal-open");

  if (firebaseConfigured) {
    await ensureAuthReady();
  }

  updateAuthView();

  if (!currentUser) {
    window.setTimeout(() => emailInput.focus(), 50);
  }
};

const closeLoginModal = () => {
  const { loginModal } = getModalElements();
  loginModal.hidden = true;
  body.classList.remove("modal-open");

  if (lastTrigger) {
    lastTrigger.focus();
  }
};

const applyLanguage = (lang) => {
  document.documentElement.lang = lang;
  body.dataset.language = lang;

  languageSelects.forEach((select) => {
    select.value = lang;
  });

  window.localStorage.setItem("ntust-badminton-language", lang);
};

const syncMemberProfile = async (user, source) => {
  if (!db || !user?.uid) {
    return;
  }

  const memberRef = getMemberDocRef(user.uid);
  const existingDoc = await getDoc(memberRef);
  const payload = {
    uid: user.uid,
    email: user.email || "",
    lastLoginAt: serverTimestamp(),
    source,
    updatedAt: serverTimestamp(),
  };

  if (!existingDoc.exists()) {
    payload.createdAt = serverTimestamp();
    payload.status = "active";
  }

  await setDoc(memberRef, payload, { merge: true });
};

const formatTimestamp = (value) => {
  if (!value?.toDate) {
    return "尚未記錄";
  }

  return value.toDate().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderMembersPage = async () => {
  if (pageName !== "members") {
    return;
  }

  const gate = document.querySelector("[data-members-gate]");
  const content = document.querySelector("[data-members-content]");
  const summary = document.querySelector("[data-members-summary]");
  const list = document.querySelector("[data-members-list]");

  if (!gate || !content || !summary || !list) {
    return;
  }

  if (!firebaseConfigured) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">尚未完成 Firebase 設定</h2>
      <p class="content-copy">請先在 <code>src/firebase-config.js</code> 填入 Firebase 專案資訊。</p>
    `;
    return;
  }

  if (!currentUser) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">請先登入管理頁</h2>
      <p class="content-copy">先用右上角 <code>Sign In</code> 登入，再回到這裡查看名單。</p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">這個帳號目前沒有管理權限</h2>
      <p class="content-copy">請到 Firestore 建立 <code>admins/${currentUser.uid}</code> 文件，之後重新整理頁面。</p>
    `;
    return;
  }

  gate.hidden = true;
  content.hidden = false;

  const membersQuery = query(collection(db, "members"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(membersQuery);
  const members = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">總註冊人數</p>
      <p class="member-stat-value">${members.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">目前登入管理者</p>
      <p class="member-stat-value member-stat-value-small">${currentUser.email || "未登入"}</p>
    </article>
  `;

  if (members.length === 0) {
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前還沒有註冊資料</h3>
        <p class="content-copy">等第一位社員完成註冊後，這裡就會出現名單。</p>
      </article>
    `;
    return;
  }

  list.innerHTML = members
    .map(
      (member, index) => `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">#${String(index + 1).padStart(2, "0")}</p>
            <p class="member-row-status">${member.status || "active"}</p>
          </div>
          <p class="member-row-email">${member.email || "未提供信箱"}</p>
          <div class="member-row-meta">
            <span>UID：${member.uid || member.id}</span>
            <span>建立時間：${formatTimestamp(member.createdAt)}</span>
            <span>最近登入：${formatTimestamp(member.lastLoginAt)}</span>
          </div>
        </article>
      `,
    )
    .join("");
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();

  const { emailInput, passwordInput, confirmInput, authSubmit } = getModalElements();
  const email = normalizeSchoolEmail(emailInput.value);
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;

  if (!firebaseConfigured) {
    setHint("Firebase 尚未設定完成，請先填寫 src/firebase-config.js。", "error");
    return;
  }

  if (!isAllowedSchoolEmail(email)) {
    setHint(`只接受 ${allowedEmailDomain} 信箱註冊或登入。`, "error");
    return;
  }

  if (password.length < 8) {
    setHint("密碼至少需要 8 碼。", "error");
    return;
  }

  if (authMode === "signup" && password !== passwordConfirm) {
    setHint("兩次輸入的密碼不一致。", "error");
    return;
  }

  authSubmit.disabled = true;

  try {
    const readyAuth = await ensureAuthReady();
    if (!readyAuth) {
      return;
    }

    if (authMode === "signup") {
      const credential = await createUserWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signup");
      setHint("帳號建立完成，已自動登入。", "success");
    } else {
      const credential = await signInWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signin");
      setHint("登入成功。", "success");
    }

    event.target.reset();
  } catch (error) {
    setHint(getFriendlyAuthError(error), "error");
  } finally {
    authSubmit.disabled = false;
  }
};

const handleSignOut = async () => {
  if (!auth) {
    return;
  }

  try {
    await signOut(auth);
    setHint("你已登出。");
    closeLoginModal();
  } catch (error) {
    setHint(getFriendlyAuthError(error), "error");
  }
};

const bindLoginModalEvents = () => {
  const { loginModal, loginForm, authTabs, signOutButton, closeButtons } = getModalElements();

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", handleAuthSubmit);
  signOutButton.addEventListener("click", handleSignOut);

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeLoginModal);
  });

  loginModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target === loginModal || target.hasAttribute("data-modal-backdrop")) {
      closeLoginModal();
    }
  });
};

const bindOpenLoginButtons = () => {
  rememberLoginButtonLabels();

  getLoginButtons().forEach((button) => {
    button.addEventListener("click", () => openLoginModal(button));
  });
};

const initMenu = () => {
  if (!menuButton || !mobileNav) {
    return;
  }

  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    mobileNav.classList.toggle("is-open", !expanded);
  });

  document.querySelectorAll(".mobile-nav a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });
};

const initLanguageSwitcher = () => {
  if (languageSelects.length === 0) {
    return;
  }

  const savedLanguage = window.localStorage.getItem("ntust-badminton-language") || "zh-Hant";
  applyLanguage(savedLanguage);

  languageSelects.forEach((select) => {
    select.addEventListener("change", (event) => {
      applyLanguage(event.target.value);
    });
  });
};

const initFaqAccordion = () => {
  document.querySelectorAll("[data-faq-accordion]").forEach((group) => {
    const items = Array.from(group.querySelectorAll(".faq-item"));

    items.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) {
          return;
        }

        items.forEach((otherItem) => {
          if (otherItem !== item) {
            otherItem.open = false;
          }
        });
      });
    });
  });
};

const initKeybindings = () => {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();

      const { loginModal } = getModalElements();
      if (!loginModal.hidden) {
        closeLoginModal();
      }
    }
  });
};

const init = async () => {
  ensureLoginModal();
  bindLoginModalEvents();
  bindOpenLoginButtons();
  initMenu();
  initLanguageSwitcher();
  initFaqAccordion();
  initKeybindings();
  setAuthMode("signin");
  updateLoginButtons();

  if (firebaseConfigured) {
    await ensureAuthReady();
  } else {
    setHint("這裡已經接好 Firebase 登入流程，下一步只要填入 Firebase 設定就能啟用。");
  }

  if (pageName === "members") {
    await renderMembersPage();
  }
};

init();
