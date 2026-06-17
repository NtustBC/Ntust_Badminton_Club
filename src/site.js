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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { bootstrapAdminEmail, firebaseConfig } from "./firebase-config.js";

const body = document.body;
const pageName = body.dataset.page || "";
const menuButton = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageSelects = document.querySelectorAll("[data-language-select]");

const STORAGE_KEYS = {
  language: "ntust-badminton-language",
  customAcademicYears: "ntust-badminton-custom-academic-years",
  applicationCooldownPrefix: "ntust-badminton-application-cooldown",
};

const DEFAULT_TERMS = ["上學期", "下學期", "未設定"];
const MIN_ACADEMIC_YEAR = 115;
const APPLICATION_SUBMIT_COOLDOWN_MS = 10 * 60 * 1000;
const bootstrapAdminEmailNormalized = bootstrapAdminEmail.trim().toLowerCase();
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;
let db = null;
let currentUser = null;
let currentUserIsAdmin = false;
let authMode = "signin";
let authReadyPromise = null;
let lastLoginTrigger = null;
let lastApplicationTrigger = null;
let membersDashboardCache = {
  members: [],
  applications: [],
  loaded: false,
};

const memberFilters = {
  year: "all",
  term: "all",
};

const authCopy = {
  signin: {
    title: "會員登入",
    subtitle: "用社員帳號登入後，就能查看管理功能與個人狀態。",
    submitLabel: "Sign In",
    hint: "輸入已建立的帳號密碼即可登入。",
  },
  signup: {
    title: "建立帳號",
    subtitle: "只有審核通過的社員，才能建立登入帳號。",
    submitLabel: "Create Account",
    hint: "請使用申請時填寫的同一個信箱建立帳號。",
  },
};

const signedInCopy = {
  title: "帳號資訊",
  subtitle: "你目前已登入，可以在這裡登出或前往管理頁。",
  buttonLabel: "Sign Out",
};

const authErrorMessages = {
  "auth/email-already-in-use": "這個信箱已經註冊過了，請直接登入。",
  "auth/invalid-credential": "信箱或密碼不正確，請再確認一次。",
  "auth/invalid-email": "請輸入有效的電子郵件信箱。",
  "auth/missing-password": "請輸入密碼。",
  "auth/network-request-failed": "目前無法連上 Firebase，請稍後再試。",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
  "auth/user-disabled": "這個帳號已停用，請聯絡管理員。",
  "auth/user-not-found": "查不到這個帳號，請先建立帳號。",
  "auth/weak-password": "密碼至少需要 8 個字元。",
};

const loginModalMarkup = `
  <div class="modal" data-login-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="login-title">會員登入</h2>
          <p class="modal-subtitle" data-auth-subtitle>${authCopy.signin.subtitle}</p>
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
            建立帳號
          </button>
        </div>

        <div class="auth-status-card" data-auth-status hidden>
          <p class="auth-status-label">Signed In</p>
          <p class="auth-status-email" data-auth-email></p>
          <p class="login-note" data-auth-status-hint></p>
          <div class="auth-status-actions">
            <a class="button-secondary auth-admin-link" data-auth-admin-link href="./members.html" hidden>前往管理頁</a>
          </div>
        </div>

        <form class="form-grid" data-login-form id="login-form" novalidate>
          <div class="form-field">
            <label for="login-email">電子郵件</label>
            <input id="login-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="login-password">密碼</label>
            <input
              id="login-password"
              name="password"
              placeholder="至少 8 個字元"
              type="password"
              autocomplete="current-password"
            />
          </div>
          <div class="form-field" data-auth-confirm-field hidden>
            <label for="login-password-confirm">確認密碼</label>
            <input
              id="login-password-confirm"
              name="passwordConfirm"
              placeholder="再輸入一次密碼"
              type="password"
              autocomplete="new-password"
            />
          </div>
          <p class="login-note" data-login-hint>${authCopy.signin.hint}</p>
        </form>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-auth-submit form="login-form" type="submit">Sign In</button>
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
          <h2 class="modal-title" id="application-title">社員申請</h2>
          <p class="modal-subtitle" data-application-subtitle>填完資料後送出，管理員審核通過後就能建立登入帳號。</p>
        </div>
        <button class="modal-close" data-close-application type="button" aria-label="關閉申請視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <form class="form-grid" data-application-form id="application-form" novalidate>
          <input data-application-type name="applicationType" type="hidden" value="club" />
          <div class="form-field">
            <label for="application-name">姓名</label>
            <input id="application-name" name="name" placeholder="王小明" type="text" autocomplete="name" />
          </div>
          <div class="form-field">
            <label for="application-student-id">學號</label>
            <input id="application-student-id" name="studentId" placeholder="B11303044" type="text" />
          </div>
          <div class="form-field">
            <label for="application-department">系別</label>
            <input id="application-department" name="department" placeholder="機械系" type="text" />
          </div>
          <div class="form-field">
            <label for="application-phone">連絡電話</label>
            <input id="application-phone" name="phone" placeholder="09xx-xxx-xxx" type="tel" autocomplete="tel" />
          </div>
          <div class="form-field">
            <label for="application-email">聯絡信箱</label>
            <input id="application-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="application-note">備註</label>
            <textarea id="application-note" name="note" rows="4" placeholder="想補充的資訊可以寫在這裡"></textarea>
          </div>
          <p class="login-note" data-application-hint>送出後管理員會再審核資料。</p>
        </form>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-application-submit form="application-form" type="submit">送出申請</button>
      </div>
    </div>
  </div>
`;

const applicationSuccessModalMarkup = `
  <div class="modal" data-application-success-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog success-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">申請已送出！</h2>
        </div>
        <button class="modal-close" data-close-application-success type="button" aria-label="關閉送出成功視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="success-modal-copy">
          <p>感謝你申請加入臺科大羽球社！我們已收到你的資料。</p>
          <p>接下來請至你的聯絡信箱查收「社費繳交與審核說明」信件。</p>
          <p class="success-modal-tip">提示：若在收件匣沒看到，請點進垃圾信件匣找找看喔！</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-confirm-application-success type="button">知道了</button>
      </div>
    </div>
  </div>
`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getLoginButtons = () => document.querySelectorAll("[data-open-login]");
const getApplicationButtons = () => document.querySelectorAll("[data-open-application]");
const getApprovalDocId = (email) => email.trim().toLowerCase();
const getApplicationDocId = (email, applicationType = "club") =>
  `${applicationType.trim().toLowerCase()}-${encodeURIComponent(email.trim().toLowerCase())}`;
const getApplicationCooldownKey = (email, applicationType = "club") =>
  `${STORAGE_KEYS.applicationCooldownPrefix}:${getApplicationDocId(email, applicationType)}`;
const isBootstrapAdminEmail = (email) => email.trim().toLowerCase() === bootstrapAdminEmailNormalized;

const rememberLoginButtonLabels = () => {
  getLoginButtons().forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
  });
};

const updateAdminNavigation = () => {
  document.querySelectorAll("[data-admin-nav-link]").forEach((link) => link.remove());

  if (!currentUserIsAdmin) {
    return;
  }

  const makeLink = () => {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = "./members.html";
    link.textContent = "管理頁";
    link.dataset.adminNavLink = "true";
    return link;
  };

  const desktopNav = document.querySelector(".site-nav");
  if (desktopNav) {
    desktopNav.append(makeLink());
  }

  const mobileGrid = document.querySelector(".mobile-nav-grid");
  if (mobileGrid) {
    const loginButton = mobileGrid.querySelector(".login-button");
    const link = makeLink();
    if (loginButton) {
      mobileGrid.insertBefore(link, loginButton);
    } else {
      mobileGrid.append(link);
    }
  }
};

const updateLoginButtons = () => {
  rememberLoginButtonLabels();
  updateAdminNavigation();

  getLoginButtons().forEach((button) => {
    button.textContent = currentUser ? "Account" : button.dataset.defaultLabel;
  });
};

const getFriendlyAuthError = (error) => authErrorMessages[error?.code] || "登入發生問題，請稍後再試一次。";

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

const ensureApplicationSuccessModal = () => {
  const existing = document.querySelector("[data-application-success-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", applicationSuccessModalMarkup);
  return document.querySelector("[data-application-success-modal]");
};

const getLoginModalElements = () => {
  const loginModal = ensureLoginModal();

  return {
    loginModal,
    loginForm: loginModal.querySelector("[data-login-form]"),
    loginHint: loginModal.querySelector("[data-login-hint]"),
    authSubtitle: loginModal.querySelector("[data-auth-subtitle]"),
    authSubmit: loginModal.querySelector("[data-auth-submit]"),
    authSwitch: loginModal.querySelector(".auth-switch"),
    authTabs: loginModal.querySelectorAll("[data-auth-tab]"),
    confirmField: loginModal.querySelector("[data-auth-confirm-field]"),
    confirmInput: loginModal.querySelector("#login-password-confirm"),
    emailInput: loginModal.querySelector("#login-email"),
    passwordInput: loginModal.querySelector("#login-password"),
    statusCard: loginModal.querySelector("[data-auth-status]"),
    statusEmail: loginModal.querySelector("[data-auth-email]"),
    statusHint: loginModal.querySelector("[data-auth-status-hint]"),
    adminLink: loginModal.querySelector("[data-auth-admin-link]"),
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

const getApplicationSuccessModalElements = () => {
  const successModal = ensureApplicationSuccessModal();

  return {
    successModal,
    confirmButton: successModal.querySelector("[data-confirm-application-success]"),
    closeButtons: successModal.querySelectorAll("[data-close-application-success]"),
  };
};

const setMessageTone = (element, message, tone = "default") => {
  element.textContent = message;
  element.classList.remove("is-error", "is-success");

  if (tone === "error") {
    element.classList.add("is-error");
  } else if (tone === "success") {
    element.classList.add("is-success");
  }
};

const setHint = (message, tone = "default") => {
  setMessageTone(getLoginModalElements().loginHint, message, tone);
};

const setApplicationHint = (message, tone = "default") => {
  setMessageTone(getApplicationModalElements().applicationHint, message, tone);
};

const setAuthMode = (mode) => {
  authMode = mode;

  const { loginModal, authSubtitle, authSubmit, authTabs, confirmField, confirmInput, passwordInput } =
    getLoginModalElements();

  loginModal.querySelector(".modal-title").textContent = authCopy[mode].title;
  authSubtitle.textContent = authCopy[mode].subtitle;
  authSubmit.textContent = authCopy[mode].submitLabel;
  confirmField.hidden = mode !== "signup";
  passwordInput.setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");

  if (mode !== "signup") {
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
  const { loginModal, loginForm, statusCard, statusEmail, statusHint, adminLink, authSubmit, authSwitch } =
    getLoginModalElements();

  if (currentUser) {
    loginModal.querySelector(".modal-title").textContent = signedInCopy.title;
    loginModal.querySelector("[data-auth-subtitle]").textContent = signedInCopy.subtitle;
    loginForm.hidden = true;
    statusCard.hidden = false;
    authSwitch.hidden = true;
    statusEmail.textContent = currentUser.email || "";
    statusHint.textContent = currentUserIsAdmin ? "你目前有管理員權限。" : "你已登入社員帳號。";
    adminLink.hidden = !currentUserIsAdmin;
    authSubmit.textContent = signedInCopy.buttonLabel;
    authSubmit.dataset.authAction = "signout";
    authSubmit.removeAttribute("form");
    authSubmit.type = "button";
    return;
  }

  loginModal.querySelector(".modal-title").textContent = authCopy[authMode].title;
  loginModal.querySelector("[data-auth-subtitle]").textContent = authCopy[authMode].subtitle;
  loginForm.hidden = false;
  statusCard.hidden = true;
  authSwitch.hidden = false;
  adminLink.hidden = true;
  statusEmail.textContent = "";
  statusHint.textContent = "";
  authSubmit.textContent = authCopy[authMode].submitLabel;
  authSubmit.dataset.authAction = "submit";
  authSubmit.setAttribute("form", "login-form");
  authSubmit.type = "submit";
  setAuthMode(authMode);
};

const getAdminDocRef = (uid) => doc(db, "admins", uid);
const getMemberDocRef = (uid) => doc(db, "members", uid);
const getApprovalDocRef = (email) => doc(db, "signupApprovals", getApprovalDocId(email));

const loadAdminStatus = async (user) => {
  if (!db || !user?.uid) {
    currentUserIsAdmin = false;
    return false;
  }

  if (isBootstrapAdminEmail(user.email || "")) {
    currentUserIsAdmin = true;
    return true;
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
    setHint("Firebase 尚未設定完成，請先確認 src/firebase-config.js。", "error");
    return null;
  }

  authReadyPromise = (async () => {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      currentUserIsAdmin = false;
      membersDashboardCache.loaded = false;

      if (user) {
        await loadAdminStatus(user);
      }

      updateLoginButtons();
      updateAuthView();

      if (pageName === "members") {
        await refreshMembersDashboardSafe({ force: true });
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
  closeMobileNav();

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
  const { applicationModal, applicationForm, applicationType, applicationSubtitle } = getApplicationModalElements();
  const type = trigger?.dataset.applicationType || "club";

  lastApplicationTrigger = trigger || null;
  applicationForm.reset();
  applicationType.value = type;
  applicationSubtitle.textContent =
    type === "class"
      ? "填完社課參與資料後送出，管理員會再和你確認後續安排。"
      : "填完社員申請後送出，管理員審核通過後就能建立登入帳號。";
  setApplicationHint("送出後管理員會再審核資料。");
  applicationModal.hidden = false;
  body.classList.add("modal-open");
  closeMobileNav();

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

const openApplicationSuccessModal = () => {
  const { successModal, confirmButton } = getApplicationSuccessModalElements();
  successModal.hidden = false;
  body.classList.add("modal-open");

  window.setTimeout(() => confirmButton.focus(), 50);
};

const closeApplicationSuccessModal = () => {
  const { successModal } = getApplicationSuccessModalElements();
  successModal.hidden = true;
  body.classList.remove("modal-open");
};

const applyLanguage = (lang) => {
  document.documentElement.lang = lang;
  body.dataset.language = lang;

  languageSelects.forEach((select) => {
    select.value = lang;
  });

  window.localStorage.setItem(STORAGE_KEYS.language, lang);
};

const syncMemberProfile = async (user, source) => {
  if (!db || !user?.uid) {
    return;
  }

  const memberRef = getMemberDocRef(user.uid);
  const existingDoc = await getDoc(memberRef);
  const existingByEmailSnapshot = user.email
    ? await getDocs(query(collection(db, "members"), where("email", "==", user.email.trim().toLowerCase())))
    : null;
  const provisionalDoc = existingByEmailSnapshot?.docs.find((entry) => entry.id !== user.uid) || null;
  const provisionalData = provisionalDoc ? provisionalDoc.data() : null;
  const approvalDoc = user.email ? await getDoc(getApprovalDocRef(user.email)) : null;
  const approvalData = approvalDoc?.exists() ? approvalDoc.data() : null;

  const payload = {
    uid: user.uid,
    email: user.email || "",
    source,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (!existingDoc.exists()) {
    payload.createdAt = serverTimestamp();
    payload.status = "active";
  }

  if (provisionalData) {
    payload.name = provisionalData.name || payload.name;
    payload.applicationId = provisionalData.applicationId || payload.applicationId;
    payload.applicationType = provisionalData.applicationType || payload.applicationType;
    payload.studentId = provisionalData.studentId || payload.studentId;
    payload.department = provisionalData.department || provisionalData.school || payload.department;
    payload.phone = provisionalData.phone || payload.phone;
    payload.school = provisionalData.school || provisionalData.department || payload.school;
    payload.academicYear = provisionalData.academicYear || payload.academicYear;
    payload.term = provisionalData.term || payload.term;
    payload.approvedAt = provisionalData.approvedAt || payload.approvedAt;
  }

  if (approvalData) {
    payload.name = approvalData.name || "";
    payload.applicationId = approvalData.applicationId || "";
    payload.applicationType = approvalData.applicationType || "club";
    payload.studentId = approvalData.studentId || "";
    payload.department = approvalData.department || approvalData.school || "";
    payload.phone = approvalData.phone || "";
    payload.school = approvalData.school || approvalData.department || "";
    payload.academicYear = approvalData.academicYear || "未設定";
    payload.term = approvalData.term || "未設定";
    payload.approvedAt = approvalData.approvedAt || serverTimestamp();
  }

  await setDoc(memberRef, payload, { merge: true });

  if (provisionalDoc) {
    await deleteDoc(provisionalDoc.ref);
  }
};

const ensureBootstrapAdminDoc = async (user) => {
  if (!db || !user?.uid || !isBootstrapAdminEmail(user.email || "")) {
    return;
  }

  const adminRef = getAdminDocRef(user.uid);
  const existingAdmin = await getDoc(adminRef);
  if (existingAdmin.exists()) {
    return;
  }

  await setDoc(adminRef, {
    uid: user.uid,
    email: user.email || "",
    role: "admin",
    createdAt: serverTimestamp(),
  });
};

const ensureSignupApproved = async (email) => {
  if (!db) {
    return false;
  }

  if (isBootstrapAdminEmail(email)) {
    return true;
  }

  const approvalDoc = await getDoc(getApprovalDocRef(email));
  return approvalDoc.exists();
};

const syncApprovalFromApplication = async (applicationId, data) => {
  const email = String(data?.email || "").trim().toLowerCase();
  if (!email) {
    return;
  }

  const approvalRef = getApprovalDocRef(email);
  const reviewStatus = data.reviewStatus || (data.approved ? "approved" : "pending");

  if (reviewStatus === "approved") {
    await setDoc(
      approvalRef,
      {
        name: data.name || "",
        email,
        applicationId,
        applicationType: data.applicationType || "club",
        studentId: data.studentId || "",
        department: data.department || data.school || "",
        phone: data.phone || "",
        school: data.school || data.department || "",
        academicYear: data.academicYear || "未設定",
        term: data.term || "未設定",
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

const syncMemberRecordFromApplication = async (application, applicationId) => {
  if (!db || !application?.email) {
    return;
  }

  const reviewStatus = getApplicationReviewStatus(application);
  const membersQuery = query(collection(db, "members"), where("email", "==", application.email.trim().toLowerCase()));
  const snapshot = await getDocs(membersQuery);

  if (reviewStatus !== "approved") {
    await Promise.all(
      snapshot.docs
        .filter((entry) => entry.data().source === "application-approval")
        .map((entry) => deleteDoc(entry.ref)),
    );
    return;
  }

  const payload = {
    name: application.name || "",
    email: application.email.trim().toLowerCase(),
    studentId: application.studentId || "",
    department: application.department || application.school || "",
    phone: application.phone || "",
    school: application.school || application.department || "",
    applicationType: application.applicationType || "club",
    applicationId,
    academicYear: application.academicYear || "未設定",
    term: application.term || "未設定",
    source: "application-approval",
    status: "approved",
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (snapshot.empty) {
    await setDoc(doc(db, "members", `application-${applicationId}`), {
      ...payload,
      uid: `application-${applicationId}`,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await Promise.all(
    snapshot.docs.map((entry) =>
      setDoc(
        entry.ref,
        {
          ...payload,
          uid: entry.data().uid || entry.id,
        },
        { merge: true },
      ),
    ),
  );
};

const getApplicationReviewStatus = (application) => {
  if (application.reviewStatus) {
    return application.reviewStatus;
  }

  return application.approved ? "approved" : "pending";
};

const getRocAcademicYear = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear() - 1911;
  return month >= 8 ? year : year - 1;
};

const getStoredAdminAcademicYears = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.customAcademicYears);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed
          .map((value) => String(value).trim())
          .filter(Boolean)
          .filter((value) => Number.isFinite(Number(value)))
      : [];
  } catch {
    return [];
  }
};

const saveAdminAcademicYears = (years) => {
  window.localStorage.setItem(STORAGE_KEYS.customAcademicYears, JSON.stringify(years));
};

const buildAcademicYearOptions = () => {
  const baseYear = Math.max(getRocAcademicYear(), MIN_ACADEMIC_YEAR);
  return ["all", ...Array.from({ length: 6 }, (_, index) => String(baseYear + 1 - index)), "未設定"];
};

const buildAdminAcademicYearOptions = () => {
  const merged = [...buildAcademicYearOptions(), ...getStoredAdminAcademicYears()];
  const unique = Array.from(new Set(merged.filter(Boolean)));
  const numericYears = unique
    .filter((value) => value !== "all" && value !== "未設定")
    .sort((a, b) => Number(b) - Number(a));

  return ["all", ...numericYears, "未設定"];
};

const getAcademicYearLabel = (value) => {
  if (!value || value === "未設定") {
    return "未設定";
  }

  return `${value} 學年度`;
};

const getAcademicTermLabel = (value) => value || "未設定";

const matchesMemberFilter = (entry) => {
  const yearValue = entry.academicYear || "未設定";
  const termValue = entry.term || "未設定";

  const yearMatch = memberFilters.year === "all" || yearValue === memberFilters.year;
  const termMatch = memberFilters.term === "all" || termValue === memberFilters.term;
  return yearMatch && termMatch;
};

const initMembersFilters = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");

  if (!yearSelect || !termSelect || yearSelect.dataset.initialized === "true") {
    return;
  }

  yearSelect.addEventListener("change", () => {
    memberFilters.year = yearSelect.value;
    void refreshMembersDashboardSafe();
  });

  termSelect.addEventListener("change", () => {
    memberFilters.term = termSelect.value;
    void refreshMembersDashboardSafe();
  });

  yearSelect.dataset.initialized = "true";
};

const patchMembersFilterUI = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");

  if (yearSelect) {
    yearSelect.innerHTML = buildAdminAcademicYearOptions()
      .map((value) => {
        const label = value === "all" ? "全部學年度" : getAcademicYearLabel(value);
        const selected = value === memberFilters.year ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  if (termSelect) {
    termSelect.innerHTML = ["all", ...DEFAULT_TERMS]
      .map((value) => {
        const label = value === "all" ? "全部學期" : getAcademicTermLabel(value);
        const selected = value === memberFilters.term ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }
};

const initCustomAcademicYearControls = () => {
  const input = document.querySelector("[data-custom-year-input]");
  const addButton = document.querySelector("[data-add-academic-year]");

  if (!input || !addButton || addButton.dataset.initialized === "true") {
    return;
  }

  addButton.addEventListener("click", () => {
    const value = input.value.trim();
    if (!value || !Number.isFinite(Number(value))) {
      input.focus();
      return;
    }

    const nextYears = Array.from(new Set([...getStoredAdminAcademicYears(), value])).sort(
      (a, b) => Number(b) - Number(a),
    );
    saveAdminAcademicYears(nextYears);

    if (memberFilters.year === "all") {
      memberFilters.year = value;
    }

    input.value = "";
    void refreshMembersDashboardSafe();
  });

  addButton.dataset.initialized = "true";
};

const formatTimestamp = (value) => {
  if (!value) {
    return "未記錄";
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未記錄";
  }

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getApplicationCooldownRemainingMs = (email, applicationType) => {
  try {
    const raw = window.localStorage.getItem(getApplicationCooldownKey(email, applicationType));
    const savedAt = Number(raw || "0");
    if (!Number.isFinite(savedAt) || savedAt <= 0) {
      return 0;
    }

    return Math.max(0, APPLICATION_SUBMIT_COOLDOWN_MS - (Date.now() - savedAt));
  } catch {
    return 0;
  }
};

const rememberApplicationSubmit = (email, applicationType) => {
  window.localStorage.setItem(getApplicationCooldownKey(email, applicationType), String(Date.now()));
};

const getApplicationYearOptionsMarkup = (selectedValue) =>
  buildAdminAcademicYearOptions()
    .filter((value) => value !== "all")
    .map((value) => {
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(getAcademicYearLabel(value))}</option>`;
    })
    .join("");

const getApplicationTermOptionsMarkup = (selectedValue) =>
  DEFAULT_TERMS.map((value) => {
    const selected = value === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(getAcademicTermLabel(value))}</option>`;
  }).join("");

const bindApplicationActionButtons = (applicationList) => {
  applicationList.querySelectorAll("[data-application-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.applicationId;
      const action = button.dataset.applicationAction;
      const applicationRef = doc(db, "applications", id);
      const currentDoc = await getDoc(applicationRef);

      if (!currentDoc.exists()) {
        return;
      }

      const yearSelect = applicationList.querySelector(`[data-application-year][data-application-id="${id}"]`);
      const termSelect = applicationList.querySelector(`[data-application-term][data-application-id="${id}"]`);
      const data = currentDoc.data();
      const controls = applicationList.querySelectorAll(`[data-application-id="${id}"]`);

      if (action === "delete") {
        const confirmed = window.confirm("Delete this application?");
        if (!confirmed) {
          return;
        }

        controls.forEach((control) => {
          control.disabled = true;
        });
        await syncApprovalFromApplication(id, { ...data, reviewStatus: "rejected", approved: false });
        await deleteDoc(applicationRef);
        await refreshMembersDashboardSafe({ force: true });
        return;
      }

      const nextData = {
        academicYear: yearSelect?.value || "未設定",
        term: termSelect?.value || "未設定",
        updatedAt: serverTimestamp(),
      };

      nextData.approved = true;
      nextData.reviewStatus = "approved";

      controls.forEach((control) => {
        control.disabled = true;
      });

      try {
        await updateDoc(applicationRef, nextData);
        const updatedDoc = await getDoc(applicationRef);
        const updatedData = updatedDoc.data();
        await syncApprovalFromApplication(id, updatedData);
        await syncMemberRecordFromApplication(updatedData, id);
        await refreshMembersDashboardSafe({ force: true });

        focusApprovedMember(id, updatedData);
      } finally {
        controls.forEach((control) => {
          control.disabled = false;
        });
      }
    });
  });
};

const focusApprovedMember = (applicationId, application) => {
  const list = document.querySelector("[data-members-list]");
  if (!list) {
    return;
  }

  const normalizedEmail = application?.email?.trim().toLowerCase() || "";
  const target =
    (normalizedEmail
      ? list.querySelector(`[data-member-email="${CSS.escape(normalizedEmail)}"]`)
      : null) ||
    list.querySelector(`[data-member-application-id="${CSS.escape(applicationId)}"]`);

  if (target instanceof HTMLElement) {
    setMemberRowExpanded(target, true);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  list.scrollIntoView({ behavior: "smooth", block: "start" });
};

const setMemberRowExpanded = (row, expanded) => {
  const summaryButton = row.querySelector("[data-member-toggle]");
  const detail = row.querySelector("[data-member-detail]");
  if (!summaryButton || !detail) {
    return;
  }

  row.dataset.expanded = expanded ? "true" : "false";
  summaryButton.setAttribute("aria-expanded", String(expanded));
  detail.hidden = !expanded;

  const toggleLabel = summaryButton.querySelector(".member-row-toggle");
  if (toggleLabel) {
    toggleLabel.textContent = expanded ? "收合" : "展開";
  }
};

const bindMemberToggleButtons = (memberList) => {
  memberList.querySelectorAll("[data-member-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("[data-member-row]");
      if (!row) {
        return;
      }

      const expanded = row.dataset.expanded === "true";
      setMemberRowExpanded(row, !expanded);
    });
  });
};

const renderApplicationReviewList = async (applications = []) => {
  const applicationList = document.querySelector("[data-application-list]");
  if (!applicationList) {
    return;
  }

  const filteredApplications = applications.filter(
    (application) => matchesMemberFilter(application) && getApplicationReviewStatus(application) !== "approved",
  );

  if (filteredApplications.length === 0) {
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有符合條件的申請</h3>
        <p class="content-copy">調整上方學年度或學期篩選後，再看看有沒有資料。</p>
      </article>
    `;
    return;
  }

  applicationList.innerHTML = filteredApplications
    .map((application) => {
      const academicYear = application.academicYear || String(Math.max(getRocAcademicYear(), MIN_ACADEMIC_YEAR));
      const term = application.term || "未設定";

      return `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">社員申請</p>
            <p class="member-row-status">pending</p>
          </div>
          <p class="member-row-email">${escapeHtml(application.name || "未填姓名")} / ${escapeHtml(application.email || "未填信箱")}</p>
          <div class="member-row-meta">
            <span>學號：${escapeHtml(application.studentId || "未填寫")}</span>
            <span>系別：${escapeHtml(application.department || application.school || "未填寫")}</span>
            <span>電話：${escapeHtml(application.phone || "未填寫")}</span>
            <span>送出時間：${escapeHtml(formatTimestamp(application.submittedAt))}</span>
            <span>備註：${escapeHtml(application.note || "無")}</span>
          </div>
          <div class="member-row-controls">
            <div class="form-field">
              <label for="application-year-${escapeHtml(application.id)}">學年度</label>
              <select id="application-year-${escapeHtml(application.id)}" data-application-year data-application-id="${escapeHtml(application.id)}">
                ${getApplicationYearOptionsMarkup(academicYear)}
              </select>
            </div>
            <div class="form-field">
              <label for="application-term-${escapeHtml(application.id)}">學期</label>
              <select id="application-term-${escapeHtml(application.id)}" data-application-term data-application-id="${escapeHtml(application.id)}">
                ${getApplicationTermOptionsMarkup(term)}
              </select>
            </div>
          </div>
          <div class="application-actions">
            <button class="button-secondary application-toggle ${approved ? "is-active" : ""}" data-application-action="approve" data-application-id="${escapeHtml(application.id)}" type="button">
              ${approved ? "已同意" : "同意"}
            </button>
            <button class="button-secondary application-toggle ${rejected ? "is-active" : ""}" data-application-action="reject" data-application-id="${escapeHtml(application.id)}" type="button">
              ${rejected ? "已不同意" : "不同意"}
            </button>
            <button class="button-secondary application-save" data-application-action="save-meta" data-application-id="${escapeHtml(application.id)}" type="button">
              儲存學期資料
            </button>
            <button class="button-secondary application-save" data-application-action="delete" data-application-id="${escapeHtml(application.id)}" type="button">
              刪除資料
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  bindApplicationActionButtons(applicationList);
};

const bindMemberActionButtons = (memberList) => {
  memberList.querySelectorAll("[data-member-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const memberId = button.dataset.memberId;
      const action = button.dataset.memberAction;

      if (action !== "delete" || !memberId) {
        return;
      }

      const confirmed = window.confirm("Delete this member record?");
      if (!confirmed) {
        return;
      }

      await deleteDoc(doc(db, "members", memberId));
      await refreshMembersDashboardSafe({ force: true });
    });
  });
};

const renderMembersList = (members = []) => {
  const list = document.querySelector("[data-members-list]");
  if (!list) {
    return;
  }

  const filteredMembers = members.filter(matchesMemberFilter);

  if (filteredMembers.length === 0) {
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有符合條件的社員資料</h3>
        <p class="content-copy">可以調整篩選，或等社員建立帳號後再查看。</p>
      </article>
    `;
    return;
  }

  list.innerHTML = filteredMembers
    .map(
      (member, index) => `
        <article
          class="member-row member-row-expandable"
          data-member-row
          data-expanded="false"
          data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}"
          data-member-application-id="${escapeHtml(member.applicationId || "")}"
        >
          <button
            class="member-row-summary"
            data-member-toggle
            type="button"
            aria-expanded="false"
            aria-controls="member-detail-${escapeHtml(member.id)}"
          >
            <span class="member-row-top">
              <span class="member-row-heading">
                <span class="member-row-index">#${String(index + 1).padStart(2, "0")}</span>
                <span class="member-row-email">${escapeHtml(member.name || "未填姓名")} / ${escapeHtml(member.studentId || "未填學號")}</span>
              </span>
              <span class="member-row-summary-side">
                <span class="member-row-status">${escapeHtml(member.status || "active")}</span>
                <span class="member-row-toggle">展開</span>
              </span>
            </span>
          </button>
          <div class="member-row-detail" data-member-detail id="member-detail-${escapeHtml(member.id)}" hidden>
            <div class="member-row-meta">
              <span>UID：${escapeHtml(member.uid || member.id)}</span>
              <span>學年度：${escapeHtml(getAcademicYearLabel(member.academicYear || "未設定"))}</span>
              <span>學期：${escapeHtml(getAcademicTermLabel(member.term || "未設定"))}</span>
              <span>系別：${escapeHtml(member.department || member.school || "未填寫")}</span>
              <span>電話：${escapeHtml(member.phone || "未填寫")}</span>
              <span>信箱：${escapeHtml(member.email || "未填寫")}</span>
              <span>建立時間：${escapeHtml(formatTimestamp(member.createdAt))}</span>
              <span>最近登入：${escapeHtml(formatTimestamp(member.lastLoginAt))}</span>
            </div>
            <div class="application-actions member-actions">
              <button class="button-secondary application-save" data-member-action="delete" data-member-id="${escapeHtml(member.id)}" type="button">
                刪除社員資料
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  bindMemberToggleButtons(list);
  bindMemberActionButtons(list);
};

const renderMembersSummary = (members = [], applications = []) => {
  const summary = document.querySelector("[data-members-summary]");
  if (!summary) {
    return;
  }

  const filteredMembers = members.filter(matchesMemberFilter);
  const pendingApplications = applications.filter((application) => getApplicationReviewStatus(application) === "pending");

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">待處理申請</p>
      <p class="member-stat-value">${pendingApplications.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">符合篩選社員數</p>
      <p class="member-stat-value">${filteredMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">目前篩選</p>
      <p class="member-stat-value member-stat-value-small">${escapeHtml(
        memberFilters.year === "all" ? "全部學年度" : getAcademicYearLabel(memberFilters.year),
      )}<br />${escapeHtml(memberFilters.term === "all" ? "全部學期" : getAcademicTermLabel(memberFilters.term))}</p>
    </article>
  `;
};

const showMembersDashboardError = (gate, error) => {
  const details = {
    code: error?.code || "unknown",
    message: error?.message || String(error || "Unknown error"),
    email: currentUser?.email || "not signed in",
    uid: currentUser?.uid || "no uid",
    frontEndAdmin: String(currentUserIsAdmin),
  };

  console.error("Members dashboard load failed", details);

  gate.hidden = false;
  gate.innerHTML = `
    <h2 class="content-title">Dashboard load failed</h2>
    <p class="content-copy">Firebase code: <code>${escapeHtml(details.code)}</code></p>
    <p class="content-copy">${escapeHtml(details.message)}</p>
    <p class="content-copy">Signed in as: <code>${escapeHtml(details.email)}</code></p>
    <p class="content-copy">UID: <code>${escapeHtml(details.uid)}</code></p>
    <p class="content-copy">Front-end admin: <code>${escapeHtml(details.frontEndAdmin)}</code></p>
  `;
};

const getCollectionEntries = async (collectionName) => {
  const target = collection(db, collectionName);
  const snapshot = await getDocs(target);
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
};

const refreshMembersDashboardSafe = async ({ force = false } = {}) => {
  if (pageName !== "members") {
    return;
  }

  const gate = document.querySelector("[data-members-gate]");
  const content = document.querySelector("[data-members-content]");
  const summary = document.querySelector("[data-members-summary]");
  const list = document.querySelector("[data-members-list]");
  const applicationList = document.querySelector("[data-application-list]");

  if (!gate || !content || !summary || !list || !applicationList) {
    return;
  }

  if (!firebaseConfigured) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">Firebase 尚未設定完成</h2>
      <p class="content-copy">請先確認 <code>src/firebase-config.js</code> 內容是否正確。</p>
    `;
    return;
  }

  if (!currentUser) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">請先登入</h2>
      <p class="content-copy">按上方 <code>Sign In</code> 後登入，才能查看管理資料。</p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">目前帳號沒有管理權限</h2>
      <p class="content-copy">請確認這個帳號是否存在於 Firestore 的 <code>admins</code> 集合中。</p>
    `;
    return;
  }

  gate.hidden = true;
  content.hidden = false;
  initMembersFilters();
  initCustomAcademicYearControls();
  patchMembersFilterUI();

  try {
    if (force || !membersDashboardCache.loaded) {
      const [members, applications] = await Promise.all([
        getCollectionEntries("members"),
        getCollectionEntries("applications"),
      ]);

      membersDashboardCache = {
        members,
        applications,
        loaded: true,
      };
    }

    renderMembersSummary(membersDashboardCache.members, membersDashboardCache.applications);
    await renderApplicationReviewList(membersDashboardCache.applications);
    renderMembersList(membersDashboardCache.members);
  } catch (error) {
    showMembersDashboardError(gate, error);

    summary.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">管理資料載入失敗</h3>
        <p class="content-copy">請確認 Firestore 規則與集合欄位設定是否正確。</p>
      </article>
    `;
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">申請資料讀取失敗</h3>
        <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
      </article>
    `;
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">社員資料讀取失敗</h3>
        <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
      </article>
    `;
  }
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();

  const { emailInput, passwordInput, confirmInput, authSubmit } = getLoginModalElements();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;

  if (!firebaseConfigured) {
    setHint("Firebase 尚未設定完成，請先確認 src/firebase-config.js。", "error");
    return;
  }

  if (!email.includes("@")) {
    setHint("請輸入有效的電子郵件信箱。", "error");
    return;
  }

  if (password.length < 8) {
    setHint("密碼至少需要 8 個字元。", "error");
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
        setHint("這個信箱尚未通過審核，暫時不能建立帳號。", "error");
        return;
      }

      const credential = await createUserWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signup");
      await ensureBootstrapAdminDoc(credential.user);
      await loadAdminStatus(credential.user);
      setHint("帳號建立完成，已自動登入。", "success");
    } else {
      const credential = await signInWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signin");
      await loadAdminStatus(credential.user);
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
  const studentId = String(formData.get("studentId") || "").trim();
  const department = String(formData.get("department") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim();
  const applicationType = String(formData.get("applicationType") || "club");

  if (!firebaseConfigured) {
    setApplicationHint("Firebase 尚未設定完成，請先確認 src/firebase-config.js。", "error");
    return;
  }

  if (!name || !studentId || !department || !phone || !email) {
    setApplicationHint("請完整填寫姓名、學號、系別、連絡電話與聯絡信箱。", "error");
    return;
  }

  const cooldownRemainingMs = getApplicationCooldownRemainingMs(email, applicationType);
  if (cooldownRemainingMs > 0) {
    const remainingMinutes = Math.ceil(cooldownRemainingMs / 60000);
    setApplicationHint(`同一信箱剛送出過申請，請約 ${remainingMinutes} 分鐘後再試。`, "error");
    return;
  }

  submitButton.disabled = true;

  try {
    await ensureAuthReady();

    const applicationRef = doc(db, "applications", getApplicationDocId(email, applicationType));
    const existingApplication = await getDoc(applicationRef);
    if (existingApplication.exists()) {
      setApplicationHint("這個信箱已經送出過申請，請等管理員處理或直接聯絡幹部。", "error");
      return;
    }

    await setDoc(applicationRef, {
      name,
      studentId,
      department,
      school: department,
      phone,
      email,
      note,
      applicationType,
      academicYear: String(Math.max(getRocAcademicYear(), MIN_ACADEMIC_YEAR)),
      term: "未設定",
      approved: false,
      reviewStatus: "pending",
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    rememberApplicationSubmit(email, applicationType);
    applicationForm.reset();
    closeApplicationModal();
    openApplicationSuccessModal();
    setApplicationHint("申請已送出，等管理員審核通過後就能建立登入帳號。", "success");
  } catch {
    setMessageTone(applicationHint, "送出申請時發生問題，請稍後再試一次。", "error");
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
    setHint("已成功登出。", "success");
    closeLoginModal();
  } catch (error) {
    setHint(getFriendlyAuthError(error), "error");
  }
};

const bindLoginModalEvents = () => {
  const { loginModal, loginForm, authTabs, authSubmit, closeButtons } = getLoginModalElements();

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", handleAuthSubmit);
  authSubmit.addEventListener("click", async () => {
    if (authSubmit.dataset.authAction === "signout") {
      await handleSignOut();
    }
  });

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

const bindApplicationSuccessModalEvents = () => {
  const { successModal, confirmButton, closeButtons } = getApplicationSuccessModalElements();

  confirmButton.addEventListener("click", closeApplicationSuccessModal);

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeApplicationSuccessModal);
  });

  successModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target === successModal || target.hasAttribute("data-modal-backdrop")) {
      closeApplicationSuccessModal();
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

  document.querySelectorAll(".mobile-nav a, .mobile-nav button").forEach((item) => {
    item.addEventListener("click", closeMobileNav);
  });
};

const initLanguageSwitcher = () => {
  if (languageSelects.length === 0) {
    return;
  }

  const savedLanguage = window.localStorage.getItem(STORAGE_KEYS.language) || "zh-Hant";
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
    if (event.key !== "Escape") {
      return;
    }

    closeMobileNav();

    const { loginModal } = getLoginModalElements();
    const { applicationModal } = getApplicationModalElements();
    const { successModal } = getApplicationSuccessModalElements();

    if (!loginModal.hidden) {
      closeLoginModal();
    }

    if (!applicationModal.hidden) {
      closeApplicationModal();
    }

    if (!successModal.hidden) {
      closeApplicationSuccessModal();
    }
  });
};

const init = async () => {
  ensureLoginModal();
  ensureApplicationModal();
  ensureApplicationSuccessModal();
  bindLoginModalEvents();
  bindApplicationModalEvents();
  bindApplicationSuccessModalEvents();
  bindOpenButtons();
  initMenu();
  initLanguageSwitcher();
  initFaqAccordion();
  initKeybindings();
  setAuthMode("signin");
  updateLoginButtons();

  if (firebaseConfigured) {
    await ensureAuthReady();
  }

  if (pageName === "members") {
    await refreshMembersDashboardSafe();
  }
};

void init();
