import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const body = document.body;
const pageName = body.dataset.page || "";
const menuButton = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageSelects = document.querySelectorAll("[data-language-select]");

let auth = null;
let db = null;
let currentUser = null;
let currentUserIsAdmin = false;
let authMode = "signin";
let authReadyPromise = null;
let lastLoginTrigger = null;
let lastApplicationTrigger = null;

const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const authCopy = {
  signin: {
    title: "登入社員入口",
    subtitle: "已通過審核並完成付款者，可用你的信箱與密碼登入。",
    submitLabel: "Sign In",
    hint: "如果你還沒建立帳號，請先完成報名審核與付款，再切到註冊。",
  },
  signup: {
    title: "建立社員帳號",
    subtitle: "只有審核通過且已完成付款的申請，才能建立登入帳號。",
    submitLabel: "Create Account",
    hint: "先送出報名申請，等管理員確認資料與付款後，再回來註冊。",
  },
};

const authErrorMessages = {
  "auth/email-already-in-use": "這個信箱已經註冊過了，請直接登入。",
  "auth/invalid-credential": "信箱或密碼不正確，請再確認一次。",
  "auth/invalid-email": "請輸入正確的信箱格式。",
  "auth/missing-password": "請輸入密碼。",
  "auth/network-request-failed": "目前無法連線到 Firebase，請檢查網路後重試。",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
  "auth/user-disabled": "這個帳號目前無法使用，請聯絡管理者。",
  "auth/user-not-found": "找不到這個帳號，請先建立帳號。",
  "auth/weak-password": "密碼強度不足，請至少使用 8 碼。",
};

const loginModalMarkup = `
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
            <a class="button-secondary auth-admin-link" data-auth-admin-link href="./members.html" hidden>審核後台</a>
            <button class="button-secondary auth-signout" data-auth-signout type="button">Sign Out</button>
          </div>
        </div>

        <form class="form-grid" data-login-form novalidate>
          <div class="form-field">
            <label for="login-email">信箱</label>
            <input id="login-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
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

const applicationModalMarkup = `
  <div class="modal" data-application-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="application-title">送出羽球社加入申請</h2>
          <p class="modal-subtitle" data-application-subtitle>先填資料，等管理員審核與確認付款後，你才能建立登入帳號。</p>
        </div>
        <button class="modal-close" data-close-application type="button" aria-label="關閉申請視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <form class="form-grid" data-application-form novalidate>
          <input data-application-type name="applicationType" type="hidden" value="club" />
          <div class="form-field">
            <label for="application-name">姓名</label>
            <input id="application-name" name="name" placeholder="王小明" type="text" autocomplete="name" />
          </div>
          <div class="form-field">
            <label for="application-email">聯絡信箱</label>
            <input id="application-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="application-school">學校 / 單位</label>
            <input id="application-school" name="school" placeholder="臺科大 / 外校 / 其他" type="text" />
          </div>
          <div class="form-field">
            <label for="application-note">備註</label>
            <textarea id="application-note" name="note" rows="4" placeholder="可填寫身份、想報名的內容或付款說明。"></textarea>
          </div>
          <p class="login-note" data-application-hint></p>
          <button class="login-button modal-submit" data-application-submit type="submit">送出申請</button>
        </form>
      </div>
    </div>
  </div>
`;

const getLoginButtons = () => document.querySelectorAll("[data-open-login]");
const getApplicationButtons = () => document.querySelectorAll("[data-open-application]");
const getApprovalDocId = (email) => email.trim().toLowerCase();

const rememberLoginButtonLabels = () => {
  getLoginButtons().forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
  });
};

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

  document.body.insertAdjacentHTML("beforeend", loginModalMarkup);
  return document.querySelector("[data-login-modal]");
};

const ensureApplicationModal = () => {
  const existing = document.querySelector("[data-application-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", applicationModalMarkup);
  return document.querySelector("[data-application-modal]");
};

const getLoginModalElements = () => {
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

const getApplicationModalElements = () => {
  const applicationModal = ensureApplicationModal();

  return {
    applicationModal,
    applicationForm: applicationModal.querySelector("[data-application-form]"),
    applicationHint: applicationModal.querySelector("[data-application-hint]"),
    applicationType: applicationModal.querySelector("[data-application-type]"),
    applicationSubtitle: applicationModal.querySelector("[data-application-subtitle]"),
    submitButton: applicationModal.querySelector("[data-application-submit]"),
    closeButtons: applicationModal.querySelectorAll("[data-close-application]"),
  };
};

const setHint = (message, tone = "default") => {
  const { loginHint } = getLoginModalElements();
  loginHint.textContent = message;
  loginHint.classList.remove("is-error", "is-success");

  if (tone === "error") {
    loginHint.classList.add("is-error");
  } else if (tone === "success") {
    loginHint.classList.add("is-success");
  }
};

const setApplicationHint = (message, tone = "default") => {
  const { applicationHint } = getApplicationModalElements();
  applicationHint.textContent = message;
  applicationHint.classList.remove("is-error", "is-success");

  if (tone === "error") {
    applicationHint.classList.add("is-error");
  } else if (tone === "success") {
    applicationHint.classList.add("is-success");
  }
};

const setAuthMode = (mode) => {
  authMode = mode;

  const { loginModal, authSubtitle, authSubmit, authTabs, confirmField, confirmInput, passwordInput } =
    getLoginModalElements();

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
  const { loginForm, statusCard, statusEmail, statusHint, adminLink, signOutButton } = getLoginModalElements();

  if (currentUser) {
    loginForm.hidden = true;
    statusCard.hidden = false;
    signOutButton.hidden = false;
    adminLink.hidden = !currentUserIsAdmin;
    statusEmail.textContent = currentUser.email || "";
    statusHint.textContent = currentUserIsAdmin ? "你目前是管理員，可以進入審核後台。" : "你已登入社員入口。";
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
const getApprovalDocRef = (email) => doc(db, "signupApprovals", getApprovalDocId(email));

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
  const { loginModal, emailInput } = getLoginModalElements();
  lastLoginTrigger = trigger || null;
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
  const { loginModal } = getLoginModalElements();
  loginModal.hidden = true;
  body.classList.remove("modal-open");

  if (lastLoginTrigger) {
    lastLoginTrigger.focus();
  }
};

const openApplicationModal = (trigger) => {
  const { applicationModal, applicationType, applicationSubtitle } = getApplicationModalElements();
  const type = "club";

  lastApplicationTrigger = trigger || null;
  applicationType.value = type;
  applicationSubtitle.textContent = "先送出羽球社加入申請，等管理員審核與確認付款後，你才能建立登入帳號。";
  applicationModal.hidden = false;
  body.classList.add("modal-open");
  setApplicationHint("送出後，管理員會在後台看到你的申請。");

  const firstInput = applicationModal.querySelector("input, textarea");
  if (firstInput) {
    window.setTimeout(() => firstInput.focus(), 50);
  }
};

const closeApplicationModal = () => {
  const { applicationModal } = getApplicationModalElements();
  applicationModal.hidden = true;
  body.classList.remove("modal-open");

  if (lastApplicationTrigger) {
    lastApplicationTrigger.focus();
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

const ensureSignupApproved = async (email) => {
  if (!db) {
    return false;
  }

  const approvalDoc = await getDoc(getApprovalDocRef(email));
  return approvalDoc.exists();
};

const syncApprovalFromApplication = async (applicationId, data) => {
  const approvalRef = getApprovalDocRef(data.email || "");

  if (data.approved && data.paid) {
    await setDoc(
      approvalRef,
      {
        email: data.email || "",
        applicationId,
        applicationType: data.applicationType || "club",
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  const approvalDoc = await getDoc(approvalRef);
  if (approvalDoc.exists()) {
    await deleteDoc(approvalRef);
  }
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

const renderApplications = async () => {
  const applicationList = document.querySelector("[data-application-list]");
  if (!applicationList) {
    return;
  }

  const applicationsQuery = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
  const snapshot = await getDocs(applicationsQuery);
  const applications = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

  if (applications.length === 0) {
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有待處理申請</h3>
        <p class="content-copy">等有人送出社團或社課申請後，這裡就會出現通知。</p>
      </article>
    `;
    return;
  }

  applicationList.innerHTML = applications
    .map((application) => {
      const approved = Boolean(application.approved);
      const paid = Boolean(application.paid);
      return `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">社團申請</p>
            <p class="member-row-status">${approved && paid ? "ready" : "pending"}</p>
          </div>
          <p class="member-row-email">${application.name || "未填姓名"} / ${application.email || "未填信箱"}</p>
          <div class="member-row-meta">
            <span>學校 / 單位：${application.school || "未填寫"}</span>
            <span>送出時間：${formatTimestamp(application.submittedAt)}</span>
            <span>備註：${application.note || "無"}</span>
          </div>
          <div class="application-actions">
            <button class="button-secondary application-toggle" data-application-action="approve" data-application-id="${application.id}" data-approved="${approved}">
              ${approved ? "取消審核通過" : "審核通過"}
            </button>
            <button class="button-secondary application-toggle" data-application-action="paid" data-application-id="${application.id}" data-paid="${paid}">
              ${paid ? "取消付款完成" : "付款完成"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  applicationList.querySelectorAll("[data-application-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.applicationId;
      const action = button.dataset.applicationAction;
      const applicationRef = doc(db, "applications", id);
      const currentDoc = await getDoc(applicationRef);

      if (!currentDoc.exists()) {
        return;
      }

      const data = currentDoc.data();
      const nextData =
        action === "approve"
          ? { approved: !Boolean(data.approved), updatedAt: serverTimestamp() }
          : { paid: !Boolean(data.paid), updatedAt: serverTimestamp() };

      await updateDoc(applicationRef, nextData);
      const updatedDoc = await getDoc(applicationRef);
      await syncApprovalFromApplication(id, updatedDoc.data());
      await renderMembersPage();
    });
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
      <p class="content-copy">先用右上角 <code>Sign In</code> 登入，再回到這裡查看待審核名單。</p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">這個帳號目前沒有管理權限</h2>
      <p class="content-copy">請在 Firestore 建立 <code>admins/${currentUser.uid}</code> 文件後，再重新整理頁面。</p>
    `;
    return;
  }

  gate.hidden = true;
  content.hidden = false;

  const membersQuery = query(collection(db, "members"), orderBy("createdAt", "desc"));
  const membersSnapshot = await getDocs(membersQuery);
  const members = membersSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

  const applicationsQuery = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
  const applicationsSnapshot = await getDocs(applicationsQuery);
  const applications = applicationsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const pendingApplications = applications.filter((application) => !application.approved || !application.paid);

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">待審核申請</p>
      <p class="member-stat-value">${pendingApplications.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">已建立帳號</p>
      <p class="member-stat-value">${members.length}</p>
    </article>
  `;

  await renderApplications();

  const memberRows = members
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

  list.innerHTML = memberRows || `
    <article class="content-card is-tight">
      <h3 class="content-title">目前還沒有已註冊帳號</h3>
      <p class="content-copy">等申請通過、付款完成且註冊成功後，這裡就會出現帳號名單。</p>
    </article>
  `;
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();

  const { emailInput, passwordInput, confirmInput, authSubmit } = getLoginModalElements();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;

  if (!firebaseConfigured) {
    setHint("Firebase 尚未設定完成。請先填寫 src/firebase-config.js。", "error");
    return;
  }

  if (!email.includes("@")) {
    setHint("請輸入正確的信箱。", "error");
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
      const approved = await ensureSignupApproved(email);
      if (!approved) {
        setHint("這個信箱尚未完成審核或付款，請先到報名頁送出申請。", "error");
        return;
      }

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

const handleApplicationSubmit = async (event) => {
  event.preventDefault();

  const { applicationForm, applicationHint, submitButton } = getApplicationModalElements();
  const formData = new FormData(applicationForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const school = String(formData.get("school") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const applicationType = String(formData.get("applicationType") || "club");

  if (!firebaseConfigured) {
    setApplicationHint("Firebase 尚未設定完成。請先填寫 src/firebase-config.js。", "error");
    return;
  }

  if (!name || !email || !school) {
    setApplicationHint("請至少填寫姓名、信箱與學校 / 單位。", "error");
    return;
  }

  submitButton.disabled = true;

  try {
    await ensureAuthReady();

    await addDoc(collection(db, "applications"), {
      name,
      email,
      school,
      note,
      applicationType,
      approved: false,
      paid: false,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    applicationForm.reset();
    setApplicationHint("申請已送出。等管理員審核並確認付款後，你就能建立登入帳號。", "success");
  } catch (error) {
    applicationHint.textContent = "送出申請時發生問題，請稍後再試。";
    applicationHint.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
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
  const { loginModal, loginForm, authTabs, signOutButton, closeButtons } = getLoginModalElements();

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

const bindApplicationModalEvents = () => {
  const { applicationModal, applicationForm, closeButtons } = getApplicationModalElements();

  applicationForm.addEventListener("submit", handleApplicationSubmit);

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeApplicationModal);
  });

  applicationModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target === applicationModal || target.hasAttribute("data-modal-backdrop")) {
      closeApplicationModal();
    }
  });
};

const bindOpenButtons = () => {
  rememberLoginButtonLabels();

  getLoginButtons().forEach((button) => {
    button.addEventListener("click", () => openLoginModal(button));
  });

  getApplicationButtons().forEach((button) => {
    button.addEventListener("click", () => openApplicationModal(button));
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

      const { loginModal } = getLoginModalElements();
      const { applicationModal } = getApplicationModalElements();

      if (!loginModal.hidden) {
        closeLoginModal();
      }

      if (!applicationModal.hidden) {
        closeApplicationModal();
      }
    }
  });
};

const init = async () => {
  ensureLoginModal();
  ensureApplicationModal();
  bindLoginModalEvents();
  bindApplicationModalEvents();
  bindOpenButtons();
  initMenu();
  initLanguageSwitcher();
  initFaqAccordion();
  initKeybindings();
  setAuthMode("signin");
  updateLoginButtons();

  if (firebaseConfigured) {
    await ensureAuthReady();
  } else {
    setHint("這裡已經接好 Firebase 流程，下一步只要填入設定就能啟用。");
  }

  if (pageName === "members") {
    await renderMembersPage();
  }
};

init();
