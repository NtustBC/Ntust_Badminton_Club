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
const MEMBERS_DASHBOARD_REFRESH_MS = 60 * 1000;
const PUBLIC_PAGE_REFRESH_MS = 60 * 1000;
const CLASS_SIGNUP_WINDOW_DAYS = 7;
const CLASS_SESSION_COLLECTION = "classSessions";
const CLASS_SIGNUP_COLLECTION = "classSessionSignups";
const CLASS_ANNOUNCEMENT_COLLECTION = "classAnnouncements";
const FAQ_COLLECTION = "faqEntries";
const CLASS_WEEKDAY_LABELS = {
  mon: "星期一",
  tue: "星期二",
  wed: "星期三",
  thu: "星期四",
  fri: "星期五",
  sat: "星期六",
  sun: "星期日",
};
const CLASS_WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DATE_WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CLASS_SUNDAY_SLOTS = ["13:00~14:30", "14:30~16:00"];
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
let membersAutoRefreshTimer = null;
let publicPageAutoRefreshTimer = null;
let membersDashboardCache = {
  members: [],
  applications: [],
  classSessions: [],
  classSessionSignups: [],
  announcements: [],
  faqs: [],
  loadWarnings: [],
  loaded: false,
};
let classSignupPageState = {
  loaded: false,
  sessions: [],
  ownSignups: [],
  approval: null,
  monthOffset: 0,
  loadWarnings: [],
};
let announcementPageState = {
  loaded: false,
  announcements: [],
  loadWarnings: [],
};
let faqPageState = {
  loaded: false,
  faqs: [],
  loadWarnings: [],
};
let adminClassCalendarMonthOffset = 0;
let adminClassSessionEditingId = "";
let lastAdminClassCalendarTrigger = null;
let adminAnnouncementListResizeBound = false;
let adminFaqListResizeBound = false;

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

const applicationErrorMessages = {
  "permission-denied": "這個 Email 已經有申請資料了，請直接修改原申請或聯絡管理員。",
  "unavailable": "Firebase 目前暫時無法連線，請稍後再試一次。",
  "deadline-exceeded": "送出逾時，請檢查網路後再試一次。",
  "failed-precondition": "目前資料尚未準備好，請重新整理頁面後再試一次。",
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

const adminClassCalendarModalMarkup = `
  <div class="modal" data-admin-class-calendar-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog admin-calendar-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" data-admin-calendar-modal-title>社課日期</h2>
          <p class="modal-subtitle" data-admin-calendar-modal-subtitle></p>
        </div>
        <button class="modal-close" data-close-admin-calendar-modal type="button" aria-label="關閉社課細節視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="admin-calendar-modal-list" data-admin-calendar-modal-list></div>
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
const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
};
const formatDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const getDateKeyMs = (value) => {
  const date = parseDateKey(value);
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
};
const formatDateKey = (value, options = {}) => {
  const date = parseDateKey(value);
  if (!date) {
    return String(value || "");
  }

  return date.toLocaleDateString("zh-TW", {
    year: options.year ?? "numeric",
    month: options.month ?? "2-digit",
    day: options.day ?? "2-digit",
    weekday: options.weekday,
  });
};
const buildSelectOptionsMarkup = (options = [], selectedValue = "") =>
  options
    .map((option) => {
      const value = typeof option === "string" ? option : String(option.value ?? "");
      const label = typeof option === "string" ? option : String(option.label ?? option.value ?? "");
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
const getClassSessionId = (session = {}) => {
  const explicitId = String(session.sessionId || session.id || "").trim();
  if (explicitId) {
    return explicitId;
  }

  const date = String(session.date || session.sessionDate || "").trim();
  const weekday = String(session.weekday || "").trim().toLowerCase();
  return [date, weekday].filter(Boolean).join("-");
};
const getClassSessionDocRef = (sessionId) => doc(db, CLASS_SESSION_COLLECTION, sessionId);
const getClassSignupDocRef = (sessionId, userId) => doc(db, CLASS_SIGNUP_COLLECTION, `${sessionId}-${userId}`);
const getClassAnnouncementDocRef = (announcementId) => doc(db, CLASS_ANNOUNCEMENT_COLLECTION, announcementId);
const getFaqDocRef = (faqId) => doc(db, FAQ_COLLECTION, faqId);
const getClassSessionSortMs = (session) => getDateKeyMs(session.date || session.sessionDate);
const getAnnouncementSortMs = (announcement) => getTimestampMs(announcement.createdAt || announcement.updatedAt || announcement.date);
const getFaqSortMs = (faq) => getTimestampMs(faq.createdAt || faq.updatedAt || faq.date);
const getCurrentUserLoginTimeMs = () => {
  const value = currentUser?.metadata?.lastSignInTime;
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};
const isRecentLoginWithinWindow = (days = CLASS_SIGNUP_WINDOW_DAYS) => {
  const loginTime = getCurrentUserLoginTimeMs();
  if (!Number.isFinite(loginTime) || loginTime < 0) {
    return false;
  }

  return Date.now() - loginTime <= days * 24 * 60 * 60 * 1000;
};
const getWeekdayKeyFromDateValue = (value) => {
  const date = parseDateKey(value);
  if (!date) {
    return "";
  }

  return DATE_WEEKDAY_ORDER[date.getDay()] || "";
};
const getWeekdayLabel = (weekday) => CLASS_WEEKDAY_LABELS[String(weekday || "").trim().toLowerCase()] || String(weekday || "");
const getClassSessionDateLabel = (session) => {
  const dateLabel = formatDateKey(session.date || session.sessionDate || "", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekdayLabel = getWeekdayLabel(session.weekday);
  return [dateLabel, weekdayLabel].filter(Boolean).join(" / ");
};
const getClassSessionTimeLabel = (session) => String(session.timeLabel || session.time || "").trim();
const getClassSessionReminder = (session) => String(session.reminder || session.note || "").trim();
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
const getFriendlyApplicationError = (error) =>
  applicationErrorMessages[error?.code] || "送出申請時發生問題，請稍後再試一次。";

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

const ensureAdminClassCalendarModal = () => {
  const existing = document.querySelector("[data-admin-class-calendar-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", adminClassCalendarModalMarkup);
  return document.querySelector("[data-admin-class-calendar-modal]");
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

const getAdminClassCalendarModalElements = () => {
  const calendarModal = ensureAdminClassCalendarModal();

  return {
    calendarModal,
    title: calendarModal.querySelector("[data-admin-calendar-modal-title]"),
    subtitle: calendarModal.querySelector("[data-admin-calendar-modal-subtitle]"),
    list: calendarModal.querySelector("[data-admin-calendar-modal-list]"),
    closeButtons: calendarModal.querySelectorAll("[data-close-admin-calendar-modal]"),
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
      membersDashboardCache.loadWarnings = [];
      classSignupPageState.loaded = false;
      classSignupPageState.loadWarnings = [];
      announcementPageState.loaded = false;
      announcementPageState.loadWarnings = [];
      faqPageState.loaded = false;
      faqPageState.loadWarnings = [];

      if (user) {
        await loadAdminStatus(user);
      }

      updateLoginButtons();
      updateAuthView();

      if (pageName === "members") {
        await refreshMembersDashboardSafe({ force: true });
      } else if (pageName === "class-signup") {
        await refreshClassSignupPageSafe({ force: true });
      } else if (pageName === "notices") {
        await refreshAnnouncementsPageSafe({ force: true });
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

const openAdminClassCalendarModal = (dateKey, sessions = [], trigger = null) => {
  const { calendarModal, title, subtitle, list } = getAdminClassCalendarModalElements();
  lastAdminClassCalendarTrigger = trigger || null;

  const parsedDate = parseDateKey(dateKey);
  const dateLabel = parsedDate
    ? parsedDate.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : String(dateKey || "");
  const weekdayLabel = parsedDate ? getWeekdayLabel(DATE_WEEKDAY_ORDER[parsedDate.getDay()] || "") : "";
  const sortedSessions = [...sessions].sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));

  title.textContent = dateLabel || "社課日期";
  subtitle.textContent = weekdayLabel ? `${weekdayLabel} · ${sortedSessions.length} 場` : `${sortedSessions.length} 場`;

  if (sortedSessions.length === 0) {
    list.innerHTML = `
      <article class="content-card is-tight admin-calendar-modal-empty">
        <h3 class="content-title">這一天沒有社課</h3>
        <p class="content-copy">你可以切換到其他日期，或回到左側新增社課。</p>
      </article>
    `;
  } else {
    list.innerHTML = sortedSessions
      .map((session) => {
        const sessionId = getClassSessionId(session);
        const sessionSignups = membersDashboardCache.classSessionSignups.filter(
          (signup) => String(signup.sessionId || "") === sessionId,
        );
        const rosterCount = Array.isArray(session.publishedRoster) ? session.publishedRoster.length : 0;
        const rosterLabel = session.rosterPublished
          ? `已公布名單${rosterCount > 0 ? ` · ${rosterCount} 人` : ""}`
          : "尚未公布名單";

        return `
          <article class="admin-calendar-modal-session${session.rosterPublished ? " is-published" : ""}">
            <div class="admin-calendar-modal-session-head">
              <div>
                <p class="admin-calendar-modal-session-weekday">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
                <h3 class="admin-calendar-modal-session-title">${escapeHtml(session.title || "未命名社課")}</h3>
                <p class="admin-calendar-modal-session-meta">
                  ${escapeHtml(getClassSessionDateLabel(session))} · ${escapeHtml(getClassSessionTimeLabel(session) || "未填時間")}
                </p>
              </div>
              <span class="member-row-status">${escapeHtml(rosterLabel)}</span>
            </div>
            <p class="admin-calendar-modal-session-copy">${escapeHtml(session.reminder || session.description || "請依行事曆安排社課。")}</p>
            <p class="admin-calendar-modal-session-copy">報名 ${sessionSignups.length} 人</p>
            <div class="admin-calendar-modal-session-actions">
              <button class="button-secondary admin-mini-button" data-class-session-edit type="button" data-session-id="${escapeHtml(sessionId)}">編輯</button>
              <button class="button-secondary admin-mini-button" data-class-session-publish type="button" data-session-id="${escapeHtml(sessionId)}">
                ${session.rosterPublished ? "重新公布" : "公布名單"}
              </button>
              <button class="button-secondary admin-mini-button" data-class-session-delete type="button" data-session-id="${escapeHtml(sessionId)}">刪除</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  calendarModal.hidden = false;
  body.classList.add("modal-open");

  window.setTimeout(() => {
    calendarModal.querySelector("[data-close-admin-calendar-modal]")?.focus();
  }, 50);
};

const closeAdminClassCalendarModal = () => {
  const { calendarModal } = getAdminClassCalendarModalElements();
  calendarModal.hidden = true;
  body.classList.remove("modal-open");

  if (lastAdminClassCalendarTrigger instanceof HTMLElement) {
    lastAdminClassCalendarTrigger.focus();
  }
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
  if (reviewStatus !== "approved") {
    return;
  }

  // Member documents are created on first login from the approval record.
  // The admin dashboard already shows approved applications directly.
  return;

  const memberRef = doc(db, "members", `application-${applicationId}`);
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

  await setDoc(
    memberRef,
    {
      ...payload,
      uid: `application-${applicationId}`,
      createdAt: serverTimestamp(),
    },
    { merge: true },
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

const getTimestampMs = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : new Date(value);

  const time = date.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
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

      if (action === "save-meta") {
        const controls = applicationList.querySelectorAll(`[data-application-id="${id}"]`);
        controls.forEach((control) => {
          control.disabled = true;
        });

        try {
          const nextData = {
            academicYear: yearSelect?.value || "未設定",
            term: termSelect?.value || "未設定",
            approved: true,
            reviewStatus: "approved",
            updatedAt: serverTimestamp(),
          };

          await updateDoc(applicationRef, nextData);
          const updatedDoc = await getDoc(applicationRef);
          const updatedData = updatedDoc.data();

          await syncApprovalFromApplication(id, updatedData);
          try {
            await syncMemberRecordFromApplication(updatedData, id);
          } catch (memberSyncError) {
            console.warn("Approved application saved, but member collection sync failed.", memberSyncError);
          }
          await refreshMembersDashboardSafe({ force: true });
          focusApprovedMember(id, updatedData);
          window.alert("學年度與學期已儲存，並已加入社員名單。");
        } catch (error) {
          console.error("Save application meta failed:", error);
          window.alert(`儲存失敗：${error?.message || "請稍後再試一次。"}`);
        } finally {
          controls.forEach((control) => {
            control.disabled = false;
          });
        }
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
        try {
          await syncMemberRecordFromApplication(updatedData, id);
        } catch (memberSyncError) {
          console.warn("Approved application saved, but member collection sync failed.", memberSyncError);
        }
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
    (applicationId
      ? list.querySelector(`[data-member-application-id="${CSS.escape(`application-${applicationId}`)}"]`)
      : null) ||
    (normalizedEmail
      ? list.querySelector(`[data-member-email="${CSS.escape(normalizedEmail)}"]`)
      : null);

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

const getExpandedMemberKeys = () =>
  Array.from(document.querySelectorAll("[data-member-row][data-expanded='true']"))
    .map((row) => row.dataset.memberEmail || row.dataset.memberApplicationId || "")
    .filter(Boolean);

const restoreExpandedMemberKeys = (keys = []) => {
  keys.forEach((key) => {
    const escapedKey = CSS.escape(key);
    const row =
      document.querySelector(`[data-member-email="${escapedKey}"]`) ||
      document.querySelector(`[data-member-application-id="${escapedKey}"]`);

    if (row instanceof HTMLElement) {
      setMemberRowExpanded(row, true);
    }
  });
};

const shouldAutoRefreshMembersDashboard = () => {
  if (pageName !== "members" || document.hidden || body.classList.contains("modal-open")) {
    return false;
  }

  if (!currentUser || !currentUserIsAdmin) {
    return false;
  }

  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement.closest("[data-application-list]") ||
      activeElement.closest("[data-members-list]") ||
      activeElement.closest("[data-class-session-calendar]") ||
      activeElement.closest("[data-announcement-admin-list]") ||
      activeElement.closest("[data-class-session-form]") ||
      activeElement.closest("[data-announcement-form]") ||
      activeElement.closest("[data-members-content] select") ||
      activeElement.closest("[data-members-content] input") ||
      activeElement.closest("[data-members-content] textarea") ||
      activeElement.tagName === "SELECT" ||
      activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA")
  ) {
    return false;
  }

  return true;
};

const startMembersDashboardAutoRefresh = () => {
  if (pageName !== "members" || membersAutoRefreshTimer) {
    return;
  }

  membersAutoRefreshTimer = window.setInterval(async () => {
    if (!shouldAutoRefreshMembersDashboard()) {
      return;
    }

    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  }, MEMBERS_DASHBOARD_REFRESH_MS);
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
      const reviewStatus = getApplicationReviewStatus(application);
      const approved = reviewStatus === "approved";
      const rejected = reviewStatus === "rejected";
      const statusLabel =
        reviewStatus === "approved" ? "已同意" : reviewStatus === "rejected" ? "已不同意" : "pending";

      return `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">社員申請</p>
            <p class="member-row-status">${statusLabel}</p>
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
      const origin = button.dataset.memberOrigin || "members";

      if (action !== "delete" || !memberId) {
        return;
      }

      const confirmed = window.confirm("Delete this member record?");
      if (!confirmed) {
        return;
      }

      const collectionName = origin === "applications" ? "applications" : "members";
      await deleteDoc(doc(db, collectionName, memberId));
      await refreshMembersDashboardSafe({ force: true });
    });
  });
};

const getMemberIdFromApplication = (applicationId) => `application-${applicationId}`;

const createMemberFromApprovedApplication = (application) => ({
  id: getMemberIdFromApplication(application.id),
  applicationId: application.id,
  applicationType: application.applicationType || "club",
  name: application.name || "",
  email: String(application.email || "").trim().toLowerCase(),
  studentId: application.studentId || "",
  department: application.department || application.school || "",
  school: application.school || application.department || "",
  phone: application.phone || "",
  academicYear: application.academicYear || "未設定",
  term: application.term || "未設定",
  source: "application-approval",
  status: "approved",
  submittedAt: application.submittedAt,
  createdAt: application.submittedAt,
  approvedAt: application.updatedAt || application.submittedAt,
  lastLoginAt: null,
  origin: "applications",
});

const mergeMembersWithApprovedApplications = (members = [], applications = []) => {
  const existingKeys = new Set(
    members.flatMap((member) => [
      member.id,
      member.applicationId ? getMemberIdFromApplication(member.applicationId) : "",
      String(member.email || "").trim().toLowerCase(),
    ]),
  );

  const approvedApplicationMembers = applications
    .filter((application) => getApplicationReviewStatus(application) === "approved")
    .map(createMemberFromApprovedApplication)
    .filter((member) => {
      const emailKey = String(member.email || "").trim().toLowerCase();
      return !existingKeys.has(member.id) && !existingKeys.has(emailKey);
    });

  return [...members.map((member) => ({ ...member, origin: "members" })), ...approvedApplicationMembers].sort(
    (a, b) => getTimestampMs(a.submittedAt || a.createdAt || a.approvedAt) - getTimestampMs(b.submittedAt || b.createdAt || b.approvedAt),
  );
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
          data-member-application-id="${escapeHtml(member.id)}"
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
              <span>學年度：${escapeHtml(getAcademicYearLabel(member.academicYear || "未設定"))}</span>
              <span>學期：${escapeHtml(getAcademicTermLabel(member.term || "未設定"))}</span>
              <span>系別：${escapeHtml(member.department || member.school || "未填寫")}</span>
              <span>電話：${escapeHtml(member.phone || "未填寫")}</span>
              <span>信箱：${escapeHtml(member.email || "未填寫")}</span>
              <span>建立時間：${escapeHtml(formatTimestamp(member.createdAt))}</span>
              <span>最近登入：${escapeHtml(formatTimestamp(member.lastLoginAt))}</span>
            </div>
            <div class="application-actions member-actions">
              <button class="button-secondary application-save" data-member-action="delete" data-member-origin="${escapeHtml(member.origin || "members")}" data-member-id="${escapeHtml(member.origin === "applications" ? member.applicationId : member.id)}" type="button">
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
    <p class="content-copy">Front-end admin: <code>${escapeHtml(details.frontEndAdmin)}</code></p>
  `;
};

const getCollectionEntries = async (collectionName) => {
  const target = collection(db, collectionName);
  const snapshot = await getDocs(target);
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
};

const loadWithFallback = async (label, warnings, loader, fallbackValue) => {
  try {
    return await loader();
  } catch (error) {
    warnings.push({ label, error });
    return fallbackValue;
  }
};

const buildLoadWarningMarkup = ({ title, copy, details = [] }) => {
  const detailMarkup = details.length
    ? `
      <ul class="load-warning-list">
        ${details
          .map(
            ({ label, error }) => `
              <li>
                <strong>${escapeHtml(label)}</strong>${error?.message ? `: ${escapeHtml(error.message)}` : ""}
              </li>
            `,
          )
          .join("")}
      </ul>
    `
    : "";

  return `
    <article class="content-card is-tight load-warning-card">
      <h3 class="content-title">${escapeHtml(title)}</h3>
      <p class="content-copy">${escapeHtml(copy)}</p>
      ${detailMarkup}
    </article>
  `;
};

const refreshMembersDashboardSafe = async ({ force = false, preserveExpandedRows = false } = {}) => {
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
  const expandedMemberKeys = preserveExpandedRows ? getExpandedMemberKeys() : [];
  bindAdminClassCreationForms();

  try {
    if (force || !membersDashboardCache.loaded) {
      const dashboardWarnings = [];
      const [members, applications, classSessions, classSessionSignups, announcements, faqs] = await Promise.all([
        loadWithFallback("社員名單", dashboardWarnings, () => getCollectionEntries("members"), []),
        loadWithFallback("待審核申請", dashboardWarnings, () => getCollectionEntries("applications"), []),
        loadWithFallback("社課日期", dashboardWarnings, () => getCollectionEntries(CLASS_SESSION_COLLECTION), []),
        loadWithFallback("社課報名", dashboardWarnings, () => getCollectionEntries(CLASS_SIGNUP_COLLECTION), []),
        loadWithFallback("公告", dashboardWarnings, () => getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION), []),
        loadWithFallback("FAQ", dashboardWarnings, () => getCollectionEntries(FAQ_COLLECTION), []),
      ]);

      membersDashboardCache = {
        members,
        applications,
        classSessions,
        classSessionSignups,
        announcements,
        faqs,
        loadWarnings: dashboardWarnings,
        loaded: true,
      };
    }

    const displayMembers = mergeMembersWithApprovedApplications(
      membersDashboardCache.members,
      membersDashboardCache.applications,
    );

    renderMembersSummary(displayMembers, membersDashboardCache.applications);
    if (membersDashboardCache.loadWarnings.length > 0) {
      summary.insertAdjacentHTML(
        "afterbegin",
        buildLoadWarningMarkup({
          title: "部分資料載入失敗",
          copy: "部分 Firestore 資料目前無法讀取，下面仍會顯示已載入的內容。",
          details: membersDashboardCache.loadWarnings,
        }),
      );
    }
    await renderApplicationReviewList(membersDashboardCache.applications);
    renderMembersList(displayMembers);
    renderAdminClassCalendarCompact(membersDashboardCache.classSessions, membersDashboardCache.classSessionSignups);
    renderAdminAnnouncements(membersDashboardCache.announcements);
    renderAdminFaqs(membersDashboardCache.faqs);
    if (preserveExpandedRows) {
      restoreExpandedMemberKeys(expandedMemberKeys);
    }
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
    const classCalendar = document.querySelector("[data-class-session-calendar]");
    if (classCalendar) {
      classCalendar.innerHTML = `
        <article class="content-card is-tight">
          <h3 class="content-title">社課月曆讀取失敗</h3>
          <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
        </article>
      `;
    }

    const announcementAdminList = document.querySelector("[data-announcement-admin-list]");
    if (announcementAdminList) {
      announcementAdminList.innerHTML = `
        <article class="content-card is-tight">
          <h3 class="content-title">?砍?蝞∠?霈?仃??/h3>
          <p class="content-copy">${escapeHtml(error?.message || "隢?敺?閰虫?甈～?")}</p>
        </article>
      `;
    }

    const faqAdminList = document.querySelector("[data-faq-admin-list]");
    if (faqAdminList) {
      faqAdminList.innerHTML = `
        <article class="content-card is-tight">
          <h3 class="content-title">FAQ 載入失敗</h3>
          <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
        </article>
      `;
    }
  }
};

function getClassSignupOptionMarkup(selectedValue = "") {
  return buildSelectOptionsMarkup([...CLASS_SUNDAY_SLOTS, "不方便參加"], selectedValue);
}

function groupClassSignupsBySession(signups = []) {
  return signups.reduce((acc, signup) => {
    const sessionId = String(signup.sessionId || "").trim();
    if (!sessionId) {
      return acc;
    }

    if (!acc[sessionId]) {
      acc[sessionId] = [];
    }

    acc[sessionId].push(signup);
    return acc;
  }, {});
}

function isClassSignupWindowOpen(session) {
  const sessionDateMs = getClassSessionSortMs(session);
  if (!Number.isFinite(sessionDateMs) || sessionDateMs === Number.POSITIVE_INFINITY) {
    return false;
  }

  const diffMs = sessionDateMs - Date.now();
  return diffMs >= 0 && diffMs <= CLASS_SIGNUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function renderClassCalendarBoard(sessions = []) {
  const container = document.querySelector("[data-class-calendar]");
  if (!container) {
    return;
  }

  const referenceDate = new Date();
  referenceDate.setDate(1);
  referenceDate.setMonth(referenceDate.getMonth() + classSignupPageState.monthOffset);

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const monthLabel = referenceDate.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });

  const monthSessions = sessions.filter((session) => {
    const sessionDate = parseDateKey(session.date || session.sessionDate || "");
    return sessionDate && sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
  });

  const sessionMap = monthSessions.reduce((acc, session) => {
    const dateKey = String(session.date || session.sessionDate || "").trim();
    if (!dateKey) {
      return acc;
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }

    acc[dateKey].push(session);
    return acc;
  }, {});

  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const cells = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(`<div class="calendar-day is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateInputValue(date);
    const daySessions = sessionMap[dateKey] || [];
    const sessionMarkup = daySessions
      .map((session) => {
        const badge = session.signupRequired ? "需報名" : "免報名";
        return `
          <span class="calendar-session-pill">
            <span>${escapeHtml(getWeekdayLabel(session.weekday) || session.weekday || "")}</span>
            <span>${escapeHtml(getClassSessionTimeLabel(session) || "時間未設定")}</span>
            <span>${escapeHtml(badge)}</span>
          </span>
        `;
      })
      .join("");

    cells.push(`
      <div class="calendar-day${daySessions.length > 0 ? " is-session" : ""}">
        <span class="calendar-day-number">${escapeHtml(daySessions.length > 0 ? `${day} / ${daySessions.length} 場` : String(day))}</span>
        <span class="calendar-day-date">${escapeHtml(`${month + 1}/${day}`)}</span>
        <div class="calendar-session-list">${sessionMarkup || ""}</div>
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="calendar-day is-empty" aria-hidden="true"></div>`);
  }

  container.innerHTML = `
    <div class="calendar-shell">
      <div class="calendar-header">
        <div>
          <p class="section-kicker">Calendar</p>
          <h3 class="content-title">${escapeHtml(monthLabel)}</h3>
          <p class="section-description">有社課的日期會在日曆上標記，週日會另外顯示可報名的時段。</p>
        </div>
        <div class="calendar-nav">
          <button class="button-secondary" data-class-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-class-calendar-next type="button">下個月</button>
        </div>
      </div>
      <div class="calendar-weekdays">
        ${dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </div>
  `;

  container.querySelector("[data-class-calendar-prev]")?.addEventListener("click", () => {
    classSignupPageState.monthOffset -= 1;
    renderClassCalendarBoard(classSignupPageState.sessions);
  });

  container.querySelector("[data-class-calendar-next]")?.addEventListener("click", () => {
    classSignupPageState.monthOffset += 1;
    renderClassCalendarBoard(classSignupPageState.sessions);
  });
}

function buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, signupOpen) {
  const nameValue = approvalData?.name || currentUser?.displayName || currentUser?.email || "";
  const studentIdValue = approvalData?.studentId || "";
  const firstChoice = ownSignup?.firstChoice || "";
  const secondChoice = ownSignup?.secondChoice || "";
  const noteValue = ownSignup?.note || "";
  const sessionId = getClassSessionId(session);
  const deleteButton = ownSignup
    ? `<button class="button-secondary" data-class-signup-delete type="button" data-session-id="${escapeHtml(sessionId)}">刪除報名</button>`
    : "";

  if (!canSignup) {
    return `
      <div class="class-session-locked">
        <p class="content-copy">你目前尚未通過正式申請，暫時無法報名社課。若已送出申請，請先等待管理員審核。</p>
      </div>
    `;
  }

  if (!signupOpen) {
    return `
      <div class="class-session-locked">
        <p class="content-copy">這場社課尚未開放報名，請等到公布前一週再來填寫志願。</p>
      </div>
    `;
  }

  return `
    <form class="form-grid class-signup-form" data-class-signup-form data-session-id="${escapeHtml(sessionId)}">
      <input type="hidden" name="sessionId" value="${escapeHtml(sessionId)}" />
      <div class="class-signup-profile">
        <div class="form-field">
          <label>姓名</label>
          <input name="name" type="text" value="${escapeHtml(nameValue)}" readonly />
        </div>
        <div class="form-field">
          <label>學號</label>
          <input name="studentId" type="text" value="${escapeHtml(studentIdValue)}" readonly />
        </div>
      </div>
      <div class="class-signup-grid">
        <div class="form-field">
          <label for="class-first-${escapeHtml(sessionId)}">第一志願</label>
          <select id="class-first-${escapeHtml(sessionId)}" name="firstChoice" data-class-choice>
            ${getClassSignupOptionMarkup(firstChoice)}
          </select>
        </div>
        <div class="form-field">
          <label for="class-second-${escapeHtml(sessionId)}">第二志願</label>
          <select id="class-second-${escapeHtml(sessionId)}" name="secondChoice" data-class-choice>
            ${getClassSignupOptionMarkup(secondChoice)}
          </select>
        </div>
      </div>
      <div class="form-field">
        <label for="class-note-${escapeHtml(sessionId)}">備註</label>
        <textarea id="class-note-${escapeHtml(sessionId)}" name="note" rows="3" placeholder="如果有需要補充的資訊可以寫在這裡">${escapeHtml(noteValue)}</textarea>
      </div>
      <div class="class-signup-actions">
        <button class="button-primary" data-class-signup-submit type="submit">${ownSignup ? "更新報名" : "送出報名"}</button>
        ${deleteButton}
      </div>
    </form>
  `;
}

function renderClassSessionBoard(sessions = []) {
  const container = document.querySelector("[data-class-session-board]");
  if (!container) {
    return;
  }

  const sortedSessions = [...sessions].sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));
  const ownedBySession = Object.fromEntries(classSignupPageState.ownSignups.map((signup) => [signup.sessionId, signup]));
  const approvalData = classSignupPageState.approval;
  const canSignup = Boolean(currentUser && (approvalData || currentUserIsAdmin));

  if (sortedSessions.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前還沒有設定社課日期</h3>
        <p class="content-copy">管理員可以先到後台設定行事曆，之後這裡就會自動顯示可報名的社課。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sortedSessions
    .map((session) => {
      const sessionId = getClassSessionId(session);
      const ownSignup = ownedBySession[sessionId] || null;
      const isSundaySignup = String(session.weekday || "").toLowerCase() === "sun" && Boolean(session.signupRequired);
      const rosterPublished = Boolean(session.rosterPublished);
      const openForSignup = isSundaySignup && isClassSignupWindowOpen(session);
      const statusLabel = rosterPublished
        ? "名單已公布"
        : isSundaySignup
          ? openForSignup
            ? "報名中"
            : "尚未開放"
          : "固定社課";
      const rosterMarkup =
        rosterPublished && Array.isArray(session.publishedRoster) && session.publishedRoster.length > 0
          ? `
            <div class="class-roster-list">
              ${session.publishedRoster
                .map(
                  (entry, index) => `
                    <div class="class-roster-item">
                      <span class="class-roster-index">#${String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <p class="class-roster-name">${escapeHtml(entry.name || "未填姓名")} / ${escapeHtml(entry.studentId || "未填學號")}</p>
                        <p class="class-roster-copy">${escapeHtml(entry.firstChoice || "未填志願一")} ・ ${escapeHtml(entry.secondChoice || "未填志願二")}</p>
                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `
          : "";

      return `
        <article class="content-card class-session-card">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h3 class="content-title">${escapeHtml(session.title || "社課")}</h3>
              <p class="content-copy">${escapeHtml(getClassSessionDateLabel(session))} ・ ${escapeHtml(getClassSessionTimeLabel(session) || "時間待定")}</p>
            </div>
            <span class="member-row-status">${escapeHtml(statusLabel)}</span>
          </div>
          <p class="content-copy">${escapeHtml(session.description || session.reminder || "請依照行事曆確認社課日期。")}</p>
          ${session.reminder ? `<p class="class-session-reminder">提醒：${escapeHtml(session.reminder)}</p>` : ""}
          ${
            isSundaySignup
              ? buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, openForSignup)
              : `<div class="class-session-note"><p class="content-copy">此場次不需要填寫志願，請直接依行事曆出席即可。</p></div>`
          }
          ${rosterMarkup}
        </article>
      `;
    })
    .join("");

  bindClassSignupBoardEvents();
}

function renderClassRosterBoard(sessions = []) {
  const container = document.querySelector("[data-class-roster-board]");
  if (!container) {
    return;
  }

  const publishedSessions = [...sessions]
    .filter((session) => Boolean(session.rosterPublished))
    .sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));

  if (publishedSessions.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">尚未公布社課名單</h3>
        <p class="content-copy">管理員在星期五公布後，這裡會自動顯示名單。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = publishedSessions
    .map(
      (session) => `
        <article class="content-card class-roster-card">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h3 class="content-title">${escapeHtml(session.title || "社課名單")}</h3>
              <p class="content-copy">${escapeHtml(getClassSessionDateLabel(session))} ・ ${escapeHtml(getClassSessionTimeLabel(session) || "時間待定")}</p>
            </div>
            <span class="member-row-status">已公布</span>
          </div>
          <p class="content-copy">${escapeHtml(session.reminder || "依公布名單出席。")}</p>
          ${
            Array.isArray(session.publishedRoster) && session.publishedRoster.length > 0
              ? `
                <div class="class-roster-list">
                  ${session.publishedRoster
                    .map(
                      (entry, index) => `
                        <div class="class-roster-item">
                          <span class="class-roster-index">#${String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <p class="class-roster-name">${escapeHtml(entry.name || "未填姓名")} / ${escapeHtml(entry.studentId || "未填學號")}</p>
                            <p class="class-roster-copy">${escapeHtml(entry.firstChoice || "未填志願一")} ・ ${escapeHtml(entry.secondChoice || "未填志願二")}</p>
                          </div>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              `
              : `<p class="content-copy">目前還沒有名單內容。</p>`
          }
        </article>
      `,
    )
    .join("");
}

function bindClassSignupBoardEvents() {
  document.querySelectorAll("[data-class-signup-form]").forEach((form) => {
    if (form.dataset.initialized === "true") {
      return;
    }

    form.dataset.initialized = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleClassSignupSubmit(event);
    });
  });

  document.querySelectorAll("[data-class-signup-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId || "";
      if (!sessionId || !currentUser?.uid) {
        return;
      }

      const confirmed = window.confirm("要刪除這筆社課報名嗎？");
      if (!confirmed) {
        return;
      }

      try {
        await ensureAuthReady();
        await deleteDoc(getClassSignupDocRef(sessionId, currentUser.uid));
        await refreshClassSignupPageSafe({ force: true });
      } catch (error) {
        console.error("Delete class signup failed:", error);
      }
    });
  });
}

async function handleClassSignupSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-class-signup-submit]");
  const sessionId = String(form.dataset.sessionId || form.querySelector("[name='sessionId']")?.value || "").trim();
  const firstChoice = String(form.querySelector("[name='firstChoice']")?.value || "").trim();
  const secondChoice = String(form.querySelector("[name='secondChoice']")?.value || "").trim();
  const note = String(form.querySelector("[name='note']")?.value || "").trim();
  const name = String(form.querySelector("[name='name']")?.value || "").trim();
  const studentId = String(form.querySelector("[name='studentId']")?.value || "").trim();

  if (!currentUser?.uid || !sessionId) {
    return;
  }

  if (!classSignupPageState.approval && !currentUserIsAdmin) {
    return;
  }

  if (!firstChoice || !secondChoice) {
    return;
  }

  if (firstChoice === secondChoice) {
    return;
  }

  const session = classSignupPageState.sessions.find((item) => getClassSessionId(item) === sessionId);
  if (!session) {
    return;
  }

  submitButton.disabled = true;

  try {
    const signupRef = getClassSignupDocRef(sessionId, currentUser.uid);
    await setDoc(
      signupRef,
      {
        sessionId,
        userId: currentUser.uid,
        email: currentUser.email || "",
        name: name || classSignupPageState.approval?.name || currentUser.email || "",
        studentId: studentId || classSignupPageState.approval?.studentId || "",
        firstChoice,
        secondChoice,
        note,
        sessionDate: session.date || "",
        sessionWeekday: session.weekday || "",
        sessionTitle: session.title || "",
        sessionTimeLabel: session.timeLabel || "",
        sessionReminder: session.reminder || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await refreshClassSignupPageSafe({ force: true });
  } catch (error) {
    console.error("Class signup submit failed:", error);
  } finally {
    submitButton.disabled = false;
  }
}

async function refreshClassSignupPageSafe({ force = false } = {}) {
  if (pageName !== "class-signup") {
    return;
  }

  const calendar = document.querySelector("[data-class-calendar]");
  const sessionBoard = document.querySelector("[data-class-session-board]");
  const rosterBoard = document.querySelector("[data-class-roster-board]");

  if (!calendar || !sessionBoard || !rosterBoard) {
    return;
  }

  if (!firebaseConfigured) {
    const message = `
      <article class="content-card is-tight">
        <h3 class="content-title">Firebase 尚未設定</h3>
        <p class="content-copy">請先確認 <code>src/firebase-config.js</code> 與 Firestore 連線設定。</p>
      </article>
    `;
    calendar.innerHTML = message;
    sessionBoard.innerHTML = message;
    rosterBoard.innerHTML = message;
    return;
  }

  try {
    const loadWarnings = [];
    if (force || !classSignupPageState.loaded) {
      const [sessions, ownSignups, approvalDoc] = await Promise.all([
        loadWithFallback("社課日期", loadWarnings, () => getCollectionEntries(CLASS_SESSION_COLLECTION), []),
        currentUser?.uid
          ? loadWithFallback(
              "我的報名",
              loadWarnings,
              () => getDocs(query(collection(db, CLASS_SIGNUP_COLLECTION), where("userId", "==", currentUser.uid))),
              { docs: [] },
            )
          : Promise.resolve({ docs: [] }),
        currentUser?.email
          ? loadWithFallback("審核資料", loadWarnings, () => getDoc(getApprovalDocRef(currentUser.email)), null)
          : Promise.resolve(null),
      ]);

      classSignupPageState.sessions = sessions;
      classSignupPageState.ownSignups = ownSignups.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      classSignupPageState.approval =
        approvalDoc && typeof approvalDoc.exists === "function" && approvalDoc.exists() ? approvalDoc.data() : null;
      classSignupPageState.loadWarnings = loadWarnings;
      classSignupPageState.loaded = true;
    }

    renderClassCalendarBoard(classSignupPageState.sessions);
    renderClassSessionBoard(classSignupPageState.sessions);
    renderClassRosterBoard(classSignupPageState.sessions);
    if (classSignupPageState.loadWarnings.length > 0) {
      calendar.insertAdjacentHTML(
        "afterbegin",
        buildLoadWarningMarkup({
          title: "部分資料載入失敗",
          copy: "目前部分 Firestore 資料無法讀取，下面仍會顯示已載入的社課內容。",
          details: classSignupPageState.loadWarnings,
        }),
      );
    }
  } catch (error) {
    console.error("Class signup board load failed:", error);
    const message = `
      <article class="content-card is-tight">
        <h3 class="content-title">社課資料載入失敗</h3>
        <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
      </article>
    `;
    calendar.innerHTML = message;
    sessionBoard.innerHTML = message;
    rosterBoard.innerHTML = message;
  }
}

function renderAnnouncementsBoard(announcements = []) {
  const container = document.querySelector("[data-announcement-board]");
  if (!container) {
    return;
  }

  const sortedAnnouncements = [...announcements].sort((a, b) => getAnnouncementSortMs(b) - getAnnouncementSortMs(a));

  if (sortedAnnouncements.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有公告</h3>
        <p class="content-copy">管理員之後發布的訊息會出現在這裡，並依時間由新到舊排列。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sortedAnnouncements
    .map(
      (announcement) => `
        <article class="notice-card">
          <div class="notice-meta">
            <span>${escapeHtml(announcement.date || formatTimestamp(announcement.createdAt))}</span>
            <span>${escapeHtml(announcement.reminder || "公告")}</span>
          </div>
          <h3 class="notice-title">${escapeHtml(announcement.title || "公告")}</h3>
          <p class="notice-copy">${escapeHtml(announcement.body || announcement.message || "")}</p>
        </article>
      `,
    )
    .join("");
}

async function refreshAnnouncementsPageSafe({ force = false } = {}) {
  if (pageName !== "notices") {
    return;
  }

  const board = document.querySelector("[data-announcement-board]");
  if (!board) {
    return;
  }

  if (!firebaseConfigured) {
    board.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">Firebase 尚未設定</h3>
        <p class="content-copy">請先確認 <code>src/firebase-config.js</code> 與 Firestore 規則。</p>
      </article>
    `;
    return;
  }

  try {
    const loadWarnings = [];
    if (force || !announcementPageState.loaded) {
      const announcements = await loadWithFallback(
        "公告",
        loadWarnings,
        () => getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION),
        [],
      );
      announcementPageState.announcements = announcements;
      announcementPageState.loadWarnings = loadWarnings;
      announcementPageState.loaded = true;
    }

    renderAnnouncementsBoard(announcementPageState.announcements);
    if (announcementPageState.loadWarnings.length > 0) {
      board.insertAdjacentHTML(
        "afterbegin",
        buildLoadWarningMarkup({
          title: "部分資料載入失敗",
          copy: "目前部分公告資料無法讀取，下面仍會顯示已載入的公告。",
          details: announcementPageState.loadWarnings,
        }),
      );
    }
  } catch (error) {
    console.error("Announcement board load failed:", error);
    board.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">公告載入失敗</h3>
        <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
      </article>
    `;
  }
}

function renderFaqBoard(faqEntries = []) {
  const container = document.querySelector("[data-faq-board]");
  if (!container) {
    return;
  }

  const sortedFaqs = [...faqEntries].sort((a, b) => getFaqSortMs(b) - getFaqSortMs(a));

  if (sortedFaqs.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有 FAQ</h3>
        <p class="content-copy">管理員可以先在後台新增問題與回答，這一頁就會自動顯示。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sortedFaqs
    .map(
      (faq) => `
        <details class="faq-item">
          <summary class="faq-trigger">
            <span class="faq-question">${escapeHtml(faq.question || "問題")}</span>
            <span class="faq-icon" aria-hidden="true">
              <span class="faq-icon-line faq-icon-line-horizontal"></span>
              <span class="faq-icon-line faq-icon-line-vertical"></span>
            </span>
          </summary>
          <div class="faq-panel">
            <p class="faq-answer">${escapeHtml(faq.answer || faq.body || "")}</p>
          </div>
        </details>
      `,
    )
    .join("");

  initFaqAccordion();
}

async function refreshFaqPageSafe({ force = false } = {}) {
  if (pageName !== "faq") {
    return;
  }

  const board = document.querySelector("[data-faq-board]");
  if (!board) {
    return;
  }

  if (!firebaseConfigured) {
    board.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">Firebase 尚未設定</h3>
        <p class="content-copy">請先確認 <code>src/firebase-config.js</code> 與 Firestore 連線設定。</p>
      </article>
    `;
    return;
  }

  try {
    const loadWarnings = [];
    if (force || !faqPageState.loaded) {
      const faqs = await loadWithFallback("FAQ", loadWarnings, () => getCollectionEntries(FAQ_COLLECTION), []);
      faqPageState.faqs = faqs;
      faqPageState.loadWarnings = loadWarnings;
      faqPageState.loaded = true;
    }

    renderFaqBoard(faqPageState.faqs);
    if (faqPageState.loadWarnings.length > 0) {
      board.insertAdjacentHTML(
        "afterbegin",
        buildLoadWarningMarkup({
          title: "部分資料載入失敗",
          copy: "目前部分 FAQ 資料無法讀取，下面仍會顯示已載入的問題。",
          details: faqPageState.loadWarnings,
        }),
      );
    }
  } catch (error) {
    console.error("FAQ board load failed:", error);
    board.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">FAQ 載入失敗</h3>
        <p class="content-copy">${escapeHtml(error?.message || "請稍後再試一次。")}</p>
      </article>
    `;
  }
}

function renderAdminClassSessions(sessions = [], signups = []) {
  const container = document.querySelector("[data-class-session-admin-list]");
  if (!container) {
    return;
  }

  const groupedSignups = groupClassSignupsBySession(signups);
  const sortedSessions = [...sessions].sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));

  if (sortedSessions.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有社課設定</h3>
        <p class="content-copy">先用左側表單建立一個新的社課日期，行事曆就會自動出現。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sortedSessions
    .map((session) => {
      const sessionId = getClassSessionId(session);
      const sessionSignups = (groupedSignups[sessionId] || []).sort(
        (a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt),
      );
      const rosterCount = Array.isArray(session.publishedRoster) ? session.publishedRoster.length : 0;
      const signupSummary =
        sessionSignups.length > 0
          ? sessionSignups
              .map(
                (signup) => `
                  <div class="admin-signup-item">
                    <strong>${escapeHtml(signup.name || "未填姓名")}</strong>
                    <span>${escapeHtml(signup.studentId || "未填學號")}</span>
                    <span>${escapeHtml(signup.firstChoice || "未填志願一")} / ${escapeHtml(signup.secondChoice || "未填志願二")}</span>
                  </div>
                `,
              )
              .join("")
          : `<p class="content-copy">目前沒有報名資料。</p>`;

      return `
        <article class="content-card class-admin-card">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h3 class="content-title">${escapeHtml(session.title || "社課")}</h3>
              <p class="content-copy">${escapeHtml(getClassSessionDateLabel(session))} ・ ${escapeHtml(getClassSessionTimeLabel(session) || "時間待定")}</p>
            </div>
            <span class="member-row-status">${escapeHtml(session.rosterPublished ? "已公布" : "未公布")}</span>
          </div>
          <p class="content-copy">${escapeHtml(session.description || session.reminder || "")}</p>
          <div class="class-admin-meta">
            <span>報名：${escapeHtml(String(sessionSignups.length))} 筆</span>
            <span>名單：${escapeHtml(String(rosterCount))} 人</span>
            <span>報名需求：${escapeHtml(session.signupRequired ? "需要" : "不需要")}</span>
          </div>
          <div class="admin-signup-summary">
            ${signupSummary}
          </div>
          <div class="application-actions class-admin-actions">
            <button class="button-secondary" data-class-session-publish type="button" data-session-id="${escapeHtml(sessionId)}">公布名單</button>
            <button class="button-secondary application-save" data-class-session-delete type="button" data-session-id="${escapeHtml(sessionId)}">刪除社課</button>
          </div>
        </article>
      `;
    })
    .join("");

  bindAdminClassSessionActions();
}

function renderAdminAnnouncements(announcements = []) {
  const container = document.querySelector("[data-announcement-admin-list]");
  if (!container) {
    return;
  }

  const sortedAnnouncements = [...announcements].sort((a, b) => getAnnouncementSortMs(b) - getAnnouncementSortMs(a));

  if (sortedAnnouncements.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有公告</h3>
        <p class="content-copy">你可以先用左邊表單發佈第一則公告。</p>
      </article>
    `;
    bindAdminAnnouncementListResize();
    syncAdminAnnouncementListHeight();
    return;
  }

  container.innerHTML = sortedAnnouncements
    .map(
      (announcement) => `
        <details class="notice-card class-announcement-card">
          <summary class="class-announcement-summary">
            <div class="class-announcement-summary-main">
              <div class="notice-meta">
                <span>${escapeHtml(announcement.date || formatTimestamp(announcement.createdAt))}</span>
                <span>${escapeHtml(announcement.reminder || "公告")}</span>
              </div>
              <h3 class="notice-title">${escapeHtml(announcement.title || "公告")}</h3>
            </div>
            <span class="class-announcement-toggle class-announcement-toggle-open">展開</span>
            <span class="class-announcement-toggle class-announcement-toggle-close">收合</span>
          </summary>
          <div class="class-announcement-body">
            <p class="notice-copy">${escapeHtml(announcement.body || announcement.message || "")}</p>
            <div class="application-actions class-admin-actions">
              <button class="button-secondary application-save" data-announcement-delete type="button" data-announcement-id="${escapeHtml(announcement.id)}">刪除公告</button>
            </div>
          </div>
        </details>
      `,
    )
    .join("");

  bindAdminAnnouncementActions();
  bindAdminAnnouncementListResize();
  syncAdminAnnouncementListHeight();
}

function renderAdminFaqs(faqEntries = []) {
  const container = document.querySelector("[data-faq-admin-list]");
  if (!container) {
    return;
  }

  const sortedFaqs = [...faqEntries].sort((a, b) => getFaqSortMs(b) - getFaqSortMs(a));

  if (sortedFaqs.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有 FAQ</h3>
        <p class="content-copy">你可以先用左邊表單新增第一則問答。</p>
      </article>
    `;
    bindAdminFaqListResize();
    syncAdminFaqListHeight();
    return;
  }

  container.innerHTML = sortedFaqs
    .map(
      (faq) => `
        <details class="faq-item class-faq-card">
          <summary class="faq-trigger">
            <span class="faq-question">${escapeHtml(faq.question || "問題")}</span>
            <span class="faq-icon" aria-hidden="true">
              <span class="faq-icon-line faq-icon-line-horizontal"></span>
              <span class="faq-icon-line faq-icon-line-vertical"></span>
            </span>
          </summary>
          <div class="faq-panel">
            <p class="faq-answer">${escapeHtml(faq.answer || faq.body || "")}</p>
            <div class="application-actions class-admin-actions">
              <button class="button-secondary application-save" data-faq-delete type="button" data-faq-id="${escapeHtml(faq.id)}">刪除 FAQ</button>
            </div>
          </div>
        </details>
      `,
    )
    .join("");

  bindAdminFaqActions();
  bindAdminFaqListResize();
  syncAdminFaqListHeight();
  initFaqAccordion();
}

function bindAdminClassSessionActions() {
  document.querySelectorAll("[data-class-session-publish]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId || "";
      const session = membersDashboardCache.classSessions.find((item) => getClassSessionId(item) === sessionId);
      if (!session) {
        return;
      }
      closeAdminClassCalendarModal();

      const confirmed = window.confirm("要公布這個社課的名單嗎？");
      if (!confirmed) {
        return;
      }

      try {
        const grouped = groupClassSignupsBySession(membersDashboardCache.classSessionSignups);
        const sessionSignups = (grouped[sessionId] || []).sort(
          (a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt),
        );
        const publishedRoster = sessionSignups.map((signup) => ({
          name: signup.name || "",
          studentId: signup.studentId || "",
          firstChoice: signup.firstChoice || "",
          secondChoice: signup.secondChoice || "",
          note: signup.note || "",
          email: signup.email || "",
          userId: signup.userId || "",
          submittedAt: formatTimestamp(signup.submittedAt || signup.createdAt),
        }));

        await setDoc(
          getClassSessionDocRef(sessionId),
          {
            ...session,
            rosterPublished: true,
            publishedRoster,
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Publish roster failed:", error);
        window.alert(`公布名單失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });

  document.querySelectorAll("[data-class-session-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId || "";
      if (!sessionId) {
        return;
      }
      closeAdminClassCalendarModal();

      const confirmed = window.confirm("要刪除這個社課設定嗎？相關報名資料也會一併刪除。");
      if (!confirmed) {
        return;
      }

      try {
        const relatedSignups = membersDashboardCache.classSessionSignups.filter((signup) => String(signup.sessionId || "") === sessionId);
        await Promise.all(relatedSignups.map((signup) => deleteDoc(doc(db, CLASS_SIGNUP_COLLECTION, signup.id))));
        await deleteDoc(getClassSessionDocRef(sessionId));
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete class session failed:", error);
        window.alert(`刪除社課失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });
}

function bindAdminAnnouncementActions() {
  document.querySelectorAll("[data-announcement-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const announcementId = button.dataset.announcementId || "";
      if (!announcementId) {
        return;
      }

      const confirmed = window.confirm("要刪除這則公告嗎？");
      if (!confirmed) {
        return;
      }

      try {
        await deleteDoc(getClassAnnouncementDocRef(announcementId));
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete announcement failed:", error);
        window.alert(`刪除公告失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });
}

function bindAdminFaqActions() {
  document.querySelectorAll("[data-faq-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const faqId = button.dataset.faqId || "";
      if (!faqId) {
        return;
      }

      const confirmed = window.confirm("要刪除這則 FAQ 嗎？");
      if (!confirmed) {
        return;
      }

      try {
        await deleteDoc(getFaqDocRef(faqId));
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete FAQ failed:", error);
        window.alert(`刪除 FAQ 失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });
}

async function handleClassSessionFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-class-session-submit]");
  const date = String(form.querySelector("[name='date']")?.value || "").trim();
  const weekday = getWeekdayKeyFromDateValue(date);
  const title = String(form.querySelector("[name='title']")?.value || "").trim();
  const timeLabel = String(form.querySelector("[name='timeLabel']")?.value || "").trim();
  const description = String(form.querySelector("[name='description']")?.value || "").trim();
  const reminder = String(form.querySelector("[name='reminder']")?.value || "").trim();
  const signupRequired = Boolean(form.querySelector("[name='signupRequired']")?.checked);

  if (!date || !weekday || !title || !timeLabel) {
    window.alert("請先填寫日期、星期、標題與時間。");
    return;
  }

  const sessionId = getClassSessionId({ date, weekday });
  const sessionRef = getClassSessionDocRef(sessionId);
  submitButton.disabled = true;

  try {
    const existing = await getDoc(sessionRef);
    await setDoc(
      sessionRef,
      {
        date,
        weekday,
        title,
        timeLabel,
        description,
        reminder,
        signupRequired,
        rosterPublished: existing.exists() ? Boolean(existing.data()?.rosterPublished) : false,
        publishedRoster: existing.exists() ? existing.data()?.publishedRoster || [] : [],
        createdAt: existing.exists() ? existing.data()?.createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    form.reset();
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  } catch (error) {
    console.error("Save class session failed:", error);
    window.alert(`儲存社課失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleAnnouncementFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-announcement-submit]");
  const date = String(form.querySelector("[name='date']")?.value || "").trim();
  const title = String(form.querySelector("[name='title']")?.value || "").trim();
  const reminder = String(form.querySelector("[name='reminder']")?.value || "").trim();
  const bodyText = String(form.querySelector("[name='body']")?.value || "").trim();

  if (!date || !title || !bodyText) {
    window.alert("請先填寫日期、標題與公告內容。");
    return;
  }

  submitButton.disabled = true;

  try {
    const announcementRef = doc(collection(db, CLASS_ANNOUNCEMENT_COLLECTION));
    await setDoc(announcementRef, {
      date,
      title,
      reminder,
      body: bodyText,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    form.reset();
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  } catch (error) {
    console.error("Save announcement failed:", error);
    window.alert(`儲存公告失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleFaqFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-faq-submit]");
  const question = String(form.querySelector("[name='question']")?.value || "").trim();
  const answer = String(form.querySelector("[name='answer']")?.value || "").trim();

  if (!question || !answer) {
    window.alert("請填寫 FAQ 問題與回答。");
    return;
  }

  submitButton.disabled = true;

  try {
    const faqRef = doc(collection(db, FAQ_COLLECTION));
    await setDoc(faqRef, {
      question,
      answer,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    form.reset();
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  } catch (error) {
    console.error("Save FAQ failed:", error);
    window.alert(`儲存 FAQ 失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
  }
}

function bindAdminCreationForms() {
  const sessionForm = document.querySelector("[data-class-session-form]");
  if (sessionForm && sessionForm.dataset.initialized !== "true") {
    sessionForm.dataset.initialized = "true";
    sessionForm.addEventListener("submit", handleClassSessionFormSubmit);
  }

  const announcementForm = document.querySelector("[data-announcement-form]");
  if (announcementForm && announcementForm.dataset.initialized !== "true") {
    announcementForm.dataset.initialized = "true";
    announcementForm.addEventListener("submit", handleAnnouncementFormSubmit);
  }

  const faqForm = document.querySelector("[data-faq-form]");
  if (faqForm && faqForm.dataset.initialized !== "true") {
    faqForm.dataset.initialized = "true";
    faqForm.addEventListener("submit", handleFaqFormSubmit);
  }
}

function syncAdminAnnouncementListHeight() {
  const container = document.querySelector("[data-announcement-admin-list]");
  if (!container) {
    return;
  }

  if (!window.matchMedia("(min-width: 760px)").matches) {
    container.style.removeProperty("--announcement-list-max-height");
    return;
  }

  const sourceCard = document.querySelector("[data-announcement-form]")?.closest(".content-card");
  if (!(sourceCard instanceof HTMLElement)) {
    container.style.removeProperty("--announcement-list-max-height");
    return;
  }

  const height = Math.max(320, Math.round(sourceCard.getBoundingClientRect().height));
  container.style.setProperty("--announcement-list-max-height", `${height}px`);
}

function bindAdminAnnouncementListResize() {
  if (adminAnnouncementListResizeBound) {
    return;
  }

  adminAnnouncementListResizeBound = true;
  window.addEventListener("resize", () => {
    if (pageName === "members") {
      syncAdminAnnouncementListHeight();
    }
  });
}

function syncAdminFaqListHeight() {
  const container = document.querySelector("[data-faq-admin-list]");
  if (!container) {
    return;
  }

  if (!window.matchMedia("(min-width: 760px)").matches) {
    container.style.removeProperty("--faq-list-max-height");
    return;
  }

  const sourceCard = document.querySelector("[data-faq-form]")?.closest(".content-card");
  if (!(sourceCard instanceof HTMLElement)) {
    container.style.removeProperty("--faq-list-max-height");
    return;
  }

  const height = Math.max(320, Math.round(sourceCard.getBoundingClientRect().height));
  container.style.setProperty("--faq-list-max-height", `${height}px`);
}

function bindAdminFaqListResize() {
  if (adminFaqListResizeBound) {
    return;
  }

  adminFaqListResizeBound = true;
  window.addEventListener("resize", () => {
    if (pageName === "members") {
      syncAdminFaqListHeight();
    }
  });
}

const getAdminClassSessionForm = () => document.querySelector("[data-class-session-form]");
const getAdminClassCalendarContainer = () => document.querySelector("[data-class-session-calendar]");
const getAdminClassSessionState = () => document.querySelector("[data-class-session-edit-state]");
const getAdminClassSessionSubmitButton = () => document.querySelector("[data-class-session-submit]");
const getAdminClassSessionResetButton = () => document.querySelector("[data-class-session-reset]");
const getAdminClassSessionWeekdayPreview = () => document.querySelector("[data-class-session-weekday-preview]");
const getAdminClassSessionWeekdayInput = () => document.querySelector("[data-class-session-weekday]");
const syncAdminClassSessionWeekdayPreview = (form = getAdminClassSessionForm()) => {
  if (!form) {
    return "";
  }

  const dateInput = form.querySelector("[name='date']");
  const weekdayInput = form.querySelector("[name='weekday']");
  const preview = form.querySelector("[data-class-session-weekday-preview]");
  const weekdayKey = getWeekdayKeyFromDateValue(dateInput instanceof HTMLInputElement ? dateInput.value : "");
  const weekdayLabel = weekdayKey ? getWeekdayLabel(weekdayKey) : "";

  if (weekdayInput instanceof HTMLInputElement) {
    weekdayInput.value = weekdayKey;
  }

  if (preview) {
    preview.textContent = weekdayLabel
      ? `系統已自動判定為 ${weekdayLabel}`
      : "請先選擇日期，系統會自動判定星期。";
  }

  return weekdayKey;
};
const getAdminCalendarMonthOffset = (referenceDate) => {
  const today = new Date();
  today.setDate(1);
  const target = new Date(referenceDate);
  target.setDate(1);
  return (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
};
const getAdminCalendarReferenceDate = () => {
  const referenceDate = new Date();
  referenceDate.setDate(1);
  referenceDate.setMonth(referenceDate.getMonth() + adminClassCalendarMonthOffset);
  return referenceDate;
};

const setAdminClassSessionFormMode = (session = null) => {
  const form = getAdminClassSessionForm();
  if (!form) {
    return;
  }

  const sessionIdInput = form.querySelector("[name='sessionId']");
  const submitButton = getAdminClassSessionSubmitButton();
  const stateNode = getAdminClassSessionState();

  if (!session) {
    adminClassSessionEditingId = "";
    form.reset();
      if (sessionIdInput instanceof HTMLInputElement) {
        sessionIdInput.value = "";
      }
      syncAdminClassSessionWeekdayPreview(form);
      if (submitButton) {
      submitButton.textContent = "儲存社課";
    }
    if (stateNode) {
      stateNode.innerHTML = `目前為 <strong>新增模式</strong>，可從右側月曆點選社課進行編輯。`;
    }
    return;
  }

  adminClassSessionEditingId = getClassSessionId(session);

    const fieldValueMap = {
      date: session.date || session.sessionDate || "",
      title: session.title || "",
    timeLabel: session.timeLabel || session.time || "",
    reminder: session.reminder || "",
    description: session.description || "",
  };

  Object.entries(fieldValueMap).forEach(([name, value]) => {
    const element = form.querySelector(`[name='${name}']`);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = value;
    }
  });

  const signupRequiredField = form.querySelector("[name='signupRequired']");
    if (signupRequiredField instanceof HTMLInputElement) {
      signupRequiredField.checked = Boolean(session.signupRequired);
    }

    syncAdminClassSessionWeekdayPreview(form);

    if (sessionIdInput instanceof HTMLInputElement) {
      sessionIdInput.value = adminClassSessionEditingId;
  }
  if (submitButton) {
    submitButton.textContent = "更新社課";
  }
  if (stateNode) {
    stateNode.innerHTML = `目前編輯：<strong>${escapeHtml(session.title || "未命名社課")}</strong>，點「儲存社課」即可更新。`;
  }

  const monthReference = parseDateKey(session.date || session.sessionDate || "");
  if (monthReference) {
    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(monthReference);
  }
};

const clearAdminClassSessionFormMode = () => {
  setAdminClassSessionFormMode(null);
  renderAdminClassCalendarCompact(membersDashboardCache.classSessions, membersDashboardCache.classSessionSignups);
};

const renderAdminClassCalendar = (sessions = [], signups = []) => {
  const container = getAdminClassCalendarContainer();
  if (!container) {
    return;
  }

  const referenceDate = getAdminCalendarReferenceDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const monthLabel = referenceDate.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });

  const monthSessions = sessions.filter((session) => {
    const sessionDate = parseDateKey(session.date || session.sessionDate || "");
    return sessionDate && sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
  });

  const sessionsByDate = monthSessions.reduce((acc, session) => {
    const dateKey = String(session.date || session.sessionDate || "").trim();
    if (!dateKey) {
      return acc;
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }

    acc[dateKey].push(session);
    return acc;
  }, {});

  const signupsBySession = groupClassSignupsBySession(signups);
  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const todayKey = formatDateInputValue(new Date());
  const cells = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateInputValue(date);
    const daySessions = (sessionsByDate[dateKey] || []).sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));
    const eventMarkup = daySessions
      .map((session) => {
        const sessionId = getClassSessionId(session);
        const sessionSignups = signupsBySession[sessionId] || [];
        const rosterCount = Array.isArray(session.publishedRoster) ? session.publishedRoster.length : 0;
        const isEditing = adminClassSessionEditingId === sessionId;
        const publishedLabel = session.rosterPublished
          ? `已公布名單${rosterCount > 0 ? ` · ${rosterCount} 人` : ""}`
          : "尚未公布";

        return `
          <article class="admin-calendar-event${session.rosterPublished ? " is-published" : ""}${isEditing ? " is-editing" : ""}">
            <div class="admin-calendar-event-main">
              <p class="admin-calendar-event-weekday">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h4 class="admin-calendar-event-title">${escapeHtml(session.title || "未命名社課")}</h4>
              <p class="admin-calendar-event-meta">
                ${escapeHtml(getClassSessionTimeLabel(session) || "時間待定")} · ${escapeHtml(
                  session.signupRequired ? "需報名" : "免報名",
                )}
              </p>
              <p class="admin-calendar-event-note">${escapeHtml(session.reminder || session.description || "請依行事曆安排社課。")}</p>
              <p class="admin-calendar-event-status">${escapeHtml(publishedLabel)}${sessionSignups.length ? ` · 報名 ${sessionSignups.length} 人` : ""}</p>
            </div>
            <div class="admin-calendar-event-actions">
              <button class="button-secondary admin-mini-button" data-class-session-edit type="button" data-session-id="${escapeHtml(sessionId)}">編輯</button>
              <button class="button-secondary admin-mini-button" data-class-session-publish type="button" data-session-id="${escapeHtml(sessionId)}">
                ${session.rosterPublished ? "重新公布" : "公布名單"}
              </button>
              <button class="button-secondary admin-mini-button" data-class-session-delete type="button" data-session-id="${escapeHtml(sessionId)}">刪除</button>
            </div>
          </article>
        `;
      })
      .join("");

    cells.push(`
      <div class="admin-calendar-day${dateKey === todayKey ? " is-today" : ""}${daySessions.length > 0 ? " is-session" : ""}">
        <div class="admin-calendar-day-head">
          <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
          <span class="admin-calendar-day-label">${escapeHtml(`${month + 1}/${day}`)}</span>
        </div>
        <div class="admin-calendar-session-list">${eventMarkup || `<p class="admin-calendar-empty-note">今日無社課</p>`}</div>
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  container.innerHTML = `
    <div class="admin-calendar-shell">
      <div class="admin-calendar-header">
        <div>
          <p class="section-kicker">Calendar</p>
          <h3 class="content-title">${escapeHtml(monthLabel)}</h3>
          <p class="section-description">可在月曆上直接點編輯或刪除，左側表單會自動帶入目前社課資料。</p>
        </div>
        <div class="admin-calendar-nav">
          <button class="button-secondary" data-admin-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-admin-calendar-next type="button">下個月</button>
        </div>
      </div>
      ${monthSessions.length === 0 ? `<p class="admin-calendar-empty-board">這個月份目前沒有社課，可以先從左側新增。</p>` : ""}
      <div class="admin-calendar-weekdays">
        ${dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="admin-calendar-grid">
        ${cells.join("")}
      </div>
    </div>
  `;

  container.querySelector("[data-admin-calendar-prev]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset -= 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  container.querySelector("[data-admin-calendar-next]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset += 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  bindAdminClassCalendarActions();
};

const renderAdminClassCalendarCompact = (sessions = [], signups = []) => {
  const container = getAdminClassCalendarContainer();
  if (!container) {
    return;
  }

  const referenceDate = getAdminCalendarReferenceDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const monthLabel = referenceDate.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });

  const monthSessions = sessions.filter((session) => {
    const sessionDate = parseDateKey(session.date || session.sessionDate || "");
    return sessionDate && sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
  });

  const sessionsByDate = monthSessions.reduce((acc, session) => {
    const dateKey = String(session.date || session.sessionDate || "").trim();
    if (!dateKey) {
      return acc;
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }

    acc[dateKey].push(session);
    return acc;
  }, {});

  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const todayKey = formatDateInputValue(new Date());
  const cells = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateInputValue(date);
    const daySessions = (sessionsByDate[dateKey] || []).sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));
    const sessionCount = daySessions.length;
    const isToday = dateKey === todayKey;

    if (sessionCount > 0) {
      cells.push(`
        <button
          class="admin-calendar-day is-session${isToday ? " is-today" : ""}"
          type="button"
          data-admin-calendar-day
          data-date-key="${escapeHtml(dateKey)}"
        >
          <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
          <span class="admin-calendar-day-label">${escapeHtml(`${month + 1}/${day}`)}</span>
          <span class="admin-calendar-day-marker" aria-hidden="true"></span>
          <span class="admin-calendar-day-badge">${escapeHtml(`${sessionCount} 場`)}</span>
        </button>
      `);
      continue;
    }

    cells.push(`
      <div class="admin-calendar-day${isToday ? " is-today" : ""}" aria-hidden="true">
        <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
        <span class="admin-calendar-day-label">${escapeHtml(`${month + 1}/${day}`)}</span>
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  container.innerHTML = `
    <div class="admin-calendar-shell">
      <div class="admin-calendar-header">
        <div>
          <p class="section-kicker">Calendar</p>
          <h3 class="content-title">${escapeHtml(monthLabel)}</h3>
          <p class="section-description">藍色日期代表當天有社課，點一下就會看到詳細內容。</p>
        </div>
        <div class="admin-calendar-nav">
          <button class="button-secondary" data-admin-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-admin-calendar-next type="button">下個月</button>
        </div>
      </div>
      ${monthSessions.length === 0 ? `<p class="admin-calendar-empty-board">這個月份目前沒有社課，可以先從左側新增。</p>` : ""}
      <div class="admin-calendar-weekdays">
        ${dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="admin-calendar-grid">
        ${cells.join("")}
      </div>
    </div>
  `;

  container.querySelector("[data-admin-calendar-prev]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset -= 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  container.querySelector("[data-admin-calendar-next]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset += 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  bindAdminClassCalendarActions();
};

function bindAdminClassCalendarActions() {
  document.querySelectorAll("[data-admin-calendar-day]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const dateKey = button.dataset.dateKey || "";
      const daySessions = membersDashboardCache.classSessions.filter((session) => {
        const sessionDate = String(session.date || session.sessionDate || "").trim();
        return sessionDate === dateKey;
      });

      openAdminClassCalendarModal(dateKey, daySessions, button);
    });
  });

  const { calendarModal, closeButtons } = getAdminClassCalendarModalElements();
  closeButtons.forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", closeAdminClassCalendarModal);
  });

  if (calendarModal.dataset.initialized !== "true") {
    calendarModal.dataset.initialized = "true";
    calendarModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === calendarModal || target.hasAttribute("data-modal-backdrop")) {
        closeAdminClassCalendarModal();
      }
    });
  }

  document.querySelectorAll("[data-class-session-edit]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId || "";
      const session = membersDashboardCache.classSessions.find((item) => getClassSessionId(item) === sessionId);
      if (!session) {
        return;
      }

      closeAdminClassCalendarModal();
      setAdminClassSessionFormMode(session);
      renderAdminClassCalendarCompact(membersDashboardCache.classSessions, membersDashboardCache.classSessionSignups);
      getAdminClassSessionForm()?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-class-session-publish]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId || "";
      const session = membersDashboardCache.classSessions.find((item) => getClassSessionId(item) === sessionId);
      if (!session) {
        return;
      }

      const confirmed = window.confirm("確定要公布這一場社課的名單嗎？");
      if (!confirmed) {
        return;
      }

      try {
        const grouped = groupClassSignupsBySession(membersDashboardCache.classSessionSignups);
        const sessionSignups = (grouped[sessionId] || []).sort(
          (a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt),
        );

        const publishedRoster = sessionSignups.map((signup) => ({
          name: signup.name || "",
          studentId: signup.studentId || "",
          firstChoice: signup.firstChoice || "",
          secondChoice: signup.secondChoice || "",
          note: signup.note || "",
          email: signup.email || "",
          userId: signup.userId || "",
          submittedAt: formatTimestamp(signup.submittedAt || signup.createdAt),
        }));

        await setDoc(
          getClassSessionDocRef(sessionId),
          {
            ...session,
            rosterPublished: true,
            publishedRoster,
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Publish roster failed:", error);
        window.alert(`公布名單失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });

  document.querySelectorAll("[data-class-session-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId || "";
      if (!sessionId) {
        return;
      }

      const confirmed = window.confirm("確定要刪除這個社課嗎？相關報名資料也會一併刪除。");
      if (!confirmed) {
        return;
      }

      try {
        const relatedSignups = membersDashboardCache.classSessionSignups.filter((signup) => String(signup.sessionId || "") === sessionId);
        await Promise.all(relatedSignups.map((signup) => deleteDoc(doc(db, CLASS_SIGNUP_COLLECTION, signup.id))));
        await deleteDoc(getClassSessionDocRef(sessionId));

        if (adminClassSessionEditingId === sessionId) {
          clearAdminClassSessionFormMode();
        }

        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete class session failed:", error);
        window.alert(`刪除社課失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });
}

async function handleAdminClassSessionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-class-session-submit]");
  const sessionIdInput = form.querySelector("[name='sessionId']");
  const date = String(form.querySelector("[name='date']")?.value || "").trim();
  const weekday = String(form.querySelector("[name='weekday']")?.value || "").trim().toLowerCase();
  const title = String(form.querySelector("[name='title']")?.value || "").trim();
  const timeLabel = String(form.querySelector("[name='timeLabel']")?.value || "").trim();
  const description = String(form.querySelector("[name='description']")?.value || "").trim();
  const reminder = String(form.querySelector("[name='reminder']")?.value || "").trim();
  const signupRequired = Boolean(form.querySelector("[name='signupRequired']")?.checked);
  const editingSessionId = String(sessionIdInput?.value || adminClassSessionEditingId || "").trim();

  if (!date || !weekday || !title || !timeLabel) {
    window.alert("請先填完日期、星期、標題與時間。");
    return;
  }

  submitButton.disabled = true;

  try {
    const sessionRef = editingSessionId ? getClassSessionDocRef(editingSessionId) : doc(collection(db, CLASS_SESSION_COLLECTION));
    const existing = editingSessionId ? await getDoc(sessionRef) : null;
    const preservedCreatedAt = existing?.exists() ? existing.data()?.createdAt || serverTimestamp() : serverTimestamp();
    const preservedPublishedRoster = existing?.exists() ? existing.data()?.publishedRoster || [] : [];
    const preservedRosterPublished = existing?.exists() ? Boolean(existing.data()?.rosterPublished) : false;
    const preservedPublishedAt = existing?.exists() ? existing.data()?.publishedAt || null : null;

    await setDoc(
      sessionRef,
      {
        sessionId: sessionRef.id,
        date,
        weekday,
        title,
        timeLabel,
        description,
        reminder,
        signupRequired,
        rosterPublished: preservedRosterPublished,
        publishedRoster: preservedPublishedRoster,
        publishedAt: preservedPublishedAt,
        createdAt: preservedCreatedAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    clearAdminClassSessionFormMode();
    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(parseDateKey(date) || new Date());
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  } catch (error) {
    console.error("Save class session failed:", error);
    window.alert(`儲存社課失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
  }
}

function bindAdminClassCreationForms() {
  const sessionForm = getAdminClassSessionForm();
  if (sessionForm && sessionForm.dataset.initialized !== "true") {
    sessionForm.dataset.initialized = "true";
    sessionForm.addEventListener("submit", handleAdminClassSessionSubmit);

    const dateInput = sessionForm.querySelector("[name='date']");
    if (dateInput instanceof HTMLInputElement) {
      const syncWeekday = () => syncAdminClassSessionWeekdayPreview(sessionForm);
      dateInput.addEventListener("change", syncWeekday);
      dateInput.addEventListener("input", syncWeekday);
      syncWeekday();
    }
  }

  const resetButton = getAdminClassSessionResetButton();
  if (resetButton && resetButton.dataset.initialized !== "true") {
    resetButton.dataset.initialized = "true";
    resetButton.addEventListener("click", () => {
      clearAdminClassSessionFormMode();
    });
  }

  const announcementForm = document.querySelector("[data-announcement-form]");
  if (announcementForm && announcementForm.dataset.initialized !== "true") {
    announcementForm.dataset.initialized = "true";
    announcementForm.addEventListener("submit", handleAnnouncementFormSubmit);
  }

  bindAdminCreationForms();
}

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
  } catch (error) {
    console.error("Application submit failed:", error);
    setMessageTone(applicationHint, getFriendlyApplicationError(error), "error");
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

const initMembersAutoRefresh = () => {
  if (pageName !== "members") {
    return;
  }

  startMembersDashboardAutoRefresh();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !shouldAutoRefreshMembersDashboard()) {
      return;
    }

    void refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
  });
};

const shouldAutoRefreshPublicBoard = () => {
  if ((pageName !== "class-signup" && pageName !== "notices" && pageName !== "faq") || document.hidden || body.classList.contains("modal-open")) {
    return false;
  }

  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement.closest("[data-class-signup-form]") ||
      activeElement.closest("[data-announcement-board]") ||
      activeElement.closest("[data-faq-board]") ||
      activeElement.tagName === "SELECT" ||
      activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA")
  ) {
    return false;
  }

  return true;
};

const initPublicBoardAutoRefresh = () => {
  if (pageName !== "class-signup" && pageName !== "notices" && pageName !== "faq") {
    return;
  }

  if (publicPageAutoRefreshTimer) {
    return;
  }

  publicPageAutoRefreshTimer = window.setInterval(async () => {
    if (!shouldAutoRefreshPublicBoard()) {
      return;
    }

    if (pageName === "class-signup") {
      await refreshClassSignupPageSafe({ force: true });
      return;
    }

    if (pageName === "notices") {
      await refreshAnnouncementsPageSafe({ force: true });
      return;
    }

    if (pageName === "faq") {
      await refreshFaqPageSafe({ force: true });
    }
  }, PUBLIC_PAGE_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !shouldAutoRefreshPublicBoard()) {
      return;
    }

    if (pageName === "class-signup") {
      void refreshClassSignupPageSafe({ force: true });
    } else if (pageName === "notices") {
      void refreshAnnouncementsPageSafe({ force: true });
    } else if (pageName === "faq") {
      void refreshFaqPageSafe({ force: true });
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
  initMembersAutoRefresh();
  initPublicBoardAutoRefresh();
  setAuthMode("signin");
  updateLoginButtons();

  if (firebaseConfigured) {
    await ensureAuthReady();
  }

  if (pageName === "members") {
    await refreshMembersDashboardSafe();
  } else if (pageName === "class-signup") {
    await refreshClassSignupPageSafe();
  } else if (pageName === "notices") {
    await refreshAnnouncementsPageSafe();
  } else if (pageName === "faq") {
    await refreshFaqPageSafe();
  }
};

void init();
