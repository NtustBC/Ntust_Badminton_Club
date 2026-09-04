import { appCheckSiteKey, firebaseConfig } from "./firebase-config.js";
import { downloadCsv } from "./csv.js";
import { clearLoadingState, renderLoadingSkeleton, setButtonLoading, showToast } from "./ui.js";
import { applyPageLanguage } from "./i18n.js";

let initializeApp;
let initializeAppCheck;
let ReCaptchaEnterpriseProvider;
let browserLocalPersistence;
let createUserWithEmailAndPassword;
let deleteUser;
let EmailAuthProvider;
let getAuth;
let onAuthStateChanged;
let reauthenticateWithCredential;
let signInWithEmailAndPassword;
let signOut;
let collection;
let deleteDoc;
let doc;
let getDoc;
let getDocs;
let getFirestore;
let getFunctions;
let httpsCallable;
let query;
let runTransaction;
let serverTimestamp;
let setDoc;
let setPersistence;
let updateDoc;
let where;
let writeBatch;

let firebaseModulesPromise = null;

const ensureFirebaseModules = async () => {
  if (firebaseModulesPromise) {
    return firebaseModulesPromise;
  }

  firebaseModulesPromise = (async () => {
    try {
      const firebaseModules = await import("./firebase-modules.js");
      ({
        initializeApp,
        initializeAppCheck,
        ReCaptchaEnterpriseProvider,
        browserLocalPersistence,
        createUserWithEmailAndPassword,
        deleteUser,
        EmailAuthProvider,
        getAuth,
        onAuthStateChanged,
        reauthenticateWithCredential,
        signInWithEmailAndPassword,
        signOut,
        collection,
        deleteDoc,
        doc,
        getDoc,
        getDocs,
        getFirestore,
        getFunctions,
        httpsCallable,
        query,
        runTransaction,
        serverTimestamp,
        setDoc,
        setPersistence,
        updateDoc,
        where,
        writeBatch,
      } = firebaseModules);
      return firebaseModules;
    } catch (error) {
      firebaseModulesPromise = null;
      throw error;
    }
  })();

  return firebaseModulesPromise;
};

const body = document.body;
let pageName = body.dataset.page || "";
const menuButton = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageSelects = document.querySelectorAll("[data-language-select]");

const STORAGE_KEYS = {
  language: "ntust-badminton-language",
  customAcademicYears: "ntust-badminton-custom-academic-years",
  applicationCooldownPrefix: "ntust-badminton-application-cooldown",
  authSnapshot: "ntust-badminton-auth-snapshot",
};

const DEFAULT_TERMS = ["上學期", "下學期", "未設定"];
const MIN_ACADEMIC_YEAR = 115;
const APPLICATION_SUBMIT_COOLDOWN_MS = 10 * 60 * 1000;
const MEMBERS_DASHBOARD_REFRESH_MS = 60 * 1000;
const PUBLIC_PAGE_REFRESH_MS = 60 * 1000;
const NON_MEMBER_SIGNUP_DELAY_MS = 2 * 24 * 60 * 60 * 1000;
const CLASS_SESSION_COLLECTION = "classSessions";
const CLASS_SIGNUP_COLLECTION = "classSessionSignups";
const CLASS_PUBLIC_ROSTER_COLLECTION = "classPublicRosters";
const CLASS_SESSION_STATS_COLLECTION = "classSessionStats";
const CLASS_ANNOUNCEMENT_COLLECTION = "classAnnouncements";
const CLASS_ALBUM_COLLECTION = "classAlbums";
const ADMIN_NOTIFICATION_COLLECTION = "adminNotifications";
const MEMBER_NOTIFICATION_COLLECTION = "memberNotifications";
const FAQ_COLLECTION = "faqEntries";
const FAQ_QUESTION_COLLECTION = "faqQuestions";
const SITE_SETTINGS_COLLECTION = "siteSettings";
const CALENDAR_HOLIDAY_SEED_DOC = "calendarHolidayDefaults";
const DEFAULT_CALENDAR_COLOR = "blue";
const CALENDAR_COLOR_OPTIONS = ["blue", "green", "orange", "red", "purple", "teal", "pink", "gray"];
const CURRENT_TERM_SETTINGS_DOC = "currentTerm";
const CLUB_LOGO_URL = new URL("../assets/club-logo-cropped.png", import.meta.url).href;
const DEFAULT_MAINTENANCE_SETTINGS = {
  enabled: false,
  title: "網站維護中",
  message: "我們正在進行系統維護，請稍後再回來。",
  estimatedResumeAt: "",
};
// 行政院人事行政總處公告之三日以上連續假期。
const TAIWAN_LONG_HOLIDAYS = [
  { title: "除夕及春節連假", startDate: "2026-02-14", endDate: "2026-02-22" },
  { title: "和平紀念日連假", startDate: "2026-02-27", endDate: "2026-03-01" },
  { title: "兒童節及清明節連假", startDate: "2026-04-03", endDate: "2026-04-06" },
  { title: "勞動節連假", startDate: "2026-05-01", endDate: "2026-05-03" },
  { title: "端午節連假", startDate: "2026-06-19", endDate: "2026-06-21" },
  { title: "中秋節及教師節連假", startDate: "2026-09-25", endDate: "2026-09-28" },
  { title: "國慶日連假", startDate: "2026-10-09", endDate: "2026-10-11" },
  { title: "臺灣光復紀念日連假", startDate: "2026-10-24", endDate: "2026-10-26" },
  { title: "行憲紀念日連假", startDate: "2026-12-25", endDate: "2026-12-27" },
  { title: "開國紀念日連假", startDate: "2027-01-01", endDate: "2027-01-03" },
  { title: "除夕及春節連假", startDate: "2027-02-04", endDate: "2027-02-10" },
  { title: "和平紀念日連假", startDate: "2027-02-27", endDate: "2027-03-01" },
  { title: "兒童節及清明節連假", startDate: "2027-04-03", endDate: "2027-04-06" },
  { title: "勞動節連假", startDate: "2027-04-30", endDate: "2027-05-02" },
  { title: "國慶日連假", startDate: "2027-10-09", endDate: "2027-10-11" },
  { title: "臺灣光復紀念日連假", startDate: "2027-10-23", endDate: "2027-10-25" },
  { title: "行憲紀念日連假", startDate: "2027-12-24", endDate: "2027-12-26" },
  { title: "開國紀念日連假", startDate: "2027-12-31", endDate: "2028-01-02" },
];
const MEMBERSHIP_REGISTRATION_STATS_COLLECTION = "membershipRegistrationStats";
const CLASS_WEEKDAY_LABELS = {
  mon: "星期一",
  tue: "星期二",
  wed: "星期三",
  thu: "星期四",
  fri: "星期五",
  sat: "星期六",
  sun: "星期日",
};
const DATE_WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

if (firebaseConfigured) {
  void ensureFirebaseModules().catch((error) => console.warn("Firebase SDK warmup failed:", error));
}

let auth = null;
let db = null;
let functionsClient = null;
let currentUser = null;
let currentUserIsAdmin = false;
let currentMemberStatus = "non_member";
let currentMemberProfile = null;
let notificationIndicatorRequestId = 0;
let notificationRefreshTimer = null;
let notificationCenterVisibleIds = [];
let configuredAcademicYear = "";
let configuredAcademicTerm = "";
let configuredAcademicPeriodKey = "";
const DEFAULT_CASH_PAYMENT_OPTIONS = [
  { id: "office_lunch", label: "中午至社辦繳費" },
  { id: "class", label: "社課現場繳費" },
];
let membershipPaymentSettings = {
  bankName: "",
  bankCode: "",
  accountName: "",
  accountNumber: "",
  cashPaymentOptions: DEFAULT_CASH_PAYMENT_OPTIONS.map((option) => ({ ...option })),
};
let membershipRegistrationSettings = {
  openAt: "",
  closeAt: "",
  limit: 0,
  count: 0,
  registrationSequence: 0,
  waitlistSequence: 0,
};
let maintenanceSettings = { ...DEFAULT_MAINTENANCE_SETTINGS };
let maintenanceRefreshTimer = null;
let classScheduleDefaults = [];
let authMode = "signin";
let authReadyPromise = null;
let lastLoginTrigger = null;
let lastApplicationTrigger = null;
let lastClassSignupTrigger = null;
let membersAutoRefreshTimer = null;
let publicPageAutoRefreshTimer = null;
let membersDashboardCache = {
  members: [],
  admins: [],
  classSessions: [],
  classSessionSignups: [],
  classAlbums: [],
  announcements: [],
  faqs: [],
  faqQuestions: [],
  loadWarnings: [],
  loaded: false,
};
let membersDashboardLoadPromise = null;
let classSignupPageState = {
  loaded: false,
  sessions: [],
  ownSignups: [],
  sessionSignups: [],
  classAlbums: [],
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
let announcementCalendarMonthOffset = 0;
let adminClassSessionEditingId = "";
let lastAdminClassCalendarTrigger = null;
let adminAnnouncementListResizeBound = false;
let adminFaqListResizeBound = false;

const readAuthSnapshot = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.authSnapshot);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.signedIn !== "boolean") {
      return null;
    }

    return {
      signedIn: parsed.signedIn,
      isAdmin: Boolean(parsed.isAdmin),
      email: typeof parsed.email === "string" ? parsed.email : "",
      uid: typeof parsed.uid === "string" ? parsed.uid : "",
    };
  } catch (error) {
    return null;
  }
};

const writeAuthSnapshot = (user, isAdmin = false) => {
  try {
    if (!user) {
      window.localStorage.removeItem(STORAGE_KEYS.authSnapshot);
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.authSnapshot,
      JSON.stringify({
        signedIn: true,
        isAdmin: Boolean(isAdmin),
        email: String(user.email || ""),
        uid: String(user.uid || ""),
      }),
    );
  } catch (error) {
    // Ignore storage failures so auth UI still works normally.
  }
};

const primeAuthStateFromSnapshot = () => {
  const snapshot = readAuthSnapshot();
  if (!snapshot?.signedIn) {
    currentUser = null;
    currentUserIsAdmin = false;
    currentMemberStatus = "non_member";
    currentMemberProfile = null;
    return;
  }

  currentUser = {
    uid: snapshot.uid,
    email: snapshot.email,
  };
  currentUserIsAdmin = snapshot.isAdmin;
  currentMemberStatus = "non_member";
  currentMemberProfile = null;
};

const memberFilters = {
  year: "all",
  term: "all",
  category: "all",
  query: "",
};
const officerFilters = {
  year: "all",
  term: "all",
  query: "",
};
let memberFiltersInitializedFromSettings = false;

const authCopy = {
  signin: {
    title: "社員登入",
    subtitle: "登入後可以報名參加社團；社費一次繳清後會顯示為正式社員。",
    submitLabel: "登入",
    hint: "輸入已建立的帳號密碼即可登入。",
  },
  signup: {
    title: "註冊帳號",
    subtitle: "先註冊帳號，再決定本學期是否申請社員資格。",
    submitLabel: "註冊帳號",
    hint: "選擇申請社員時，請一併填寫社費方式；幹部確認社費後才會成為正式社員。",
  },
};

const signedInCopy = {
  title: "帳號資訊",
  subtitle: "你目前已登入，可以在這裡查看社員狀態與登出。",
  buttonLabel: "登出",
};

const membersPageCopy = {
  public: {
    title: "社員註冊名單",
    copy:
      "這裡會顯示透過 Firebase 註冊進來的社員帳號，方便你快速查看目前註冊數、信箱與最近登入時間。",
    sideTitle: "這裡看到的是註冊帳號，不是完整社員資料",
    sideCopy:
      "如果你之後想再追蹤姓名、系級、社費或報名紀錄，我們可以繼續在 Firestore 往下擴充欄位與管理介面。",
    overviewTitle: "註冊名單總覽",
    overviewCopy:
      "這一頁只會顯示透過 Firebase 帳號登入後的社員資料。若有設定管理員信箱，也會只讓指定信箱看到完整管理區。",
  },
  signedIn: {
    title: "已登入社員帳號",
    copy: "你目前登入的是一般社員帳號，若要查看管理頁，請切換成管理員帳號。",
    sideTitle: "這裡看的還是註冊帳號",
    sideCopy: "管理頁只會開放給指定管理員信箱；如果你需要權限，請用管理員帳號重新登入。",
    overviewTitle: "註冊名單總覽",
    overviewCopy: "這裡顯示的是透過 Firebase 註冊進來的社員帳號，不是完整社員資料。",
  },
  admin: {
    title: "社團管理頁",
    copy: "你目前已使用管理員帳號登入，可以直接查看社員資料、註冊名單與各種管理區塊。",
    sideTitle: "這裡是管理頁，不只是註冊名單",
    sideCopy: "你可以在下方直接管理社員資料、審核報名、安排社課與發布公告或 FAQ，所有內容都會同步到 Firestore。",
    overviewTitle: "管理總覽",
    overviewCopy: "登入管理員後會顯示完整管理內容，包括社員、報名、社課、公告與 FAQ。",
  },
};

const authErrorMessages = {
  "auth/email-already-in-use": "這個信箱已存在於登入系統，即使後台社員名單沒有顯示也無法重複註冊。請直接登入；若不記得密碼，請使用「忘記密碼」。",
  "auth/invalid-credential": "信箱或密碼不正確，請再確認一次。",
  "auth/invalid-email": "請輸入有效的電子郵件信箱。",
  "auth/missing-password": "請輸入密碼。",
  "auth/network-request-failed": "目前無法連上 Firebase，請稍後再試。",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
  "auth/user-disabled": "這個帳號已停用，請聯絡管理員。",
  "auth/user-not-found": "查不到這個帳號，請先註冊帳號。",
  "permission-denied": "Firebase 權限不足，請確認 Firestore Rules 是否已更新。",
  unavailable: "Firebase 目前無法連線，請稍後再試。",
  "deadline-exceeded": "Firebase 回應逾時，請稍後再試。",
  "auth/weak-password": "密碼至少需要 8 個字元。",
};

const applicationErrorMessages = {
  "permission-denied": "這個 Email 已經有申請資料了，請直接修改原申請或聯絡管理員。",
  "unavailable": "Firebase 目前暫時無法連線，請稍後再試一次。",
  "deadline-exceeded": "送出逾時，請檢查網路後再試一次。",
  "failed-precondition": "目前資料尚未準備好，請重新整理頁面後再試一次。",
  "functions/resource-exhausted": "本學期社員名額已滿。",
  "functions/deadline-exceeded": "本學期社員申請已截止。",
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
            註冊帳號
          </button>
        </div>

          <div class="auth-status-card" data-auth-status hidden>
          <p class="auth-status-label">社員狀態</p>
          <p class="auth-status-email" data-auth-email></p>
          <p class="login-note" data-auth-status-hint></p>
          <div class="account-membership-summary" data-account-membership-summary></div>
          <button class="button-secondary" data-edit-account-membership type="button">查看／修改本學期申請</button>
          <button class="button-secondary" data-edit-personal-profile type="button">編輯個人資料與通知設定</button>
        </div>

        <form class="form-grid account-membership-form" data-personal-profile-form hidden>
          <div class="account-settings-overview">
            <span class="account-popover-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg></span>
            <span><strong data-account-settings-name>帳號資料</strong><small data-account-settings-email></small></span>
          </div>
          <section class="account-settings-section">
            <div><p class="section-kicker">基本資料</p><p class="login-note">這些資料會用於社員資格及社課報名核對。</p></div>
            <div class="class-signup-profile">
              <div class="form-field"><label for="profile-display-name">顯示名稱</label><input id="profile-display-name" name="displayName" maxlength="60" type="text" placeholder="顯示在帳號選單中的名稱" /></div>
              <div class="form-field"><label for="profile-name">姓名</label><input id="profile-name" name="name" type="text" autocomplete="name" required /></div>
              <div class="form-field"><label for="profile-student-id">學號</label><input id="profile-student-id" name="studentId" type="text" required /></div>
              <div class="form-field"><label for="profile-school">學校</label><select id="profile-school" name="school" required><option value="">請先選擇學校</option><option value="臺科大">臺科大</option><option value="外校">外校</option></select></div>
              <div class="form-field"><label for="profile-department">系別</label><input id="profile-department" name="department" list="department-options" type="text" placeholder="請選擇或輸入系別" required /></div>
              <div class="form-field"><label for="profile-phone">聯絡電話</label><input id="profile-phone" name="phone" type="tel" autocomplete="tel" required /></div>
            </div>
          </section>
          <section class="account-settings-section">
            <div><p class="section-kicker">通知偏好</p><p class="login-note">選擇要在網站右上角收到的內容。</p></div>
            <div class="notification-preference-grid">
              <label><input name="notificationAnnouncements" type="checkbox" /> 社團公告</label>
              <label><input name="notificationClassReminders" type="checkbox" /> 社課提醒與異動</label>
              <label><input name="notificationRegistrationUpdates" type="checkbox" /> 報名與候補狀態</label>
            </div>
          </section>
          <p class="login-note" data-personal-profile-hint></p>
          <div class="account-membership-actions">
            <button class="button-primary" type="submit">儲存個人設定</button>
            <button class="button-secondary" data-open-membership-settings type="button">社員申請設定</button>
            <button class="button-secondary" data-personal-profile-cancel type="button">取消</button>
          </div>
          <section class="account-danger-zone">
            <div><strong>刪除帳號</strong><p>將永久刪除登入帳號、個人資料、入社申請及社課報名紀錄，且無法復原。</p></div>
            <button class="member-delete-button" data-delete-own-account type="button">永久刪除帳號</button>
          </section>
        </form>

        <form class="form-grid" data-login-form id="login-form" novalidate>
          <section class="auth-signup-section auth-credential-section">
            <div><p class="section-kicker">登入資訊</p><p class="login-note">使用常用電子郵件並設定至少 8 個字元的密碼。</p></div>
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
          <div class="auth-forgot-row" data-password-reset-trigger>
            <button class="auth-forgot-button" data-open-password-reset type="button">忘記密碼？</button>
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
          </section>
          <div class="auth-signup-profile" data-auth-signup-profile hidden>
            <section class="auth-signup-section">
              <div><p class="section-kicker">基本資料</p><p class="login-note">請填寫可供社員資格與報名核對的資料。</p></div>
              <div class="class-signup-profile">
                <div class="form-field"><label for="signup-name">姓名</label><input id="signup-name" name="name" placeholder="王小明" type="text" autocomplete="name" /></div>
                <div class="form-field"><label for="signup-student-id">學號</label><input id="signup-student-id" name="studentId" placeholder="B11303044" type="text" /></div>
                <div class="form-field"><label for="signup-school">學校</label><select id="signup-school" name="school"><option value="">請先選擇學校</option><option value="臺科大">臺科大</option><option value="外校">外校</option></select></div>
                <div class="form-field" data-signup-external-school-field hidden><label for="signup-external-school">學校名稱</label><input id="signup-external-school" name="externalSchoolName" maxlength="100" placeholder="請輸入學校名稱" type="text" autocomplete="organization" /></div>
                <div class="form-field"><label for="signup-department">系別</label><input id="signup-department" name="department" list="department-options" placeholder="選擇學校後選擇或輸入系別" type="text" /></div>
                <div class="form-field"><label for="signup-phone">聯絡電話</label><input id="signup-phone" name="phone" placeholder="09xx-xxx-xxx" type="tel" autocomplete="tel" /></div>
              </div>
              <datalist id="department-options">
                <option value="資訊工程系"></option><option value="電機工程系"></option><option value="電子工程系"></option>
                <option value="機械工程系"></option><option value="化學工程系"></option><option value="材料科學與工程系"></option>
                <option value="營建工程系"></option><option value="工業管理系"></option><option value="企業管理系"></option>
                <option value="資訊管理系"></option><option value="設計系"></option><option value="應用外語系"></option>
                <option value="其他系別"></option>
              </datalist>
            </section>
            <section class="auth-signup-section">
              <div><p class="section-kicker">社員資格</p><p class="login-note">選擇本學期是否申請社員，之後仍可在帳號設定中修改。</p></div>
              <p class="login-note" data-membership-registration-status></p>
            <fieldset class="membership-choice-fieldset">
              <legend>本學期是否申請成為社員？</legend>
              <p class="login-note">註冊帳號不等於取得社員資格，只有選擇申請並經幹部確認社費後才會成為社員。</p>
              <div class="membership-choice-grid">
                <label class="membership-choice-option">
                  <input name="membershipIntent" type="radio" value="join" />
                  <span><strong>是，我要申請社員</strong><small>社費確認後，參加社課不必每次繳零打費，並享有社員優先報名時段，較有機會保留名額。</small></span>
                </label>
                <label class="membership-choice-option">
                  <input name="membershipIntent" type="radio" value="not_join" checked />
                  <span><strong>否，只註冊帳號（非社員）</strong><small>需等社員優先報名期結束，仍有名額才能報名；每次到場需另外繳交單次零打費。</small></span>
                </label>
              </div>
            </fieldset>
            <div class="membership-payment-fields" data-membership-payment-fields hidden>
              <fieldset class="membership-choice-fieldset">
                <legend>選擇社費方式</legend>
                <div class="membership-choice-grid">
                  <label class="membership-choice-option">
                    <input name="paymentMethod" type="radio" value="cash" />
                    <span><strong>現金</strong><small>依現金繳費選項辦理</small></span>
                  </label>
                  <label class="membership-choice-option">
                    <input name="paymentMethod" type="radio" value="transfer" />
                    <span><strong>轉帳</strong><small>轉帳後提供核對資料</small></span>
                  </label>
                </div>
              </fieldset>
              <div class="membership-payment-panel" data-cash-payment-panel hidden>
                <div class="form-field">
                  <label for="signup-cash-slot">預計現金繳費方式</label>
                  <select id="signup-cash-slot" name="cashPaymentSlot" data-cash-payment-options-select>
                    <option value="">請選擇</option>
                  </select>
                </div>
              </div>
              <div class="membership-payment-panel" data-transfer-payment-panel hidden>
                <div class="transfer-account-card" data-transfer-account-card></div>
                <div class="class-signup-profile">
                  <div class="form-field">
                    <label for="signup-transfer-at">轉帳日期與時間</label>
                    <input id="signup-transfer-at" name="transferAt" step="60" type="datetime-local" />
                  </div>
                  <div class="form-field">
                    <label for="signup-transfer-last-five">轉出帳號末五碼</label>
                    <input id="signup-transfer-last-five" name="transferLastFive" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="12345" type="text" />
                  </div>
                </div>
                <p class="membership-payment-reminder">轉帳後請務必確認交易成功，並自行保留成功畫面的截圖，直到幹部完成核對。</p>
              </div>
            </div>
            <label class="privacy-consent-option">
              <input name="privacyConsent" type="checkbox" />
              <span>我已閱讀並同意<a href="./privacy.html" target="_blank" rel="noreferrer">隱私權政策與個人資料蒐集聲明</a>，並同意社團基於帳號、社員資格、活動報名及通知目的使用上述資料。</span>
            </label>
            </section>
          </div>
          <p class="login-note" data-login-hint>${authCopy.signin.hint}</p>
        </form>

        <form class="form-grid account-membership-form" data-account-membership-form hidden>
          <div class="section-kicker">本學期社員申請</div>
          <p class="login-note" data-membership-registration-status></p>
          <fieldset class="membership-choice-fieldset">
            <legend>本學期是否申請成為社員？</legend>
            <div class="membership-choice-grid">
              <label class="membership-choice-option"><input name="membershipIntent" type="radio" value="join" /><span><strong>申請社員資格</strong><small>完成社費繳納後，參加社課不必每次繳零打費，並享有社員優先報名時段。</small></span></label>
              <label class="membership-choice-option"><input name="membershipIntent" type="radio" value="not_join" /><span><strong>維持非社員</strong><small>社員優先報名後仍有名額才能參加，且每次到場需另繳單次零打費。</small></span></label>
            </div>
          </fieldset>
          <div class="membership-payment-fields" data-membership-payment-fields hidden>
            <fieldset class="membership-choice-fieldset">
              <legend>社費方式</legend>
              <div class="membership-choice-grid">
                <label class="membership-choice-option"><input name="paymentMethod" type="radio" value="cash" /><span><strong>現金</strong></span></label>
                <label class="membership-choice-option"><input name="paymentMethod" type="radio" value="transfer" /><span><strong>轉帳</strong></span></label>
              </div>
            </fieldset>
            <div class="membership-payment-panel" data-cash-payment-panel hidden>
              <div class="form-field"><label>預計現金繳費方式</label><select name="cashPaymentSlot" data-cash-payment-options-select><option value="">請選擇</option></select></div>
            </div>
            <div class="membership-payment-panel" data-transfer-payment-panel hidden>
              <div class="transfer-account-card" data-transfer-account-card></div>
              <div class="class-signup-profile">
                <div class="form-field"><label>轉帳日期與時間</label><input name="transferAt" step="60" type="datetime-local" /></div>
                <div class="form-field"><label>轉出帳號末五碼</label><input name="transferLastFive" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="12345" type="text" /></div>
              </div>
              <p class="membership-payment-reminder">請確認轉帳成功並自行保留截圖，直到幹部完成核對。</p>
            </div>
          </div>
          <p class="login-note" data-account-membership-hint></p>
          <div class="account-membership-actions">
            <button class="button-primary" data-account-membership-save type="submit">儲存申請資料</button>
            <button class="button-secondary" data-account-membership-cancel type="button">取消</button>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-auth-submit form="login-form" type="submit">登入</button>
      </div>
    </div>
  </div>
`;

const passwordResetModalMarkup = `
  <div class="modal" data-password-reset-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">忘記密碼</h2>
          <p class="modal-subtitle">目前暫不提供系統寄信與自動密碼重設。</p>
        </div>
        <button class="modal-close" data-close-password-reset type="button" aria-label="關閉忘記密碼視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <form class="form-grid" data-password-reset-form novalidate>
        <div class="modal-body form-grid">
          <p class="login-note" data-password-reset-hint>如需重設密碼，請聯絡社團幹部核對身分後協助處理。</p>
        </div>
        <div class="modal-footer">
          <button class="login-button modal-submit" data-close-password-reset type="button">知道了</button>
        </div>
      </form>
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
          <p class="modal-subtitle" data-application-subtitle>填完資料後送出，完成一次性社費繳納並經幹部確認後，才會取得正式社員資格。</p>
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
            <label for="application-school">學校</label>
            <select id="application-school" name="school"><option value="">請先選擇學校</option><option value="臺科大">臺科大</option><option value="外校">外校</option></select>
          </div>
          <div class="form-field">
            <label for="application-department">系別</label>
            <input id="application-department" name="department" list="department-options" placeholder="選擇或輸入系別" type="text" />
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

const actionSuccessModalMarkup = `
  <div class="modal" data-action-success-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog success-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" data-action-success-title>儲存完畢</h2>
          <p class="modal-subtitle" data-action-success-copy>內容已更新。</p>
        </div>
        <button class="modal-close" data-close-action-success type="button" aria-label="關閉完成視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-confirm-action-success type="button">確認</button>
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
        <form class="form-grid admin-calendar-event-form" data-admin-calendar-event-form hidden>
          <input name="eventId" type="hidden" value="" />
          <p class="admin-calendar-form-state" data-admin-calendar-form-state>這一天還沒有內容，直接填寫下方欄位即可新增。</p>
          <section class="admin-calendar-form-section">
            <div class="admin-calendar-section-heading">
              <span>01</span>
              <div><strong>內容資訊</strong><small>選擇類型並填寫顯示名稱</small></div>
            </div>
            <div class="admin-calendar-primary-grid">
              <div class="form-field">
                <label for="admin-calendar-event-type">類型</label>
                <select id="admin-calendar-event-type" name="eventType">
                  <option value="class">社課</option>
                  <option value="announcement">公告</option>
                  <option value="holiday">連續假期</option>
                </select>
              </div>
              <div class="form-field">
                <label for="admin-calendar-event-title-zh">中文標題</label>
                <input id="admin-calendar-event-title-zh" maxlength="100" name="titleZh" type="text" placeholder="例如：雙打練習／場地異動" required />
              </div>
              <div class="form-field">
                <label for="admin-calendar-event-color">顯示顏色</label>
                <select id="admin-calendar-event-color" name="color">
                  <option value="blue">藍色</option>
                  <option value="green">綠色</option>
                  <option value="orange">橘色</option>
                  <option value="red">紅色</option>
                  <option value="purple">紫色</option>
                  <option value="teal">青色</option>
                  <option value="pink">粉紅色</option>
                  <option value="gray">灰色</option>
                </select>
              </div>
              <div class="form-field">
                <label for="admin-calendar-event-title-en">英文標題</label>
                <input id="admin-calendar-event-title-en" maxlength="100" name="titleEn" type="text" placeholder="e.g. Doubles Practice / Venue Change" required />
              </div>
            </div>
          </section>
          <section class="admin-calendar-form-section">
            <div class="admin-calendar-section-heading">
              <span>02</span>
              <div><strong>日期與時間</strong><small>設定活動時段與進行地點</small></div>
            </div>
            <div class="admin-calendar-date-time-grid">
              <div class="form-field">
                <label for="admin-calendar-event-date">開始日期</label>
                <input id="admin-calendar-event-date" name="date" type="date" required />
              </div>
              <div class="form-field" data-announcement-end-date-field hidden>
                <label for="admin-calendar-event-end-date">結束日期</label>
                <input id="admin-calendar-event-end-date" name="endDate" type="date" />
              </div>
              <div class="form-field">
                <label for="admin-calendar-event-start-time">開始時間（選填）</label>
                <input id="admin-calendar-event-start-time" name="startTime" step="300" type="time" />
              </div>
              <div class="form-field">
                <label for="admin-calendar-event-end-time">結束時間（選填）</label>
                <input id="admin-calendar-event-end-time" name="endTime" step="300" type="time" />
              </div>
            </div>
            <div class="admin-calendar-default-shortcuts" data-admin-calendar-default-shortcuts hidden></div>
            <div class="form-field">
              <label for="admin-calendar-event-location">地點（選填）</label>
              <input id="admin-calendar-event-location" name="location" type="text" placeholder="例如：臺科大體育館 2F" />
            </div>
          </section>
          <section class="admin-calendar-form-section">
            <div class="admin-calendar-section-heading">
              <span>03</span>
              <div><strong>補充說明</strong><small>填寫參加者需要知道的資訊</small></div>
            </div>
            <div class="form-field">
              <label for="admin-calendar-event-note">備註</label>
              <textarea id="admin-calendar-event-note" name="note" rows="4" placeholder="例如：請自備球拍與飲用水；沒有補充可留空"></textarea>
            </div>
            <div class="form-field" data-class-album-field>
              <label for="admin-calendar-album-url">課後照片雲端相簿（選填）</label>
              <input id="admin-calendar-album-url" name="albumUrl" type="url" placeholder="https://drive.google.com/..." />
              <small>連結只會顯示給已登入的註冊帳號；Google Drive 端仍請只共用給社員 Gmail。</small>
            </div>
          </section>
          <section class="admin-calendar-form-section admin-calendar-signup-panel" data-admin-calendar-signup-panel>
            <div class="admin-calendar-section-heading">
              <span>04</span>
              <div><strong>報名設定</strong><small>設定資格、開放時間與名額</small></div>
            </div>
            <div class="admin-calendar-signup-options">
              <label class="admin-calendar-signup-toggle is-primary">
                <input name="signupRequired" type="checkbox" checked />
                <span><strong>社課需要報名</strong><small>開啟後，社員需先完成線上報名</small></span>
              </label>
              <div class="admin-calendar-signup-toggle">
                <span><strong>分階段開放報名</strong><small>先開放社員，再於第二階段讓社員與非社員一起報名</small></span>
              </div>
            </div>
            <div class="admin-calendar-signup-settings" data-admin-calendar-signup-settings>
              <div class="admin-calendar-signup-time-grid">
                <div class="form-field">
                  <label for="admin-calendar-member-signup-open">① 社員報名開始</label>
                  <input id="admin-calendar-member-signup-open" name="memberSignupOpenAt" type="datetime-local" />
                </div>
                <div class="form-field">
                  <label for="admin-calendar-public-signup-open">② 社員與非社員皆可報名</label>
                  <input id="admin-calendar-public-signup-open" name="publicSignupOpenAt" type="datetime-local" />
                </div>
                <div class="form-field">
                  <label for="admin-calendar-signup-close">③ 報名截止</label>
                  <input id="admin-calendar-signup-close" name="signupCloseAt" type="datetime-local" />
                </div>
              </div>
              <div class="form-field admin-calendar-limit-field">
                <label for="admin-calendar-signup-limit">人數上限</label>
                <input id="admin-calendar-signup-limit" name="signupLimit" min="1" placeholder="不填則不限" type="number" />
              </div>
            </div>
          </section>
          <div class="admin-calendar-form-actions">
            <button class="button-primary" data-admin-calendar-save type="submit">儲存</button>
            <button class="button-secondary" data-admin-calendar-delete type="button">刪除</button>
          </div>
        </form>
      </div>
    </div>
  </div>
`;

const publicCalendarDetailModalMarkup = `
  <div class="modal" data-public-calendar-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog admin-calendar-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" data-public-calendar-title>行事曆內容</h2>
          <p class="modal-subtitle" data-public-calendar-subtitle></p>
        </div>
        <button class="modal-close" data-close-public-calendar type="button" aria-label="關閉內容視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="admin-calendar-modal-list" data-public-calendar-list></div>
      </div>
    </div>
  </div>
`;

const classSignupDetailModalMarkup = `
  <div class="modal" data-class-signup-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog admin-calendar-modal-dialog class-signup-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" data-class-signup-modal-title>社課報名</h2>
          <p class="modal-subtitle" data-class-signup-modal-subtitle></p>
        </div>
        <button class="modal-close" data-close-class-signup-modal type="button" aria-label="關閉社課報名視窗">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body class-signup-modal-body" data-class-signup-modal-body></div>
    </div>
  </div>
`;

const notificationModalMarkup = `
  <div class="modal" data-notification-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog notification-modal-dialog">
      <div class="modal-header">
        <div><h2 class="modal-title">通知中心</h2><p class="modal-subtitle">依照你在個人資料中選擇的通知類型顯示。</p></div>
        <button class="modal-close" data-close-notifications type="button" aria-label="關閉通知中心"><span aria-hidden="true">+</span></button>
      </div>
      <div class="modal-body">
        <div class="notification-toolbar" data-notification-toolbar hidden>
          <label class="notification-select-all"><input data-notification-select-all type="checkbox" /> <span>全選</span></label>
          <span class="notification-selection-count" data-notification-selection-count>未選擇通知</span>
          <div class="notification-toolbar-actions">
            <button data-mark-all-notifications-read type="button">全部標為已讀</button>
            <button class="is-danger" data-delete-selected-notifications type="button" disabled>刪除已選通知</button>
          </div>
        </div>
        <div class="notification-list" data-notification-list></div>
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

const escapeSpreadsheetXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const padNumber = (value) => String(value).padStart(2, "0");
const formatExportTimestamp = (date = new Date()) =>
  `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}-${padNumber(date.getHours())}${padNumber(date.getMinutes())}`;

const syncGlobalNavigationLabels = () => {
  document.querySelectorAll('a[href="./club-signup.html"]').forEach((link) => {
    if (link.closest(".site-nav") || link.closest(".mobile-nav")) {
      link.textContent = "加入我們";
    }
  });

  document.querySelectorAll('a[href="./faq.html"]').forEach((link) => {
    if (link.closest(".site-nav") || link.closest(".mobile-nav")) {
      link.textContent = "常見QA";
    }
  });

  document.querySelectorAll('a[href="./notices.html"]').forEach((link) => {
    if (link.closest(".site-nav") || link.closest(".mobile-nav")) {
      link.textContent = "訊息公告";
    }
  });
};

const getLoginButtons = () => document.querySelectorAll("[data-open-login]");
const getSignupButtons = () => document.querySelectorAll("[data-open-signup]");
const getApplicationButtons = () => document.querySelectorAll("[data-open-application]");
const getApprovalDocId = (email) => email.trim().toLowerCase();
const getApplicationDocId = (userId, applicationType = "club") =>
  `${applicationType.trim().toLowerCase()}-${String(userId || "").trim()}`;
const getApplicationCooldownKey = (email, applicationType = "club") =>
  `${STORAGE_KEYS.applicationCooldownPrefix}:${applicationType.trim().toLowerCase()}-${encodeURIComponent(email.trim().toLowerCase())}`;
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
const formatDateTimeLocalValue = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 16);
  }

  if (value instanceof Date || typeof value?.toDate === "function") {
    const date = value instanceof Date ? value : value.toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  return "";
};

const getDateTimeLocalMs = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const ms = new Date(String(value)).getTime();
  return Number.isNaN(ms) ? null : ms;
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
const formatNotificationDate = (value) => {
  const directDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : null;
  const timestampMs = directDate ? directDate.getTime() : getTimestampMs(value);
  if (!Number.isFinite(timestampMs)) return "";
  return new Date(timestampMs).toLocaleDateString("zh-TW", { month: "long", day: "numeric" });
};
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
const getClassAlbumDocRef = (sessionId) => doc(db, CLASS_ALBUM_COLLECTION, sessionId);
const getClassAnnouncementDocRef = (announcementId) => doc(db, CLASS_ANNOUNCEMENT_COLLECTION, announcementId);
const getFaqDocRef = (faqId) => doc(db, FAQ_COLLECTION, faqId);
const getFaqQuestionDocRef = (questionId) => doc(db, FAQ_QUESTION_COLLECTION, questionId);
const getSiteSettingsDocRef = (settingId) => doc(db, SITE_SETTINGS_COLLECTION, settingId);

const normalizeCalendarColor = (value) => {
  const color = String(value || "").trim().toLowerCase();
  return CALENDAR_COLOR_OPTIONS.includes(color) ? color : DEFAULT_CALENDAR_COLOR;
};

const ensureDefaultCalendarHolidaysSeeded = async () => {
  if (!db || !currentUserIsAdmin) return;
  const seedRef = getSiteSettingsDocRef(CALENDAR_HOLIDAY_SEED_DOC);
  const seedSnapshot = await getDoc(seedRef);
  if (seedSnapshot.exists() && Number(seedSnapshot.data()?.version || 0) >= 1) return;
  const batch = writeBatch(db);
  TAIWAN_LONG_HOLIDAYS.forEach((holiday) => {
    const holidayRef = getClassAnnouncementDocRef(`holiday-${holiday.startDate}`);
    batch.set(holidayRef, {
      date: holiday.startDate,
      endDate: holiday.endDate,
      title: holiday.title,
      eventType: "holiday",
      calendarEventType: "holiday",
      color: "orange",
      reminder: "連續假期",
      body: "連續假期",
      isDefaultHoliday: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  batch.set(seedRef, { version: 1, seededAt: serverTimestamp(), updatedBy: currentUser?.uid || "" }, { merge: true });
  await batch.commit();
};

const isMaintenanceBlocking = () => maintenanceSettings.enabled && !currentUserIsAdmin;

const formatMaintenanceResumeTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const ensureMaintenanceScreen = () => {
  let screen = document.querySelector("[data-maintenance-screen]");
  if (screen) {
    return screen;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `<main class="maintenance-screen" data-maintenance-screen hidden>
      <section class="maintenance-card" role="status" aria-live="polite">
        <div class="maintenance-mark" aria-hidden="true">
          <img src="${escapeHtml(CLUB_LOGO_URL)}" alt="" />
        </div>
        <p class="section-kicker">NTUST BADMINTON CLUB</p>
        <h1 data-maintenance-title>網站維護中</h1>
        <p class="maintenance-message" data-maintenance-message></p>
        <p class="maintenance-resume" data-maintenance-resume hidden></p>
        <button class="button-secondary" data-maintenance-login type="button">管理員登入</button>
      </section>
    </main>`,
  );
  screen = document.querySelector("[data-maintenance-screen]");
  screen.querySelector("[data-maintenance-login]")?.addEventListener("click", (event) => openLoginModal(event.currentTarget));
  return screen;
};

const applyMaintenanceView = () => {
  const screen = ensureMaintenanceScreen();
  const blocking = isMaintenanceBlocking();
  body.classList.toggle("maintenance-active", blocking);
  screen.hidden = !blocking;

  if (!blocking) {
    return;
  }

  screen.querySelector("[data-maintenance-title]").textContent = maintenanceSettings.title || DEFAULT_MAINTENANCE_SETTINGS.title;
  screen.querySelector("[data-maintenance-message]").textContent = maintenanceSettings.message || DEFAULT_MAINTENANCE_SETTINGS.message;
  const resume = screen.querySelector("[data-maintenance-resume]");
  const resumeLabel = formatMaintenanceResumeTime(maintenanceSettings.estimatedResumeAt);
  resume.hidden = !resumeLabel;
  resume.textContent = resumeLabel ? `預計恢復時間：${resumeLabel}` : "";
};
const getClassSessionSortMs = (session = {}) => getDateKeyMs(session.date || session.sessionDate);
const getClassSessionStartMs = (session = {}) => {
  const date = String(session.date || session.sessionDate || "").trim();
  const startTime = String(session.startTime || getLegacyTimeParts(session.timeLabel || session.time).startTime || "").trim();
  return date && startTime ? getDateTimeLocalMs(`${date}T${startTime}`) : getClassSessionSortMs(session);
};
const getAnnouncementSortMs = (announcement) => getTimestampMs(announcement.createdAt || announcement.updatedAt || announcement.date);
const getFaqSortMs = (faq) => getTimestampMs(faq.createdAt || faq.updatedAt || faq.date);
const getWeekdayKeyFromDateValue = (value) => {
  const date = parseDateKey(value);
  if (!date) {
    return "";
  }

  return DATE_WEEKDAY_ORDER[date.getDay()] || "";
};
const getWeekdayLabel = (weekday) => CLASS_WEEKDAY_LABELS[String(weekday || "").trim().toLowerCase()] || String(weekday || "");
const getLocalizedContentTitle = (entry = {}, fallback = "未命名內容") => {
  const legacyTitle = String(entry.title || "").trim();
  const chineseTitle = String(entry.titleZh || legacyTitle).trim();
  const englishTitle = String(entry.titleEn || "").trim();
  return body.dataset.language === "en"
    ? englishTitle || chineseTitle || fallback
    : chineseTitle || legacyTitle || fallback;
};

const HOME_CLASS_SCHEDULE_FALLBACK = [
  { weekday: "wed", startTime: "15:30", endTime: "18:20" },
  { weekday: "sun", startTime: "13:00", endTime: "16:00" },
];

const renderHomeClassSchedule = () => {
  const target = document.querySelector("[data-home-class-schedule]");
  if (!target) return;

  const source = classScheduleDefaults.length ? classScheduleDefaults : HOME_CLASS_SCHEDULE_FALLBACK;
  const schedules = source
    .filter((item) => item?.weekday && item?.startTime && item?.endTime);
  if (!schedules.length) return;

  const isEnglish = body.dataset.language === "en";
  const englishWeekdays = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
  };
  const labels = schedules.map((item) => {
    const weekday = isEnglish ? englishWeekdays[item.weekday] || item.weekday : getWeekdayLabel(item.weekday).replace(/^星期/, "");
    return isEnglish
      ? `Every ${weekday} ${item.startTime}–${item.endTime}`
      : `每週${weekday} ${item.startTime}–${item.endTime}`;
  });

  target.textContent = labels.join(isEnglish ? "; " : "、");
};
const getClassSessionDateLabel = (session) => {
  const dateLabel = formatDateKey(session.date || session.sessionDate || "", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekdayLabel = getWeekdayLabel(session.weekday);
  return [dateLabel, weekdayLabel].filter(Boolean).join(" / ");
};
const buildEventTimeLabel = (startTime, endTime, legacyLabel = "") => {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  return start && end ? `${start} - ${end}` : String(legacyLabel || "").trim();
};
const getLegacyTimeParts = (value = "") => {
  const matches = String(value).match(/(\d{1,2}:\d{2})\s*(?:-|–|~|至)\s*(\d{1,2}:\d{2})/);
  return matches ? { startTime: matches[1].padStart(5, "0"), endTime: matches[2].padStart(5, "0") } : { startTime: "", endTime: "" };
};
const getClassSessionTimeLabel = (session) => buildEventTimeLabel(session.startTime, session.endTime, session.timeLabel || session.time);
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
    if (pageName === "members") {
      link.setAttribute("aria-current", "page");
    }
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

  prefetchSpaPage("./members.html");
};

const updateLoginButtons = () => {
  rememberLoginButtonLabels();
  updateAdminNavigation();
  syncMembersPageHero();

  getLoginButtons().forEach((button) => {
    button.textContent = button.dataset.defaultLabel;
    button.hidden = Boolean(currentUser);
  });
  document.querySelectorAll("[data-notification-bell]").forEach((button) => { button.hidden = !currentUser; });
  document.querySelectorAll("[data-account-menu-root]").forEach((root) => {
    root.hidden = !currentUser;
    root.dataset.accountRole = getCurrentMembershipStatus();
    const name = currentMemberProfile?.displayName || currentMemberProfile?.name || getMembershipStatusCopy(getCurrentMembershipStatus()).label;
    root.querySelector("[data-account-menu-name]").textContent = name;
    root.querySelector("[data-account-menu-status]").textContent = getMembershipStatusCopy(getCurrentMembershipStatus()).label;
  });
  void syncNotificationIndicator();
};

const installHeaderAccountControls = () => {
  document.querySelectorAll(".header-actions").forEach((actions) => {
    const login = actions.querySelector(".header-login");
    if (!login) return;
    if (!actions.querySelector("[data-notification-bell]")) {
      const button = document.createElement("button");
      button.className = "notification-bell";
      button.type = "button";
      button.hidden = !currentUser;
      button.dataset.notificationBell = "true";
      button.setAttribute("aria-label", "開啟通知中心");
      button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span class="notification-dot" aria-hidden="true" hidden></span>`;
      actions.insertBefore(button, login);
    }
    if (!actions.querySelector("[data-account-menu-root]")) {
      const root = document.createElement("div");
      root.className = "account-menu-root";
      root.hidden = !currentUser;
      root.dataset.accountMenuRoot = "true";
      root.innerHTML = `
        <button class="account-user-button" data-account-menu-toggle type="button" aria-label="開啟帳號選單" aria-expanded="false">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>
        </button>
        <div class="account-popover" data-account-popover hidden>
          <div class="account-popover-profile">
            <span class="account-popover-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg></span>
            <span><strong data-account-menu-name>會員</strong><small data-account-menu-status>社員</small></span>
          </div>
          <div class="account-popover-divider"></div>
          <button data-account-settings type="button"><span aria-hidden="true">⚙</span>帳號設定</button>
          <button data-account-signout type="button"><span aria-hidden="true">↪</span>登出</button>
        </div>`;
      actions.insertBefore(root, login);
    }
  });
};

const closeAccountMenus = (except = null) => {
  document.querySelectorAll("[data-account-menu-root]").forEach((root) => {
    if (root === except) return;
    root.querySelector("[data-account-popover]").hidden = true;
    root.querySelector("[data-account-menu-toggle]").setAttribute("aria-expanded", "false");
  });
};

const openAccountSettings = async (trigger = null) => {
  const { loginModal, loginForm, statusCard, accountMembershipForm, personalProfileForm, authSubmit, authSwitch } = getLoginModalElements();
  lastLoginTrigger = trigger || null;
  closeMobileNav();
  if (firebaseConfigured) {
    await ensureAuthReady();
    if (auth?.currentUser) {
      currentUser = auth.currentUser;
      await Promise.all([loadAdminStatus(currentUser), loadCurrentMemberStatus(currentUser)]);
      writeAuthSnapshot(currentUser, currentUserIsAdmin);
    }
  }
  if (!currentUser) {
    await openLoginModal(trigger);
    return;
  }
  loginForm.hidden = true;
  statusCard.hidden = true;
  accountMembershipForm.hidden = true;
  authSwitch.hidden = true;
  populatePersonalProfileForm(personalProfileForm);
  personalProfileForm.hidden = false;
  authSubmit.hidden = true;
  loginModal.querySelector(".modal-title").textContent = "帳號設定";
  loginModal.querySelector("[data-auth-subtitle]").textContent = "管理個人資料、社員申請、通知偏好與帳號安全。";
  loginModal.dataset.view = "account-settings";
  loginModal.hidden = false;
  body.classList.add("modal-open");
};

const getNotificationChangeMs = (entry = {}) => {
  const value = getTimestampMs(entry.updatedAt || entry.createdAt);
  return Number.isFinite(value) ? value : 0;
};

const loadNotificationItems = async () => {
  const preferences = currentMemberProfile?.notificationPreferences || { announcements: true, classReminders: true, registrationUpdates: true };
  const items = [];
  if (preferences.announcements !== false) {
    const announcements = await getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION);
    announcements.sort((a, b) => getNotificationChangeMs(b) - getNotificationChangeMs(a)).slice(0, 12).forEach((entry) => {
      items.push({
        id: `announcement:${entry.id}:${getNotificationChangeMs(entry) || "legacy"}`,
        title: getLocalizedContentTitle(entry, "社團公告"),
        copy: entry.body || entry.message || entry.reminder || entry.note || entry.description || "請查看最新公告內容。",
        date: entry.date || entry.startDate || entry.createdAt,
        sortMs: getNotificationChangeMs(entry) || getAnnouncementSortMs(entry),
      });
    });
  }
  const shouldLoadClassData = preferences.classReminders !== false || preferences.registrationUpdates !== false;
  const [sessions, ownSignupSnapshot, memberNotificationSnapshot] = shouldLoadClassData
    ? await Promise.all([
        getCollectionEntries(CLASS_SESSION_COLLECTION),
        currentUser?.uid
          ? getDocs(query(collection(db, CLASS_SIGNUP_COLLECTION), where("userId", "==", currentUser.uid)))
          : Promise.resolve({ docs: [] }),
        currentUser?.uid
          ? getDocs(query(collection(db, MEMBER_NOTIFICATION_COLLECTION), where("userId", "==", currentUser.uid)))
          : Promise.resolve({ docs: [] }),
      ])
    : [[], { docs: [] }, { docs: [] }];
  const ownSignups = ownSignupSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const ownSignupBySession = new Map(ownSignups.map((entry) => [String(entry.sessionId || ""), entry]));
  const upcomingWindowMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const isUpcoming = (targetMs) => Number.isFinite(targetMs) && targetMs > now && targetMs <= now + upcomingWindowMs;

  if (preferences.classReminders !== false) {
    sessions
      .sort((a, b) => getNotificationChangeMs(b) - getNotificationChangeMs(a))
      .slice(0, 12)
      .forEach((entry) => {
        items.push({
          id: `class:${getClassSessionId(entry)}:${getNotificationChangeMs(entry) || "legacy"}`,
          title: getLocalizedContentTitle(entry, "社課提醒"),
          copy: entry.description || entry.reminder || [getClassSessionTimeLabel(entry), entry.location].filter(Boolean).join(" · ") || "請查看社課日期與內容。",
          date: entry.date || entry.sessionDate || entry.createdAt,
          sortMs: getNotificationChangeMs(entry) || getClassSessionSortMs(entry),
        });
      });
    sessions.forEach((session) => {
      const sessionId = getClassSessionId(session);
      const ownSignup = ownSignupBySession.get(sessionId);
      const startsAtMs = getClassSessionStartMs(session);
      if (ownSignup?.signupStatus !== "waitlisted" && ownSignup && isUpcoming(startsAtMs)) {
        items.push({
          id: `class-starting:${sessionId}:${startsAtMs}`,
          title: "社課即將開始",
          copy: `你報名的「${getLocalizedContentTitle(session, "社課")}」將於 24 小時內開始${session.location ? `，地點：${session.location}` : ""}。`,
          date: startsAtMs,
          sortMs: startsAtMs - upcomingWindowMs,
        });
      }
    });
  }
  if (preferences.registrationUpdates !== false) {
    const hasFormalAccess = currentUserIsAdmin || hasMemberPrivileges(currentMemberProfile || currentMemberStatus) || currentMemberProfile?.paymentStatus === "paid";
    sessions.filter((session) => session.signupRequired === true).forEach((session) => {
      const sessionId = getClassSessionId(session);
      const openAtMs = hasFormalAccess ? getMemberSignupOpenMs(session) : getPublicSignupOpenMs(session);
      const closeAtMs = getDateTimeLocalMs(session.signupCloseAt);
      if (isUpcoming(openAtMs)) {
        items.push({
          id: `signup-opening:${sessionId}:${openAtMs}`,
          title: "社課報名即將開始",
          copy: `「${getLocalizedContentTitle(session, "社課")}」將於 ${new Date(openAtMs).toLocaleString("zh-TW")} 開放報名。`,
          date: openAtMs,
          sortMs: openAtMs - upcomingWindowMs,
        });
      }
      if (isUpcoming(closeAtMs)) {
        items.push({
          id: `signup-closing:${sessionId}:${closeAtMs}`,
          title: "社課報名即將截止",
          copy: `「${getLocalizedContentTitle(session, "社課")}」將於 ${new Date(closeAtMs).toLocaleString("zh-TW")} 截止報名。`,
          date: closeAtMs,
          sortMs: closeAtMs - upcomingWindowMs,
        });
      }
    });
  }
  memberNotificationSnapshot.docs.forEach((entry) => {
    const notification = entry.data();
    if (notification.category === "classReminders" && preferences.classReminders === false) return;
    if (notification.category !== "classReminders" && preferences.registrationUpdates === false) return;
    const createdAtMs = getTimestampMs(notification.createdAt);
    items.push({
      id: `member:${entry.id}`,
      title: notification.title || "社課通知",
      copy: notification.message || "請查看最新社課資訊。",
      date: notification.createdAt || new Date(),
      sortMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
    });
  });
  if (preferences.registrationUpdates !== false && currentMemberProfile?.membershipStatus === "pending_payment") {
    const pendingDate = currentMemberProfile.paymentSubmittedAt || currentMemberProfile.updatedAt || currentMemberProfile.createdAt || new Date();
    const position = getMembershipRegistrationPosition(currentMemberProfile);
    items.unshift({
      id: `membership:pending-payment:${getTimestampMs(pendingDate) || "current"}`,
      title: position ? `社員申請第 ${position} 位` : "社員申請處理中",
      copy: position
        ? `你是本學期第 ${position} 位申請社員的人；幹部確認社費後，系統會更新社員資格。`
        : "幹部確認社費後，系統會更新社員資格。",
      date: pendingDate,
      sortMs: getTimestampMs(pendingDate),
    });
  }
  if (preferences.registrationUpdates !== false && currentMemberProfile?.membershipStatus === "membership_waitlisted") {
    const waitlistedDate = currentMemberProfile.membershipWaitlistedAt || currentMemberProfile.updatedAt || currentMemberProfile.createdAt || new Date();
    const position = Math.max(1, Number(currentMemberProfile.membershipWaitlistPosition || 1));
    items.unshift({
      id: `membership:waitlisted:${position}:${getTimestampMs(waitlistedDate) || "current"}`,
      title: `社員候補${getChinesePositionLabel(position)}`,
      copy: `本學期社員名額已滿，你目前是候補第 ${position} 位。候補期間不需進行社費付款。`,
      date: waitlistedDate,
      sortMs: getTimestampMs(waitlistedDate),
    });
  }
  if (preferences.registrationUpdates !== false && currentMemberProfile?.membershipStatusChange) {
    const change = currentMemberProfile.membershipStatusChange;
    const previousStatus = getManagedMembershipStatus(change.previousStatus || "non_member");
    const nextStatus = getManagedMembershipStatus(change.nextStatus || currentMemberProfile.membershipStatus || "non_member");
    const changedAtMs = getTimestampMs(change.changedAt);
    const changeKey = Number.isFinite(changedAtMs) ? String(changedAtMs) : `${previousStatus}-${nextStatus}`;
    items.unshift({
      id: `membership-status:${changeKey}:${nextStatus}`,
      title: `社員狀態已變更：${getMembershipStatusCopy(nextStatus).label}`,
      copy: `你的社團身分已從「${getMembershipStatusCopy(previousStatus).label}」調整為「${getMembershipStatusCopy(nextStatus).label}」。如有疑問請聯絡社團幹部。`,
      date: Number.isFinite(changedAtMs) ? changedAtMs : new Date(),
      sortMs: Number.isFinite(changedAtMs) ? changedAtMs : Date.now(),
    });
  }
  if (currentUserIsAdmin) {
    const adminNotifications = await getCollectionEntries(ADMIN_NOTIFICATION_COLLECTION);
    adminNotifications.slice(0, 50).forEach((entry) => {
      const createdAtMs = getTimestampMs(entry.createdAt);
      items.push({
        id: `admin:${entry.id}`,
        title: entry.title || "管理通知",
        copy: entry.message || entry.copy || "請查看最新管理事件。",
        date: entry.createdAt || new Date(),
        sortMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
      });
    });
  }
  items.sort((a, b) => Number(b.sortMs || 0) - Number(a.sortMs || 0));
  return items;
};

const setNotificationDotVisible = (visible) => {
  document.querySelectorAll(".notification-dot").forEach((dot) => { dot.hidden = !visible; });
};

const refreshNotificationMemberProfile = async () => {
  if (!currentUser?.uid || !db) return;
  const snapshot = await getDoc(getMemberDocRef(currentUser.uid));
  if (snapshot.exists()) currentMemberProfile = { ...(currentMemberProfile || {}), ...snapshot.data() };
};

const syncNotificationIndicator = async ({ refreshProfile = false } = {}) => {
  const requestId = ++notificationIndicatorRequestId;
  setNotificationDotVisible(false);
  if (!currentUser?.uid || !db) return;
  try {
    if (refreshProfile) await refreshNotificationMemberProfile();
    const items = await loadNotificationItems();
    if (requestId !== notificationIndicatorRequestId || !currentUser?.uid) return;
    const dismissedIds = new Set(Array.isArray(currentMemberProfile?.dismissedNotificationIds) ? currentMemberProfile.dismissedNotificationIds : []);
    const readIds = new Set(Array.isArray(currentMemberProfile?.readNotificationIds) ? currentMemberProfile.readNotificationIds : []);
    setNotificationDotVisible(items.some((item) => item.id && !dismissedIds.has(item.id) && !readIds.has(item.id)));
  } catch (error) {
    console.warn("Notification indicator load failed:", error);
  }
};

const getNotificationProfileIds = (fieldName) =>
  Array.isArray(currentMemberProfile?.[fieldName]) ? currentMemberProfile[fieldName] : [];

const saveNotificationProfileIds = async (fieldName, ids) => {
  if (!currentUser?.uid) return [];
  const nextIds = [...new Set(ids.filter(Boolean))].slice(-200);
  await setDoc(getMemberDocRef(currentUser.uid), { [fieldName]: nextIds }, { merge: true });
  currentMemberProfile = { ...(currentMemberProfile || {}), [fieldName]: nextIds };
  return nextIds;
};

const updateNotificationToolbarState = () => {
  const modal = document.querySelector("[data-notification-modal]");
  if (!modal) return;
  const items = [...modal.querySelectorAll("[data-notification-item]")];
  const checkboxes = items.map((item) => item.querySelector("[data-notification-select]")).filter(Boolean);
  const selected = checkboxes.filter((checkbox) => checkbox.checked);
  const selectAll = modal.querySelector("[data-notification-select-all]");
  const count = modal.querySelector("[data-notification-selection-count]");
  const deleteButton = modal.querySelector("[data-delete-selected-notifications]");
  const markAllReadButton = modal.querySelector("[data-mark-all-notifications-read]");
  const toolbar = modal.querySelector("[data-notification-toolbar]");

  if (toolbar) toolbar.hidden = items.length === 0;
  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
    selectAll.disabled = checkboxes.length === 0;
  }
  if (count) count.textContent = selected.length ? `已選擇 ${selected.length} 則通知` : "未選擇通知";
  if (deleteButton) deleteButton.disabled = selected.length === 0;
  if (markAllReadButton) markAllReadButton.disabled = !items.some((item) => item.classList.contains("is-unread"));
};

const showNotificationEmptyStateIfNeeded = () => {
  const list = document.querySelector("[data-notification-list]");
  if (!list || list.querySelector("[data-notification-item]")) return;
  list.innerHTML = `<article class="notification-empty"><h3>目前沒有通知</h3><p>新公告與報名狀態會顯示在這裡。</p></article>`;
  updateNotificationToolbarState();
};

const markNotificationIdsAsRead = async (notificationIds) => {
  const readNotificationIds = await saveNotificationProfileIds("readNotificationIds", [
    ...getNotificationProfileIds("readNotificationIds"),
    ...notificationIds,
  ]);
  const readIdSet = new Set(readNotificationIds);
  document.querySelectorAll("[data-notification-item]").forEach((item) => {
    if (readIdSet.has(String(item.dataset.notificationId || ""))) item.classList.remove("is-unread");
  });
  updateNotificationToolbarState();
  void syncNotificationIndicator();
};

const dismissNotificationIds = async (notificationIds) => {
  const ids = [...new Set(notificationIds.filter(Boolean))];
  if (!ids.length) return;
  await saveNotificationProfileIds("dismissedNotificationIds", [
    ...getNotificationProfileIds("dismissedNotificationIds"),
    ...ids,
  ]);
  const idSet = new Set(ids);
  notificationCenterVisibleIds = notificationCenterVisibleIds.filter((id) => !idSet.has(id));
  document.querySelectorAll("[data-notification-item]").forEach((item) => {
    if (idSet.has(String(item.dataset.notificationId || ""))) item.remove();
  });
  showNotificationEmptyStateIfNeeded();
  updateNotificationToolbarState();
  void syncNotificationIndicator();
};

const openNotificationCenter = async () => {
  if (!currentUser) { openLoginModal(); return; }
  const modal = ensureNotificationModal();
  const list = modal.querySelector("[data-notification-list]");
  const toolbar = modal.querySelector("[data-notification-toolbar]");
  modal.hidden = false;
  body.classList.add("modal-open");
  if (toolbar) toolbar.hidden = true;
  renderLoadingSkeleton(list, { rows: 3, label: "通知載入中" });
  try {
    await refreshNotificationMemberProfile();
    const dismissedIds = new Set(Array.isArray(currentMemberProfile?.dismissedNotificationIds) ? currentMemberProfile.dismissedNotificationIds : []);
    const readIds = new Set(Array.isArray(currentMemberProfile?.readNotificationIds) ? currentMemberProfile.readNotificationIds : []);
    const items = await loadNotificationItems();
    const visibleItems = items.filter((item) => item.id && !dismissedIds.has(item.id));
    notificationCenterVisibleIds = visibleItems.map((item) => item.id);
    list.innerHTML = visibleItems.length ? visibleItems.slice(0, 20).map((item) => {
      const copy = String(item.copy || "").trim();
      const hasCopy = copy && copy !== "無";
      const dateLabel = formatNotificationDate(item.date || item.sortMs);
      const unreadClass = readIds.has(item.id) ? "" : " is-unread";
      const checkbox = `<input class="notification-select-checkbox" data-notification-select type="checkbox" aria-label="選擇「${escapeHtml(item.title)}」通知" />`;
      if (!hasCopy) {
        return `
          <article class="notification-item${unreadClass}" data-notification-item data-notification-id="${escapeHtml(item.id)}">
            ${checkbox}
            <button class="notification-delete-button" data-dismiss-notification type="button" aria-label="刪除「${escapeHtml(item.title)}」通知">×</button>
            <h3>${escapeHtml(item.title)}</h3>
            ${dateLabel ? `<small>${escapeHtml(dateLabel)}</small>` : ""}
          </article>`;
      }
      return `
      <details class="notification-item${unreadClass}" data-notification-item data-notification-id="${escapeHtml(item.id)}">
        ${checkbox}
        <summary class="notification-summary">
          <span><h3>${escapeHtml(item.title)}</h3>${dateLabel ? `<small>${escapeHtml(dateLabel)}</small>` : ""}</span>
          <span class="notification-expand-label">查看</span>
        </summary>
        <button class="notification-delete-button" data-dismiss-notification type="button" aria-label="刪除「${escapeHtml(item.title)}」通知">×</button>
        <div class="notification-detail"><p>${escapeHtml(copy)}</p></div>
      </details>`;
    }).join("") : `<article class="notification-empty"><h3>目前沒有通知</h3><p>新公告與報名狀態會顯示在這裡。</p></article>`;
    clearLoadingState(list);
    list.querySelectorAll("[data-notification-item]").forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open || !currentUser?.uid) return;
        const notificationId = String(item.dataset.notificationId || "");
        if (getNotificationProfileIds("readNotificationIds").includes(notificationId)) return;
        markNotificationIdsAsRead([notificationId]).catch((error) => console.warn("Mark notification as read failed:", error));
      });
    });
    updateNotificationToolbarState();
  } catch (error) {
    notificationCenterVisibleIds = [];
    if (toolbar) toolbar.hidden = true;
    list.innerHTML = `<p class="content-copy">通知載入失敗，請稍後再試。</p>`;
  }
};

const bindNotificationCenter = () => {
  installHeaderAccountControls();
  if (!notificationRefreshTimer) {
    notificationRefreshTimer = window.setInterval(() => {
      if (!document.hidden && currentUser?.uid) void syncNotificationIndicator({ refreshProfile: true });
    }, PUBLIC_PAGE_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && currentUser?.uid) void syncNotificationIndicator({ refreshProfile: true });
    });
  }
  document.addEventListener("click", async (event) => {
    const selectAllInput = event.target.closest("[data-notification-select-all]");
    if (selectAllInput) {
      document.querySelectorAll("[data-notification-select]").forEach((checkbox) => {
        checkbox.checked = selectAllInput.checked;
      });
      updateNotificationToolbarState();
      return;
    }

    if (event.target.closest("[data-notification-select]")) {
      updateNotificationToolbarState();
      return;
    }

    const markAllReadButton = event.target.closest("[data-mark-all-notifications-read]");
    if (markAllReadButton) {
      markAllReadButton.disabled = true;
      try {
        await markNotificationIdsAsRead(notificationCenterVisibleIds);
        showToast("所有通知已標為已讀。", { tone: "success" });
      } catch (error) {
        console.error("Mark all notifications as read failed:", error);
        showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "標示已讀失敗" });
      } finally {
        updateNotificationToolbarState();
      }
      return;
    }

    const deleteSelectedButton = event.target.closest("[data-delete-selected-notifications]");
    if (deleteSelectedButton) {
      const selectedIds = [...document.querySelectorAll("[data-notification-select]:checked")]
        .map((checkbox) => String(checkbox.closest("[data-notification-item]")?.dataset.notificationId || "").trim())
        .filter(Boolean);
      if (!selectedIds.length) return;
      deleteSelectedButton.disabled = true;
      try {
        await dismissNotificationIds(selectedIds);
        showToast(`已刪除 ${selectedIds.length} 則通知。`, { tone: "success" });
      } catch (error) {
        console.error("Delete selected notifications failed:", error);
        showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "刪除通知失敗" });
      } finally {
        updateNotificationToolbarState();
      }
      return;
    }

    const dismissButton = event.target.closest("[data-dismiss-notification]");
    if (dismissButton) {
      const item = dismissButton.closest("[data-notification-item]");
      const notificationId = String(item?.dataset.notificationId || "").trim();
      if (!notificationId || !currentUser?.uid) return;
      dismissButton.disabled = true;
      try {
        await dismissNotificationIds([notificationId]);
      } catch (error) {
        console.error("Dismiss notification failed:", error);
        dismissButton.disabled = false;
        showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "刪除通知失敗" });
      }
      return;
    }
    if (event.target.closest("[data-notification-bell]")) {
      closeAccountMenus();
      void openNotificationCenter();
      return;
    }
    const toggle = event.target.closest("[data-account-menu-toggle]");
    if (toggle) {
      const root = toggle.closest("[data-account-menu-root]");
      const popover = root.querySelector("[data-account-popover]");
      const willOpen = popover.hidden;
      closeAccountMenus(root);
      popover.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    const settings = event.target.closest("[data-account-settings]");
    if (settings) {
      closeAccountMenus();
      await openAccountSettings(settings);
      return;
    }
    if (event.target.closest("[data-account-signout]")) {
      closeAccountMenus();
      await handleSignOut();
      return;
    }
    if (!event.target.closest("[data-account-menu-root]")) closeAccountMenus();
  });
  const modal = ensureNotificationModal();
  const close = () => { modal.hidden = true; body.classList.remove("modal-open"); };
  modal.querySelectorAll("[data-close-notifications]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => { if (event.target === modal || event.target.hasAttribute("data-modal-backdrop")) close(); });
};

const membershipStatusCopy = {
  admin: {
    label: "管理員",
    meaning: "目前具有管理員權限。",
    action: "",
  },
  officer: {
    label: "幹部",
    meaning: "目前為社團幹部，可使用正式社員功能。",
    action: "進入社員專區",
  },
  non_member: {
    label: "非社員",
    meaning: "目前不是正式社員。",
    action: "",
  },
  former_member: {
    label: "前社員",
    meaning: "目前為前社員，正式社員功能尚未開放。",
    action: "查看重新加入方式",
  },
  formal_member: {
    label: "社員",
    meaning: "已完成繳費，正式社員功能已開放。",
    action: "進入社員專區",
  },
  pending_payment: {
    label: "待繳社費",
    meaning: "社員名額已保留，完成社費繳納並由幹部確認後會成為正式社員。",
    action: "",
  },
  membership_waitlisted: {
    label: "社員候補",
    meaning: "目前在社員候補名單中，遞補前不需進行社費付款。",
    action: "",
  },
};

const getManagedMembershipStatus = (value = "") => {
  const explicitStatus = String(
    typeof value === "object" && value !== null ? value.membershipStatus || value.status || "" : value,
  )
    .trim()
    .toLowerCase();

  if (["admin", "administrator"].includes(explicitStatus)) {
    return "admin";
  }

  if (["officer", "club_officer", "staff", "cadre"].includes(explicitStatus)) {
    return "officer";
  }

  if (["formal_member", "formal", "approved", "member"].includes(explicitStatus)) {
    return "formal_member";
  }

  if (explicitStatus === "pending_payment") {
    return "pending_payment";
  }

  if (["former_member", "former", "expired", "qualification_expired"].includes(explicitStatus)) {
    return "former_member";
  }

  if (["membership_waitlisted", "waitlisted"].includes(explicitStatus)) {
    return "membership_waitlisted";
  }

  return "non_member";
};

const getMembershipStatusCopy = (status) => membershipStatusCopy[getManagedMembershipStatus(status)];
const getCurrentMembershipStatus = () => (currentUserIsAdmin ? "admin" : getManagedMembershipStatus(currentMemberStatus));
const hasMemberPrivileges = (value = "") => ["formal_member", "officer", "admin"].includes(getManagedMembershipStatus(value));
const hasFormalMemberAccess = (approvalData = null) =>
  currentUserIsAdmin ||
  hasMemberPrivileges(currentMemberProfile || currentMemberStatus) ||
  currentMemberProfile?.paymentStatus === "paid" ||
  currentMemberProfile?.signupApproved === true ||
  Boolean(approvalData);

const getPaymentMethodLabel = (value) =>
  ({ cash: "現金", transfer: "轉帳", later: "尚未選擇", none: "未申請" })[String(value || "")] || "尚未選擇";

const normalizeCashPaymentOption = (value = {}) => {
  const id = String(value.id || "").trim().slice(0, 50);
  const label = String(value.label || "").trim().slice(0, 100);
  return id && label ? { id, label } : null;
};

const getCashPaymentOptionsFromSettings = (settings = {}) => {
  if (Array.isArray(settings.cashPaymentOptions)) {
    const options = settings.cashPaymentOptions.map(normalizeCashPaymentOption).filter(Boolean);
    if (options.length) return options;
  }
  const legacyOptions = [
    { id: "office_lunch", label: String(settings.cashOfficeLabel || "").trim() },
    { id: "class", label: String(settings.cashClassLabel || "").trim() },
  ].map(normalizeCashPaymentOption).filter(Boolean);
  return legacyOptions.length ? legacyOptions : DEFAULT_CASH_PAYMENT_OPTIONS.map((option) => ({ ...option }));
};

const getCashPaymentSlotLabel = (value) => {
  const slot = String(value || "");
  return membershipPaymentSettings.cashPaymentOptions.find((option) => option.id === slot)?.label || (slot ? "已停用的現金繳費方式" : "尚未選擇");
};

const getMembershipIntentFromProfile = (profile = {}) =>
  profile.membershipIntent === "join" ||
  ["cash", "transfer"].includes(String(profile.paymentMethod || "")) ||
  ["pending_payment", "formal_member", "membership_waitlisted"].includes(String(profile.membershipStatus || profile.status || ""))
    ? "join"
    : "not_join";

const getMembershipRegistrationPeriodId = () => `${getConfiguredAcademicYear()}-${getConfiguredAcademicTerm()}`;

const getMembershipRegistrationPosition = (member = {}) => {
  const value = Math.floor(Number(member.membershipRegistrationPosition || 0));
  return value > 0 ? value : 0;
};

const getChinesePositionLabel = (position) => {
  const labels = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const value = Math.max(1, Math.floor(Number(position || 1)));
  if (value <= 10) return labels[value];
  if (value < 20) return `十${labels[value - 10]}`;
  if (value < 100) return `${labels[Math.floor(value / 10)]}十${value % 10 ? labels[value % 10] : ""}`;
  return String(value);
};

const getMembershipApplicationPositionLabel = (member = {}) => {
  if (getManagedMembershipStatus(member) === "membership_waitlisted") {
    const waitlistPosition = Math.floor(Number(member.membershipWaitlistPosition || 0));
    return waitlistPosition > 0 ? `候補第 ${waitlistPosition} 位` : "社員候補";
  }
  const position = getMembershipRegistrationPosition(member);
  return getMembershipIntentFromProfile(member) === "join" && position > 0 ? `社員申請第 ${position} 位` : "";
};

const doesMembershipProfileOccupySlot = (member = {}, academicYear = getConfiguredAcademicYear(), term = getConfiguredAcademicTerm()) => {
  const status = getManagedMembershipStatus(member);
  return !["officer", "admin"].includes(status)
    && status !== "membership_waitlisted"
    && String(member.academicYear || "") === academicYear
    && String(member.term || "") === term
    && getMembershipIntentFromProfile(member) === "join";
};

const doesMemberOccupyMembershipSlot = (member = {}, academicYear = getConfiguredAcademicYear(), term = getConfiguredAcademicTerm()) => {
  const memberId = String(member.uid || member.id || "").trim();
  const isKnownAdmin = Boolean(memberId) && (
    (currentUserIsAdmin && currentUser?.uid === memberId) ||
    (membersDashboardCache.admins || []).some((admin) => [admin.id, admin.uid].includes(memberId))
  );
  return !isKnownAdmin && doesMembershipProfileOccupySlot(member, academicYear, term);
};

const currentProfileOccupiesMembershipSlot = () => {
  return doesMemberOccupyMembershipSlot(currentMemberProfile || {});
};

const getMembershipRegistrationAvailability = () => {
  if (currentProfileOccupiesMembershipSlot()) {
    return { available: true, message: "你已保留本學期社員名額，可繼續修改繳費資料。" };
  }
  if (getManagedMembershipStatus(currentMemberProfile || {}) === "membership_waitlisted") {
    const position = Math.max(1, Number(currentMemberProfile?.membershipWaitlistPosition || 1));
    return { available: true, waitlisted: true, message: `你目前是社員候補第 ${position} 位；遞補前不需進行社費付款。` };
  }
  const openAt = getDateTimeLocalMs(membershipRegistrationSettings.openAt);
  const closeAt = getDateTimeLocalMs(membershipRegistrationSettings.closeAt);
  const limit = Math.max(0, Number(membershipRegistrationSettings.limit || 0));
  const count = Math.max(0, Number(membershipRegistrationSettings.count || 0));
  const now = Date.now();
  if (!openAt || !closeAt || openAt >= closeAt || limit <= 0) {
    return { available: false, message: "社員申請尚未開放，請留意社團公告。" };
  }
  if (now < openAt) {
    return { available: false, message: `社員申請將於 ${new Date(openAt).toLocaleString("zh-TW")} 開放。` };
  }
  if (now > closeAt) {
    return { available: false, message: "本學期社員申請已截止。" };
  }
  if (count >= limit) {
    return { available: true, waitlisted: true, message: `本學期社員名額已滿（${count}/${limit}），現在申請將加入候補名單。` };
  }
  return { available: true, message: `社員申請開放中，剩餘 ${Math.max(0, limit - count)} 名；截止時間為 ${new Date(closeAt).toLocaleString("zh-TW")}。` };
};

const buildTransferAccountMarkup = () => {
  const hasAccount = membershipPaymentSettings.accountName && membershipPaymentSettings.accountNumber;
  if (!hasAccount) {
    return `<p class="content-copy">管理員尚未設定轉帳帳戶，請選擇現金或向幹部確認。</p>`;
  }

  return `
    <p><span>銀行</span><strong>${escapeHtml(membershipPaymentSettings.bankName || "未填寫")}（${escapeHtml(membershipPaymentSettings.bankCode || "未填代碼")}）</strong></p>
    <p><span>戶名</span><strong>${escapeHtml(membershipPaymentSettings.accountName)}</strong></p>
    <p><span>帳號</span><strong>${escapeHtml(membershipPaymentSettings.accountNumber)}</strong></p>
  `;
};

const syncMembershipPaymentForm = (form) => {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const intent = form.querySelector("[name='membershipIntent']:checked")?.value || "not_join";
  const availability = getMembershipRegistrationAvailability();
  const joinInput = form.querySelector("[name='membershipIntent'][value='join']");
  if (joinInput instanceof HTMLInputElement) {
    joinInput.disabled = !availability.available;
  }
  form.querySelectorAll("[data-membership-registration-status]").forEach((element) => {
    setMessageTone(element, availability.message, availability.available ? "success" : "error");
  });
  const method = form.querySelector("[name='paymentMethod']:checked")?.value || "";
  const paymentRequired = intent === "join" && !availability.waitlisted;
  const paymentFields = form.querySelector("[data-membership-payment-fields]");
  const cashPanel = form.querySelector("[data-cash-payment-panel]");
  const transferPanel = form.querySelector("[data-transfer-payment-panel]");
  if (paymentFields) {
    paymentFields.hidden = !paymentRequired;
  }
  if (cashPanel) {
    cashPanel.hidden = !paymentRequired || method !== "cash";
  }
  if (transferPanel) {
    transferPanel.hidden = !paymentRequired || method !== "transfer";
  }
  form.querySelectorAll("[data-transfer-account-card]").forEach((card) => {
    card.innerHTML = buildTransferAccountMarkup();
  });
  form.querySelectorAll("[data-cash-payment-options-select]").forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    const selectedValue = select.value;
    const placeholder = new Option("請選擇", "");
    const options = membershipPaymentSettings.cashPaymentOptions.map((option) => new Option(option.label, option.id));
    if (selectedValue && !membershipPaymentSettings.cashPaymentOptions.some((option) => option.id === selectedValue)) {
      options.push(new Option("已停用的現金繳費方式", selectedValue));
    }
    select.replaceChildren(placeholder, ...options);
    select.value = selectedValue;
  });
};

const readMembershipPaymentForm = (form) => {
  const membershipIntent = String(form.querySelector("[name='membershipIntent']:checked")?.value || "not_join");
  const waitlisted = membershipIntent === "join" && getMembershipRegistrationAvailability().waitlisted;
  const paymentMethod = membershipIntent === "join" && !waitlisted ? String(form.querySelector("[name='paymentMethod']:checked")?.value || "") : "none";
  return {
    membershipIntent,
    paymentMethod,
    cashPaymentSlot: paymentMethod === "cash" ? String(form.querySelector("[name='cashPaymentSlot']")?.value || "") : "",
    transferAt: paymentMethod === "transfer" ? String(form.querySelector("[name='transferAt']")?.value || "") : "",
    transferLastFive: paymentMethod === "transfer" ? String(form.querySelector("[name='transferLastFive']")?.value || "").trim() : "",
  };
};

const validateMembershipPaymentData = (data) => {
  if (data.membershipIntent !== "join" || getMembershipRegistrationAvailability().waitlisted) {
    return "";
  }
  if (!data.paymentMethod) {
    return "請選擇社費方式。";
  }
  if (data.paymentMethod === "cash" && !data.cashPaymentSlot) {
    return "請選擇預計現金繳費方式。";
  }
  if (
    data.paymentMethod === "cash" &&
    !membershipPaymentSettings.cashPaymentOptions.some((option) => option.id === data.cashPaymentSlot)
  ) {
    return "這個現金繳費方式已停用，請重新選擇。";
  }
  if (data.paymentMethod === "transfer" && (!membershipPaymentSettings.accountName || !membershipPaymentSettings.accountNumber)) {
    return "管理員尚未設定轉帳帳戶，請選擇現金或向幹部確認。";
  }
  if (data.paymentMethod === "transfer" && (!data.transferAt || !/^\d{5}$/.test(data.transferLastFive))) {
    return "請填寫轉帳日期、時間與轉出帳號末五碼。";
  }
  return "";
};

const normalizeMembershipStatus = (memberData = null) => {
  if (memberData?.paymentStatus === "paid") {
    return "formal_member";
  }
  const explicitStatus = String(memberData?.membershipStatus || memberData?.status || "").trim().toLowerCase();

  if (explicitStatus) {
    return getManagedMembershipStatus(explicitStatus);
  }

  return "non_member";
};

const loadCurrentMemberStatus = async (user) => {
  currentMemberStatus = "non_member";
  currentMemberProfile = null;

  if (!db || !user?.uid) {
    return currentMemberStatus;
  }

  const [memberDoc, approvalDoc] = await Promise.all([
    getDoc(getMemberDocRef(user.uid)),
    user.email ? getDoc(getApprovalDocRef(user.email)) : Promise.resolve(null),
  ]);
  let memberData = memberDoc.exists() ? memberDoc.data() : null;
  const signupApproved = Boolean(approvalDoc?.exists?.());
  const managedMemberStatus = normalizeMembershipStatus(memberData);

  currentMemberProfile = memberData ? { ...memberData, signupApproved } : null;
  currentMemberStatus = ["officer", "admin"].includes(managedMemberStatus)
    ? managedMemberStatus
    : signupApproved ? "formal_member" : managedMemberStatus;
  return currentMemberStatus;
};

const getFriendlyAuthError = (error) => {
  const code = error?.code;
  return authErrorMessages[code] || "登入發生問題，請稍後再試一次。" + (code ? "（" + code + "）" : "");
};
const getFriendlyApplicationError = (error) =>
  applicationErrorMessages[error?.code] || error?.message || "送出申請時發生問題，請稍後再試一次。";

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

const ensurePasswordResetModal = () => {
  const existing = document.querySelector("[data-password-reset-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", passwordResetModalMarkup);
  return document.querySelector("[data-password-reset-modal]");
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

const ensureActionSuccessModal = () => {
  const existing = document.querySelector("[data-action-success-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", actionSuccessModalMarkup);
  return document.querySelector("[data-action-success-modal]");
};

const ensureAdminClassCalendarModal = () => {
  const existing = document.querySelector("[data-admin-class-calendar-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", adminClassCalendarModalMarkup);
  return document.querySelector("[data-admin-class-calendar-modal]");
};

const ensurePublicCalendarModal = () => {
  const existing = document.querySelector("[data-public-calendar-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", publicCalendarDetailModalMarkup);
  return document.querySelector("[data-public-calendar-modal]");
};

const ensureClassSignupModal = () => {
  const existing = document.querySelector("[data-class-signup-modal]");
  if (existing) {
    return existing;
  }

  document.body.insertAdjacentHTML("beforeend", classSignupDetailModalMarkup);
  return document.querySelector("[data-class-signup-modal]");
};

const ensureNotificationModal = () => {
  const existing = document.querySelector("[data-notification-modal]");
  if (existing) return existing;
  document.body.insertAdjacentHTML("beforeend", notificationModalMarkup);
  return document.querySelector("[data-notification-modal]");
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
    signupProfile: loginModal.querySelector("[data-auth-signup-profile]"),
    signupNameInput: loginModal.querySelector("#signup-name"),
    signupStudentIdInput: loginModal.querySelector("#signup-student-id"),
    signupSchoolInput: loginModal.querySelector("#signup-school"),
    signupExternalSchoolField: loginModal.querySelector("[data-signup-external-school-field]"),
    signupExternalSchoolInput: loginModal.querySelector("#signup-external-school"),
    signupDepartmentInput: loginModal.querySelector("#signup-department"),
    signupPhoneInput: loginModal.querySelector("#signup-phone"),
    privacyConsentInput: loginModal.querySelector("[name='privacyConsent']"),
    accountMembershipForm: loginModal.querySelector("[data-account-membership-form]"),
    accountMembershipSummary: loginModal.querySelector("[data-account-membership-summary]"),
    editAccountMembershipButton: loginModal.querySelector("[data-edit-account-membership]"),
    personalProfileForm: loginModal.querySelector("[data-personal-profile-form]"),
    editPersonalProfileButton: loginModal.querySelector("[data-edit-personal-profile]"),
    emailInput: loginModal.querySelector("#login-email"),
    passwordInput: loginModal.querySelector("#login-password"),
    statusCard: loginModal.querySelector("[data-auth-status]"),
    statusEmail: loginModal.querySelector("[data-auth-email]"),
    statusHint: loginModal.querySelector("[data-auth-status-hint]"),
    closeButtons: loginModal.querySelectorAll("[data-close-login]"),
  };
};

const getPasswordResetModalElements = () => {
  const resetModal = ensurePasswordResetModal();
  return {
    resetModal,
    form: resetModal.querySelector("[data-password-reset-form]"),
    hint: resetModal.querySelector("[data-password-reset-hint]"),
    submitButton: resetModal.querySelector("[data-password-reset-submit]"),
    emailInput: resetModal.querySelector("#reset-email"),
    closeButtons: resetModal.querySelectorAll("[data-close-password-reset]"),
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
    form: calendarModal.querySelector("[data-admin-calendar-event-form]"),
    saveButton: calendarModal.querySelector("[data-admin-calendar-save]"),
    deleteButton: calendarModal.querySelector("[data-admin-calendar-delete]"),
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

  const { loginModal, authSubtitle, authSubmit, authTabs, confirmField, confirmInput, passwordInput, signupProfile } =
    getLoginModalElements();

  loginModal.querySelector(".modal-title").textContent = authCopy[mode].title;
  authSubtitle.textContent = authCopy[mode].subtitle;
  authSubmit.textContent = authCopy[mode].submitLabel;
  confirmField.hidden = mode !== "signup";
  loginModal.querySelector("[data-password-reset-trigger]").hidden = mode !== "signin";
  if (signupProfile) {
    signupProfile.hidden = mode !== "signup";
    syncMembershipPaymentForm(loginModal.querySelector("[data-login-form]"));
  }
  passwordInput.setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");

  if (mode !== "signup") {
    confirmInput.value = "";
    signupProfile?.querySelectorAll("input").forEach((input) => {
      if (input.type === "radio" || input.type === "checkbox") {
        input.checked = false;
      } else {
        input.value = "";
      }
    });
    const noMembershipOption = signupProfile?.querySelector("[name='membershipIntent'][value='not_join']");
    if (noMembershipOption instanceof HTMLInputElement) {
      noMembershipOption.checked = true;
    }
    syncMembershipPaymentForm(loginModal.querySelector("[data-login-form]"));
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

const renderAccountMembershipSummary = (container) => {
  if (!container) {
    return;
  }

  const profile = currentMemberProfile || {};
  const intent = getMembershipIntentFromProfile(profile);
  const waitlisted = getManagedMembershipStatus(profile) === "membership_waitlisted";
  if (waitlisted) {
    const position = Math.max(1, Number(profile.membershipWaitlistPosition || 1));
    container.innerHTML = [
      "<span>申請：本學期社員候補</span>",
      `<span>候補順位：第 ${position} 位</span>`,
      "<span>社費狀態：候補期間不需付款</span>",
    ].join("");
    return;
  }
  const method = profile.paymentMethod || (intent === "join" ? "later" : "none");
  const details = [
    `<span>申請：${intent === "join" ? "本學期申請社員" : "本學期不申請社員"}</span>`,
    intent === "join" && getMembershipRegistrationPosition(profile)
      ? `<span>申請順位：第 ${getMembershipRegistrationPosition(profile)} 位</span>`
      : "",
    intent === "join" ? `<span>社費方式：${escapeHtml(getPaymentMethodLabel(method))}</span>` : "",
    method === "cash" ? `<span>預計場合：${escapeHtml(getCashPaymentSlotLabel(profile.cashPaymentSlot))}</span>` : "",
    method === "transfer" && profile.transferLastFive ? `<span>轉出帳號末五碼：${escapeHtml(profile.transferLastFive)}</span>` : "",
    intent === "join" ? `<span>社費狀態：${profile.paymentStatus === "paid" ? "已確認" : "待幹部確認"}</span>` : "",
  ].filter(Boolean);
  container.innerHTML = details.join("");
};

const populateAccountMembershipForm = (form) => {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const profile = currentMemberProfile || {};
  const intent = getMembershipIntentFromProfile(profile);
  const method = profile.paymentMethod || (intent === "join" ? "later" : "none");
  const intentInput = form.querySelector(`[name='membershipIntent'][value='${intent}']`);
  const methodInput = form.querySelector(`[name='paymentMethod'][value='${method}']`);
  if (intentInput instanceof HTMLInputElement) {
    intentInput.checked = true;
  }
  if (methodInput instanceof HTMLInputElement) {
    methodInput.checked = true;
  }
  const cashSlot = form.querySelector("[name='cashPaymentSlot']");
  const transferAt = form.querySelector("[name='transferAt']");
  const transferLastFive = form.querySelector("[name='transferLastFive']");
  if (cashSlot instanceof HTMLSelectElement) {
    cashSlot.value = profile.cashPaymentSlot || "";
  }
  if (transferAt instanceof HTMLInputElement) {
    transferAt.value = formatDateTimeLocalValue(profile.transferAt || "");
  }
  if (transferLastFive instanceof HTMLInputElement) {
    transferLastFive.value = profile.transferLastFive || "";
  }
  syncMembershipPaymentForm(form);
};

const updateAuthView = () => {
  const { loginModal, loginForm, statusCard, statusEmail, statusHint, authSubmit, authSwitch, accountMembershipForm, accountMembershipSummary, editAccountMembershipButton, personalProfileForm } =
    getLoginModalElements();

  if (currentUser) {
    authSubmit.hidden = false;
    loginModal.querySelector(".modal-title").textContent = signedInCopy.title;
    loginModal.querySelector("[data-auth-subtitle]").textContent = signedInCopy.subtitle;
    loginForm.hidden = true;
    statusCard.hidden = false;
    accountMembershipForm.hidden = true;
    personalProfileForm.hidden = true;
    authSwitch.hidden = true;
    const statusCopy = getMembershipStatusCopy(getCurrentMembershipStatus());
    statusEmail.innerHTML = `
      <span class="member-status-badge">${escapeHtml(statusCopy.label)}</span>
      <span>${escapeHtml(currentUser.email || "")}</span>
    `;
    statusHint.textContent = currentUserIsAdmin ? "你目前有管理員權限。" : statusCopy.meaning;
    renderAccountMembershipSummary(accountMembershipSummary);
    editAccountMembershipButton.hidden = hasFormalMemberAccess();
    authSubmit.textContent = signedInCopy.buttonLabel;
    authSubmit.dataset.authAction = "signout";
    authSubmit.removeAttribute("form");
    authSubmit.type = "button";
    return;
  }

  loginModal.querySelector(".modal-title").textContent = authCopy[authMode].title;
  authSubmit.hidden = false;
  loginModal.querySelector("[data-auth-subtitle]").textContent = authCopy[authMode].subtitle;
  loginForm.hidden = false;
  accountMembershipForm.hidden = true;
  personalProfileForm.hidden = true;
  statusCard.hidden = true;
  authSwitch.hidden = false;
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
    try {
      await ensureFirebaseModules();
      const app = initializeApp(firebaseConfig);
      if (appCheckSiteKey && initializeAppCheck && ReCaptchaEnterpriseProvider) {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      }
      auth = getAuth(app);
      if (setPersistence && browserLocalPersistence) {
        await setPersistence(auth, browserLocalPersistence);
      }
      db = getFirestore(app);
      functionsClient = getFunctions ? getFunctions(app, "asia-east1") : null;
    } catch (error) {
      authReadyPromise = null;
      setHint("Firebase SDK 載入失敗，請稍後再試。", "error");
      return null;
    }

    let initialAuthStateResolved = false;
    let resolveInitialAuthState;
    const initialAuthStatePromise = new Promise((resolve) => {
      resolveInitialAuthState = resolve;
    });

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      currentUserIsAdmin = false;
      currentMemberStatus = "non_member";
      currentMemberProfile = null;
      membersDashboardCache.loaded = false;
      membersDashboardCache.loadWarnings = [];
      classSignupPageState.loaded = false;
      classSignupPageState.loadWarnings = [];
      announcementPageState.loaded = false;
      announcementPageState.loadWarnings = [];
      faqPageState.loaded = false;
      faqPageState.loadWarnings = [];

      if (user) {
        const [adminStatusResult, memberStatusResult] = await Promise.allSettled([
          loadAdminStatus(user),
          loadCurrentMemberStatus(user),
        ]);
        if (adminStatusResult.status === "rejected") {
          console.warn("Load admin status failed:", adminStatusResult.reason);
        }
        if (memberStatusResult.status === "rejected") {
          console.warn("Load member status failed:", memberStatusResult.reason);
        }

        if (
          memberStatusResult.status === "fulfilled" &&
          !currentMemberProfile
        ) {
          try {
            await syncMemberProfile(user, "session");
            await loadCurrentMemberStatus(user);
          } catch (error) {
            console.warn("Repair missing member profile failed:", error);
          }
        }
      }

      writeAuthSnapshot(user, currentUserIsAdmin);

      updateLoginButtons();
      updateAuthView();
      applyMaintenanceView();

      if (!initialAuthStateResolved) {
        initialAuthStateResolved = true;
        resolveInitialAuthState(auth);
      }

      if (isMaintenanceBlocking()) {
        return;
      }

      if (pageName === "members") {
        await refreshMembersDashboardSafe({ force: true });
      } else if (pageName === "class-signup") {
        await refreshClassSignupPageSafe({ force: true });
      } else if (pageName === "notices") {
        await refreshAnnouncementsPageSafe({ force: true });
      }
    });

    await initialAuthStatePromise;
    return auth;
  })();

  return authReadyPromise;
};

const openLoginModal = async (trigger) => {
  const { loginModal, emailInput } = getLoginModalElements();
  lastLoginTrigger = trigger || null;
  loginModal.dataset.view = "auth";
  loginModal.hidden = false;
  body.classList.add("modal-open");
  closeMobileNav();

  if (firebaseConfigured) {
    await ensureAuthReady();
    if (auth?.currentUser && !currentUser) {
      currentUser = auth.currentUser;
      await loadAdminStatus(currentUser);
      await loadCurrentMemberStatus(currentUser);
      writeAuthSnapshot(currentUser, currentUserIsAdmin);
    }
  }

  updateLoginButtons();
  updateAuthView();

  if (pageName === "members" && currentUser) {
    await refreshMembersDashboardSafe({ force: true });
  }

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

const setPasswordResetHint = (message, tone = "default") => {
  setMessageTone(getPasswordResetModalElements().hint, message, tone);
};

const openPasswordResetModal = () => {
  const { loginModal } = getLoginModalElements();
  const { resetModal, form } = getPasswordResetModalElements();
  form.reset();
  setPasswordResetHint("如需重設密碼，請聯絡社團幹部核對身分後協助處理。");
  loginModal.hidden = true;
  resetModal.hidden = false;
  body.classList.add("modal-open");
  window.setTimeout(() => resetModal.querySelector("[data-close-password-reset]")?.focus(), 50);
};

const closePasswordResetModal = () => {
  const { resetModal } = getPasswordResetModalElements();
  resetModal.hidden = true;
  body.classList.remove("modal-open");
};

const handlePasswordResetSubmit = async (event) => {
  event.preventDefault();
  setPasswordResetHint("目前未啟用自動密碼重設，請聯絡社團幹部協助處理。", "error");
};

const bindPasswordResetModalEvents = () => {
  const { resetModal, form, closeButtons } = getPasswordResetModalElements();
  document.querySelector("[data-open-password-reset]")?.addEventListener("click", openPasswordResetModal);
  form.addEventListener("submit", handlePasswordResetSubmit);
  closeButtons.forEach((button) => button.addEventListener("click", closePasswordResetModal));
  resetModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target === resetModal || target.hasAttribute("data-modal-backdrop")) {
      closePasswordResetModal();
    }
  });
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
      : "填完社員申請後送出，請依通知完成社費繳納；幹部確認後才會取得正式社員資格。";
  setApplicationHint("送出後請留意社費繳費通知，正式社員資格以幹部確認社費為準。");
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

const getAdminCalendarAnnouncementId = (announcement = {}) => String(announcement.id || announcement.announcementId || "").trim();
const getAnnouncementTimeLabel = (announcement = {}) =>
  buildEventTimeLabel(announcement.startTime, announcement.endTime, announcement.timeLabel || announcement.time);
const getAnnouncementNote = (announcement = {}) => String(announcement.body || announcement.note || announcement.reminder || "").trim();
const getNoticeEventType = (entry = {}) => {
  const type = String(entry.calendarEventType || entry.eventType || "").trim();
  return type === "class" ? "class" : type === "holiday" ? "holiday" : "announcement";
};
const normalizeClassSessionAsNotice = (session = {}) => ({
  ...session,
  id: `class-${getClassSessionId(session)}`,
  date: String(session.date || session.sessionDate || "").trim(),
  endDate: String(session.date || session.sessionDate || "").trim(),
  title: getLocalizedContentTitle(session, "社課"),
  body: session.description || session.reminder || "請查看社課日期與內容。",
  reminder: "社課",
  color: normalizeCalendarColor(session.color),
  calendarEventType: "class",
  sourceSessionId: getClassSessionId(session),
});
const getAnnouncementDateKey = (announcement = {}) => {
  const explicitDate = String(announcement.date || "").trim();
  if (parseDateKey(explicitDate)) {
    return explicitDate;
  }

  const createdAtMs = getTimestampMs(announcement.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return "";
  }

  return formatDateInputValue(new Date(createdAtMs));
};

const getAnnouncementEndDateKey = (announcement = {}) => {
  const startDate = getAnnouncementDateKey(announcement);
  const explicitEndDate = String(announcement.endDate || "").trim();
  return parseDateKey(explicitEndDate) && explicitEndDate >= startDate ? explicitEndDate : startDate;
};

const isDateWithinAnnouncement = (dateKey, announcement = {}) => {
  const startDate = getAnnouncementDateKey(announcement);
  const endDate = getAnnouncementEndDateKey(announcement);
  return Boolean(startDate && dateKey >= startDate && dateKey <= endDate);
};

const getAnnouncementDateKeys = (announcement = {}, maxDays = 370) => {
  const start = parseDateKey(getAnnouncementDateKey(announcement));
  const endKey = getAnnouncementEndDateKey(announcement);
  if (!start || !endKey) {
    return [];
  }
  const keys = [];
  const cursor = new Date(start);
  while (keys.length < maxDays) {
    const key = formatDateInputValue(cursor);
    if (key > endKey) {
      break;
    }
    keys.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const getAdminCalendarEventsForDate = (dateKey) => {
  const classEvents = membersDashboardCache.classSessions
    .filter((session) => String(session.date || session.sessionDate || "").trim() === dateKey)
    .map((session) => ({
      type: "class",
      id: getClassSessionId(session),
      title: getLocalizedContentTitle(session),
      timeLabel: getClassSessionTimeLabel(session),
      location: session.location || "",
      note: session.reminder || session.description || "",
      color: normalizeCalendarColor(session.color),
      albumUrl: membersDashboardCache.classAlbums.find((album) => album.id === getClassSessionId(session))?.url || "",
      source: session,
    }));

  const announcementEvents = membersDashboardCache.announcements
    .filter((announcement) => isDateWithinAnnouncement(dateKey, announcement))
    .map((announcement) => ({
      type: getNoticeEventType(announcement),
      id: getAdminCalendarAnnouncementId(announcement),
      title: getLocalizedContentTitle(announcement),
      timeLabel: getNoticeEventType(announcement) === "holiday" ? "連續假期" : getAnnouncementTimeLabel(announcement),
      location: announcement.location || "",
      note: getAnnouncementNote(announcement),
      color: normalizeCalendarColor(announcement.color || (getNoticeEventType(announcement) === "holiday" ? "orange" : "blue")),
      source: announcement,
    }));

  return [...classEvents, ...announcementEvents].sort((a, b) => {
    const timeA = a.timeLabel || "";
    const timeB = b.timeLabel || "";
    return timeA.localeCompare(timeB, "zh-Hant") || a.title.localeCompare(b.title, "zh-Hant");
  });
};

const getActionSuccessModalElements = () => {
  const successModal = document.querySelector("[data-action-success-modal]");
  return {
    successModal,
    title: successModal?.querySelector("[data-action-success-title]"),
    copy: successModal?.querySelector("[data-action-success-copy]"),
    confirmButton: successModal?.querySelector("[data-confirm-action-success]"),
    closeButtons: successModal?.querySelectorAll("[data-close-action-success]") || [],
  };
};

const getPublicCalendarModalElements = () => {
  const calendarModal = document.querySelector("[data-public-calendar-modal]");
  return {
    calendarModal,
    title: calendarModal?.querySelector("[data-public-calendar-title]"),
    subtitle: calendarModal?.querySelector("[data-public-calendar-subtitle]"),
    list: calendarModal?.querySelector("[data-public-calendar-list]"),
    closeButtons: calendarModal?.querySelectorAll("[data-close-public-calendar]") || [],
  };
};

const getClassSignupModalElements = () => {
  const calendarModal = ensureClassSignupModal();
  return {
    calendarModal,
    title: calendarModal?.querySelector("[data-class-signup-modal-title]"),
    subtitle: calendarModal?.querySelector("[data-class-signup-modal-subtitle]"),
    body: calendarModal?.querySelector("[data-class-signup-modal-body]"),
    closeButtons: calendarModal?.querySelectorAll("[data-close-class-signup-modal]") || [],
  };
};

const openActionSuccessModal = ({ title = "儲存完畢", copy = "內容已更新。" } = {}) => {
  const { successModal, title: titleNode, copy: copyNode, confirmButton } = getActionSuccessModalElements();
  if (!successModal) {
    window.alert(copy);
    return;
  }

  if (titleNode) {
    titleNode.textContent = title;
  }
  if (copyNode) {
    copyNode.textContent = copy;
  }

  successModal.hidden = false;
  body.classList.add("modal-open");
  window.setTimeout(() => confirmButton?.focus(), 50);
};

const closeActionSuccessModal = () => {
  const { successModal } = getActionSuccessModalElements();
  if (!successModal) {
    return;
  }

  successModal.hidden = true;
  body.classList.remove("modal-open");
};

const getPublicClassSignupModalState = (session) => {
  const sessionId = getClassSessionId(session);
  const ownSignup = classSignupPageState.ownSignups.find((signup) => signup.sessionId === sessionId) || null;
  const approvalData = classSignupPageState.approval;
  const isFormalMember = hasFormalMemberAccess(approvalData);
  const canSignup = Boolean(currentUser) && (isFormalMember || Boolean(session.allowNonMembers));
  const isSignupSession = Boolean(session.signupRequired);
  const signupOpen = isSignupSession && isClassSignupWindowOpen(session);
  const statusLabel = isSignupSession
    ? signupOpen ? "開放報名" : isClassSignupWindowClosed(session) ? "報名已截止" : isNonMemberPriorityWindow(session) ? "社員優先報名中" : "尚未開放"
    : "固定社課";

  return {
    ownSignup,
    approvalData,
    canSignup,
    isSignupSession,
    signupOpen,
    statusLabel,
  };
};

const renderClassSignupModalContent = (sessionId) => {
  const { calendarModal, title, subtitle, body: bodyNode } = getClassSignupModalElements();
  if (!calendarModal || !bodyNode) {
    return;
  }

  calendarModal.dataset.sessionId = sessionId;

  const session = classSignupPageState.sessions.find((item) => getClassSessionId(item) === sessionId);
  if (!session) {
    if (title) {
      title.textContent = "社課報名";
    }
    if (subtitle) {
      subtitle.textContent = "";
    }
    bodyNode.innerHTML = `
      <article class="admin-calendar-modal-session">
        <p class="admin-calendar-modal-empty">找不到這筆社課資料，請重新從行事曆開啟。</p>
      </article>
    `;
    return;
  }

  const { ownSignup, approvalData, canSignup, isSignupSession, signupOpen, statusLabel } = getPublicClassSignupModalState(session);
  const albumUrl = classSignupPageState.classAlbums.find((album) => album.id === sessionId)?.url || "";
  const signupCount = getSessionSignupCount(sessionId);
  const formMarkup = isSignupSession
    ? buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, signupOpen)
    : `
        <div class="class-session-note">
          <p class="content-copy">此場次不需要報名，請直接依照行事曆出席即可。</p>
        </div>
      `;

  if (title) {
    title.textContent = getLocalizedContentTitle(session, "社課報名");
  }
  if (subtitle) {
    subtitle.textContent = [getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" ・ ");
  }

  bodyNode.innerHTML = `
    <div class="class-signup-modal-stack">
      <article class="admin-calendar-modal-session class-signup-modal-session-card">
        <div class="admin-calendar-modal-session-head">
          <div>
            <p class="admin-calendar-modal-session-weekday">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
            <h3 class="admin-calendar-modal-session-title">${escapeHtml(getLocalizedContentTitle(session, "社課"))}</h3>
          </div>
          <span class="member-row-status">${escapeHtml(statusLabel)}</span>
        </div>
        ${session.location ? `<p class="admin-calendar-modal-session-copy"><strong>地點：</strong>${escapeHtml(session.location)}</p>` : ""}
        <p class="admin-calendar-modal-session-copy">${escapeHtml(session.description || session.reminder || "這一天有社課安排，請依照時間參與。")}</p>
        ${session.reminder ? `<p class="class-session-reminder">提醒：${escapeHtml(session.reminder)}</p>` : ""}
        ${currentUser && albumUrl ? `<p class="class-session-album"><a class="button-secondary" href="${escapeHtml(albumUrl)}" target="_blank" rel="noopener noreferrer">查看本次社課照片</a></p>` : ""}
      </article>
      <div class="class-capacity-summary"><strong>${escapeHtml(getRemainingCapacityMarkup(session))}</strong><span>${escapeHtml(`${signupCount} 人正取${getSessionWaitlistCount(sessionId) ? `，${getSessionWaitlistCount(sessionId)} 人候補` : ""}`)}</span></div>
      <section class="class-signup-modal-form-shell">
        ${formMarkup}
      </section>
    </div>
  `;

  bindClassSignupBoardEvents();
};

const openClassSignupModal = (sessionId, trigger = null) => {
  const { calendarModal } = getClassSignupModalElements();
  if (!calendarModal || !sessionId) {
    return;
  }

  lastClassSignupTrigger = trigger || null;
  calendarModal.dataset.activeTab = "signup";
  renderClassSignupModalContent(sessionId);
  calendarModal.hidden = false;
  body.classList.add("modal-open");

  window.setTimeout(() => {
    const { body: bodyNode } = getClassSignupModalElements();
    const firstField = bodyNode?.querySelector("select, input, textarea, button");
    if (firstField instanceof HTMLElement) {
      firstField.focus();
    }
  }, 50);
};

const closeClassSignupModal = () => {
  const { calendarModal } = getClassSignupModalElements();
  if (!calendarModal) {
    return;
  }

  calendarModal.hidden = true;
  calendarModal.dataset.sessionId = "";
  calendarModal.dataset.activeTab = "";
  body.classList.remove("modal-open");

  if (lastClassSignupTrigger instanceof HTMLElement) {
    lastClassSignupTrigger.focus();
  }
};

const buildPublicCalendarEventMarkup = (event, { includeSignupAction = false } = {}) => {
  const note = String(event.note || "").trim();
  const hasNote = note && note !== "無";
  const sessionId = event.type === "class" ? getClassSessionId(event.source || {}) : "";
  const canOpenSignup = includeSignupAction && sessionId && Boolean(event.source?.signupRequired);
  const signupButton =
    canOpenSignup
      ? `<button class="button-primary" data-public-calendar-session-jump type="button" data-session-id="${escapeHtml(sessionId)}">前往報名</button>`
      : "";

  return `
    <article class="admin-calendar-modal-session calendar-color-border-${escapeHtml(normalizeCalendarColor(event.color))}">
      <div class="admin-calendar-modal-session-head">
        <div>
          <h3 class="admin-calendar-modal-session-title">${escapeHtml(event.title || "未命名內容")}</h3>
        </div>
        ${event.timeLabel ? `<span class="member-row-status">${escapeHtml(event.timeLabel)}</span>` : ""}
      </div>
      ${event.location ? `<p class="admin-calendar-modal-session-copy"><strong>地點：</strong>${escapeHtml(event.location)}</p>` : ""}
      ${hasNote ? `<p class="admin-calendar-modal-session-copy"><strong>備註：</strong>${escapeHtml(note)}</p>` : ""}
      ${signupButton ? `<div class="admin-calendar-modal-session-actions">${signupButton}</div>` : ""}
    </article>
  `;
};

const openPublicCalendarModal = ({ title, subtitle, events = [], includeSignupAction = false }) => {
  const { calendarModal, title: titleNode, subtitle: subtitleNode, list } = getPublicCalendarModalElements();
  if (!calendarModal || !list) {
    return;
  }

  if (titleNode) {
    titleNode.textContent = title;
  }
  if (subtitleNode) {
    subtitleNode.textContent = subtitle;
  }

  list.innerHTML =
    events.length > 0
      ? events.map((event) => buildPublicCalendarEventMarkup(event, { includeSignupAction })).join("")
      : `<p class="admin-calendar-modal-empty">這一天目前沒有內容。</p>`;

  calendarModal.hidden = false;
  body.classList.add("modal-open");

  list.querySelectorAll("[data-public-calendar-session-jump]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId || "";
      closePublicCalendarModal();
      if (sessionId) {
        openClassSignupModal(sessionId, button);
      }
    });
  });
};

const closePublicCalendarModal = () => {
  const { calendarModal } = getPublicCalendarModalElements();
  if (!calendarModal) {
    return;
  }

  calendarModal.hidden = true;
  body.classList.remove("modal-open");
};

const setAdminCalendarEventForm = (event = null, dateKey = "") => {
  const { form, deleteButton, saveButton } = getAdminClassCalendarModalElements();
  if (!form) {
    return;
  }

  form.hidden = false;

  form.reset();
  const eventId = event?.id || "";
  form.querySelector("[name='eventId']").value = eventId;
  const sourceDate = event?.source?.date || event?.source?.sessionDate || dateKey;
  form.querySelector("[name='date']").value = sourceDate;
  form.querySelector("[name='eventType']").value = event?.type || "class";
  form.querySelector("[name='titleZh']").value = event?.source?.titleZh || event?.source?.title || event?.title || "";
  form.querySelector("[name='titleEn']").value = event?.source?.titleEn || "";
  form.querySelector("[name='color']").value = normalizeCalendarColor(event?.color || event?.source?.color || (event?.type === "holiday" ? "orange" : "blue"));
  const legacyTimeParts = getLegacyTimeParts(event?.timeLabel || "");
  form.querySelector("[name='endDate']").value = event?.type && event.type !== "class" ? event?.source?.endDate || sourceDate : "";
  form.querySelector("[name='startTime']").value = event?.source?.startTime || legacyTimeParts.startTime;
  form.querySelector("[name='endTime']").value = event?.source?.endTime || legacyTimeParts.endTime;
  form.querySelector("[name='location']").value = event?.location || event?.source?.location || "";
  form.querySelector("[name='note']").value = event?.note || "";
  form.querySelector("[name='albumUrl']").value = event?.type === "class" ? event?.albumUrl || "" : "";
  const legacyMemberOpenAt = event?.source?.memberSignupOpenAt || event?.source?.signupOpenAt;
  const legacyPublicOpenAt = event?.source?.publicSignupOpenAt || (
    event?.source?.allowNonMembers && legacyMemberOpenAt
      ? new Date(getDateTimeLocalMs(legacyMemberOpenAt) + NON_MEMBER_SIGNUP_DELAY_MS)
      : ""
  );
  form.querySelector("[name='memberSignupOpenAt']").value = event?.type === "class" ? formatDateTimeLocalValue(legacyMemberOpenAt) : "";
  form.querySelector("[name='publicSignupOpenAt']").value = event?.type === "class" ? formatDateTimeLocalValue(legacyPublicOpenAt) : "";
  form.querySelector("[name='signupCloseAt']").value = event?.type === "class" ? formatDateTimeLocalValue(event.source?.signupCloseAt) : "";
  form.querySelector("[name='signupLimit']").value = event?.type === "class" ? event.source?.signupLimit || "" : "";

  const signupRequired = form.querySelector("[name='signupRequired']");
  if (signupRequired instanceof HTMLInputElement) {
    signupRequired.checked = event?.type === "class" ? Boolean(event.source?.signupRequired ?? true) : false;
  }
  const allowNonMembers = form.querySelector("[name='allowNonMembers']");
  if (allowNonMembers instanceof HTMLInputElement) {
    allowNonMembers.checked = event?.type === "class" ? Boolean(event.source?.allowNonMembers) : false;
  }
  const eventTypeSelect = form.querySelector("[name='eventType']");
  if (eventTypeSelect instanceof HTMLSelectElement) {
    eventTypeSelect.disabled = false;
  }
  const signupToggle = form.querySelector(".admin-calendar-signup-toggle");
  const signupSettings = form.querySelector("[data-admin-calendar-signup-settings]");
  const signupPanel = form.querySelector("[data-admin-calendar-signup-panel]");
  const signupFieldsHidden = (event?.type || "class") !== "class";
  const announcementEndDateField = form.querySelector("[data-announcement-end-date-field]");
  const classAlbumField = form.querySelector("[data-class-album-field]");
  if (signupToggle) {
    signupToggle.hidden = signupFieldsHidden;
  }
  if (signupSettings) {
    signupSettings.hidden = signupFieldsHidden || !signupRequired?.checked;
  }
  if (signupPanel) {
    signupPanel.hidden = signupFieldsHidden;
  }
  if (announcementEndDateField) {
    announcementEndDateField.hidden = !signupFieldsHidden;
  }
  if (classAlbumField) {
    classAlbumField.hidden = signupFieldsHidden;
  }

  if (deleteButton) {
    deleteButton.disabled = !eventId;
  }

  const stateNode = form.querySelector("[data-admin-calendar-form-state]");
  if (stateNode) {
    stateNode.textContent = eventId
      ? `目前正在編輯「${event?.title || "未命名內容"}」，儲存後會直接覆蓋原本資料。`
      : "目前為新增模式，可建立社課、公告或連續假期；同一天可以儲存多筆內容。";
  }
  if (saveButton) {
    saveButton.textContent = eventId ? "更新內容" : "儲存";
  }

  form.dataset.editingType = event?.type || "";
  form.dataset.editingId = eventId;
  renderAdminCalendarDefaultShortcuts(form, sourceDate);
};

function renderAdminCalendarDefaultShortcuts(form, dateKey = "") {
  const container = form?.querySelector("[data-admin-calendar-default-shortcuts]");
  if (!container) return;
  if (!classScheduleDefaults.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const weekday = getWeekdayKeyFromDateValue(dateKey);
  const sorted = [...classScheduleDefaults].sort((a, b) => Number(a.weekday !== weekday) - Number(b.weekday !== weekday));
  container.hidden = false;
  container.innerHTML = `
    <span>套用預設社課：</span>
    ${sorted.map((item, index) => `<button class="class-default-shortcut${item.weekday === weekday ? " is-matching-day" : ""}" data-class-default-shortcut="${index}" type="button">${escapeHtml(`${getWeekdayLabel(item.weekday)} ${item.startTime}–${item.endTime} · ${item.signupRequired ? "需報名" : "免報名"}`)}</button>`).join("")}
  `;
  container.querySelectorAll("[data-class-default-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = sorted[Number(button.dataset.classDefaultShortcut)];
      if (!item) return;
      form.querySelector("[name='startTime']").value = item.startTime;
      form.querySelector("[name='endTime']").value = item.endTime;
      if (item.location) form.querySelector("[name='location']").value = item.location;
      if (item.titleZh && !form.querySelector("[name='titleZh']").value) form.querySelector("[name='titleZh']").value = item.titleZh;
      if (item.titleEn && !form.querySelector("[name='titleEn']").value) form.querySelector("[name='titleEn']").value = item.titleEn;
      const signupRequired = form.querySelector("[name='signupRequired']");
      if (signupRequired instanceof HTMLInputElement) signupRequired.checked = item.signupRequired;
      const signupSettings = form.querySelector("[data-admin-calendar-signup-settings]");
      if (signupSettings) signupSettings.hidden = !item.signupRequired;
      form.querySelector("[name='memberSignupOpenAt']").value = item.signupRequired ? getClassDefaultSignupDateTime(item, dateKey, "memberSignupOpen") : "";
      form.querySelector("[name='publicSignupOpenAt']").value = item.signupRequired ? getClassDefaultSignupDateTime(item, dateKey, "publicSignupOpen") : "";
      form.querySelector("[name='signupCloseAt']").value = item.signupRequired ? getClassDefaultSignupDateTime(item, dateKey, "signupClose") : "";
      form.querySelector("[name='signupLimit']").value = item.signupRequired ? item.signupLimit || "" : "";
      showToast("已套用預設社課與報名設定。", { tone: "success" });
    });
  });
}

const openAdminClassCalendarModal = (dateKey, trigger = null) => {
  const { calendarModal, title, subtitle, list, form } = getAdminClassCalendarModalElements();
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
  const events = getAdminCalendarEventsForDate(dateKey);

  title.textContent = dateLabel || "行事曆";
  subtitle.textContent = weekdayLabel ? `${weekdayLabel} · ${events.length} 筆內容` : `${events.length} 筆內容`;

  list.innerHTML = `
      <div class="admin-calendar-modal-list-header">
        <p class="content-copy">${events.length ? "選擇既有內容進行編輯，或新增同一天的另一筆內容。" : "這一天目前沒有社課、公告或連續假期。"}</p>
        <button class="button-primary" data-admin-calendar-event-add type="button">新增內容</button>
      </div>
      ${events.length ? `
      ${events
        .map((event) => {
          return `
            <button class="admin-calendar-event-chip is-${escapeHtml(event.type)} calendar-color-border-${escapeHtml(normalizeCalendarColor(event.color))}" data-admin-calendar-event-edit type="button" data-event-type="${escapeHtml(event.type)}" data-event-id="${escapeHtml(event.id)}">
              <strong>${escapeHtml(event.title)}</strong>
              <small>${event.timeLabel ? escapeHtml(event.timeLabel) : "不指定時間"}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</small>
            </button>
          `;
        })
        .join("")}` : ""}
    `;

  if (form) {
    form.reset();
    form.hidden = true;
    form.querySelector("[name='date']").value = dateKey;
  }

  calendarModal.hidden = false;
  body.classList.add("modal-open");
  bindAdminClassCalendarActions();

  window.setTimeout(() => {
    form?.querySelector("[name='titleZh']")?.focus();
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
  const normalizedLanguage = lang === "en" ? "en" : "zh-Hant";
  document.documentElement.lang = normalizedLanguage;
  body.dataset.language = normalizedLanguage;

  languageSelects.forEach((select) => {
    select.value = normalizedLanguage;
  });

  applyPageLanguage(normalizedLanguage);
  renderHomeClassSchedule();
  if (announcementPageState.loaded) renderAnnouncementsBoard(announcementPageState.announcements);
  if (classSignupPageState.loaded) {
    renderClassCalendarBoard(classSignupPageState.sessions);
    renderClassRosterBoard(classSignupPageState.sessions);
  }
  if (membersDashboardCache.loaded) {
    renderAdminClassCalendarCompact(membersDashboardCache.classSessions, membersDashboardCache.classSessionSignups);
  }
  window.localStorage.setItem(STORAGE_KEYS.language, normalizedLanguage);
};

const syncMemberProfile = async (user, source, profile = {}) => {
  if (!db || !user?.uid) {
    return;
  }

  const adminDoc = await getDoc(getAdminDocRef(user.uid));
  if (adminDoc.exists()) {
    return;
  }

  const memberRef = getMemberDocRef(user.uid);
  const existingDoc = await getDoc(memberRef);
  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const legacyApprovedMembers =
    currentUserIsAdmin && normalizedEmail
      ? await getDocs(query(collection(db, "members"), where("email", "==", normalizedEmail)))
      : null;

  const payload = {
    uid: user.uid,
    email: user.email || "",
    source,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (profile.name || profile.studentId || profile.department || profile.phone) {
    const membershipIntent = profile.membershipIntent === "join" ? "join" : "not_join";
    const membershipStatus = membershipIntent === "join" ? "pending_payment" : "not_applied";
    payload.name = profile.name || "";
    payload.studentId = profile.studentId || "";
    payload.department = profile.department || "";
    payload.school = profile.department || "";
    payload.phone = profile.phone || "";
    payload.academicYear = getConfiguredAcademicYear();
    payload.term = getConfiguredAcademicTerm();
    payload.membershipIntent = membershipIntent;
    payload.membershipStatus = membershipStatus;
    payload.status = membershipStatus;
    payload.paymentStatus = "unpaid";
    payload.paymentMethod = membershipIntent === "join" ? profile.paymentMethod || "later" : "none";
    payload.cashPaymentSlot = membershipIntent === "join" && profile.paymentMethod === "cash" ? profile.cashPaymentSlot || "" : "";
    payload.transferAt = membershipIntent === "join" && profile.paymentMethod === "transfer" ? profile.transferAt || "" : "";
    payload.transferLastFive = membershipIntent === "join" && profile.paymentMethod === "transfer" ? profile.transferLastFive || "" : "";
    payload.paymentSubmittedAt = membershipIntent === "join" ? serverTimestamp() : null;
  }

  if (!existingDoc.exists()) {
    payload.createdAt = serverTimestamp();
    payload.status = profile.name && profile.membershipIntent === "join" ? "pending_payment" : "not_applied";
    payload.membershipStatus = payload.status;
    payload.paymentStatus = "unpaid";
  }

  await setDoc(memberRef, payload, { merge: true });

  if (legacyApprovedMembers) {
    await Promise.all(
      legacyApprovedMembers.docs
        .filter((docSnapshot) => docSnapshot.id !== user.uid)
        .map(async (docSnapshot) => {
          await setDoc(memberRef, docSnapshot.data(), { merge: true });
          await deleteDoc(docSnapshot.ref);
        }),
    );
  }
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

const isValidAcademicYearValue = (value) => /^\d{2,3}$/.test(String(value || "").trim());

const getConfiguredAcademicYear = () => {
  if (isValidAcademicYearValue(configuredAcademicYear)) {
    return String(configuredAcademicYear).trim();
  }

  const storedYears = getStoredAdminAcademicYears();
  return storedYears[0] || String(Math.max(getRocAcademicYear(), MIN_ACADEMIC_YEAR));
};

const getDefaultAcademicTerm = (date = new Date()) => {
  const month = date.getMonth() + 1;
  return month >= 8 || month <= 1 ? "上學期" : "下學期";
};

const getAcademicPeriodForDate = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const academicYear = String(month >= 8 ? date.getFullYear() - 1911 : date.getFullYear() - 1912);
  const term = month >= 2 && month < 8 ? "下學期" : "上學期";
  return {
    academicYear,
    term,
    key: `${academicYear}-${term}`,
  };
};

const getConfiguredAcademicTerm = () =>
  DEFAULT_TERMS.slice(0, 2).includes(configuredAcademicTerm) ? configuredAcademicTerm : getDefaultAcademicTerm();

const loadCurrentTermSettings = async () => {
  if (!db) {
    return;
  }

  try {
    const settingsDoc = await getDoc(getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC));
    const settingsData = settingsDoc.exists() ? settingsDoc.data() : {};
    const storedMaintenance = settingsData?.maintenance || {};
    maintenanceSettings = {
      enabled: storedMaintenance.enabled === true,
      title: String(storedMaintenance.title || DEFAULT_MAINTENANCE_SETTINGS.title).trim(),
      message: String(storedMaintenance.message || DEFAULT_MAINTENANCE_SETTINGS.message).trim(),
      estimatedResumeAt: String(storedMaintenance.estimatedResumeAt || "").trim(),
    };
    const academicYear = String(settingsData?.academicYear || "").trim();
    const term = String(settingsData?.term || "").trim();
    configuredAcademicPeriodKey = String(settingsData?.academicPeriodKey || "").trim();
    if (isValidAcademicYearValue(academicYear)) {
      configuredAcademicYear = academicYear;
      saveAdminAcademicYears(Array.from(new Set([academicYear, ...getStoredAdminAcademicYears()])).sort((a, b) => Number(b) - Number(a)));
    }
    if (DEFAULT_TERMS.slice(0, 2).includes(term)) {
      configuredAcademicTerm = term;
    }
    if (!memberFiltersInitializedFromSettings) {
      memberFilters.year = getConfiguredAcademicYear();
      memberFilters.term = getConfiguredAcademicTerm();
      memberFiltersInitializedFromSettings = true;
      patchMembersFilterUI();
    }
    membershipPaymentSettings = {
      ...membershipPaymentSettings,
      bankName: String(settingsData?.membershipPayment?.bankName || "").trim(),
      bankCode: String(settingsData?.membershipPayment?.bankCode || "").trim(),
      accountName: String(settingsData?.membershipPayment?.accountName || "").trim(),
      accountNumber: String(settingsData?.membershipPayment?.accountNumber || "").trim(),
      cashPaymentOptions: getCashPaymentOptionsFromSettings(settingsData?.membershipPayment || {}),
    };
    const membershipRegistration = settingsData?.membershipRegistration || {};
    membershipRegistrationSettings = {
      openAt: formatDateTimeLocalValue(membershipRegistration.openAt),
      closeAt: formatDateTimeLocalValue(membershipRegistration.closeAt),
      limit: Math.max(0, Math.floor(Number(membershipRegistration.limit || 0))),
      count: 0,
      registrationSequence: 0,
      waitlistSequence: 0,
    };
    if (isValidAcademicYearValue(configuredAcademicYear) && DEFAULT_TERMS.slice(0, 2).includes(configuredAcademicTerm)) {
      const statsSnapshot = await getDoc(doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, getMembershipRegistrationPeriodId()));
      if (statsSnapshot.exists()) {
        membershipRegistrationSettings.count = Math.max(0, Number(statsSnapshot.data()?.count || 0));
        membershipRegistrationSettings.registrationSequence = Math.max(0, Number(statsSnapshot.data()?.registrationSequence || 0));
        membershipRegistrationSettings.waitlistSequence = Math.max(0, Number(statsSnapshot.data()?.waitlistSequence || 0));
      }
    }
    classScheduleDefaults = Array.isArray(settingsData?.classScheduleDefaults)
      ? settingsData.classScheduleDefaults.map(normalizeClassScheduleDefault).filter(Boolean)
      : [];
    renderHomeClassSchedule();
    document.querySelectorAll("[data-login-form], [data-account-membership-form]").forEach(syncMembershipPaymentForm);
    syncMembershipPaymentSettingForm();
    syncMembershipRegistrationSettingForm();
    syncMaintenanceSettingForm();
    renderClassDefaultSettings();
    applyMaintenanceView();
  } catch (error) {
    console.warn("Load current term settings failed:", error);
  }
};

const applyAcademicPeriodRolloverIfNeeded = async () => {
  if (!db || !currentUserIsAdmin) {
    return false;
  }

  const targetPeriod = getAcademicPeriodForDate();
  if (configuredAcademicPeriodKey === targetPeriod.key) {
    return false;
  }

  const membersSnapshot = await getDocs(collection(db, "members"));
  const formalMembers = membersSnapshot.docs.filter(
    (snapshot) => getManagedMembershipStatus(snapshot.data()) === "formal_member",
  );

  for (let index = 0; index < formalMembers.length; index += 200) {
    const batch = writeBatch(db);
    formalMembers.slice(index, index + 200).forEach((snapshot) => {
      const member = snapshot.data();
      batch.set(
        snapshot.ref,
        {
          membershipStatus: "former_member",
          status: "former_member",
          membershipStatusChange: {
            previousStatus: "formal_member",
            nextStatus: "former_member",
            changedAt: serverTimestamp(),
            changedBy: currentUser?.uid || "system-rollover",
          },
          membershipIntent: "not_join",
          paymentStatus: "unpaid",
          paymentMethod: "none",
          cashPaymentSlot: "",
          transferAt: "",
          transferLastFive: "",
          academicYear: targetPeriod.academicYear,
          term: targetPeriod.term,
          formerMemberAt: serverTimestamp(),
          academicPeriodRolloverAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      const email = String(member.email || "").trim().toLowerCase();
      if (email) {
        batch.delete(getApprovalDocRef(email));
      }
    });
    await batch.commit();
  }

  await setDoc(
    getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC),
    {
      academicYear: targetPeriod.academicYear,
      term: targetPeriod.term,
      academicPeriodKey: targetPeriod.key,
      academicPeriodStartedAt: serverTimestamp(),
      academicPeriodUpdatedBy: currentUser?.uid || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  configuredAcademicYear = targetPeriod.academicYear;
  configuredAcademicTerm = targetPeriod.term;
  configuredAcademicPeriodKey = targetPeriod.key;
  memberFilters.year = targetPeriod.academicYear;
  memberFilters.term = targetPeriod.term;
  membersDashboardCache.loaded = false;
  syncAcademicYearSetting();
  patchMembersFilterUI();
  return true;
};

const buildAcademicYearOptions = () => {
  const configuredYear = getConfiguredAcademicYear();
  const baseYear = Math.max(Number(configuredYear), getRocAcademicYear(), MIN_ACADEMIC_YEAR);
  return Array.from(new Set(["all", configuredYear, ...Array.from({ length: 6 }, (_, index) => String(baseYear + 1 - index)), "未設定"]));
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

const getAcademicTermLabel = (value) => {
  if (value === "上學期") {
    return "第一學期";
  }
  if (value === "下學期") {
    return "第二學期";
  }
  return value || "未設定";
};

const getMemberAcademicYearOptionsMarkup = (selectedValue) => {
  const selected = isValidAcademicYearValue(selectedValue) ? String(selectedValue) : getConfiguredAcademicYear();
  const years = Array.from(
    new Set([selected, getConfiguredAcademicYear(), ...getStoredAdminAcademicYears(), ...buildAdminAcademicYearOptions()]),
  )
    .filter(isValidAcademicYearValue)
    .sort((a, b) => Number(b) - Number(a));
  return years
    .map((year) => `<option value="${escapeHtml(year)}"${year === selected ? " selected" : ""}>${escapeHtml(getAcademicYearLabel(year))}</option>`)
    .join("");
};

const getMemberAcademicTermOptionsMarkup = (selectedValue) => {
  const selected = DEFAULT_TERMS.slice(0, 2).includes(selectedValue) ? selectedValue : getConfiguredAcademicTerm();
  return DEFAULT_TERMS.slice(0, 2)
    .map((term) => `<option value="${escapeHtml(term)}"${term === selected ? " selected" : ""}>${escapeHtml(getAcademicTermLabel(term))}</option>`)
    .join("");
};

const backfillUnsetMemberAcademicPeriods = async (members = [], academicYear = configuredAcademicYear, term = configuredAcademicTerm) => {
  if (!currentUserIsAdmin || !isValidAcademicYearValue(academicYear) || !DEFAULT_TERMS.slice(0, 2).includes(term)) {
    return 0;
  }
  const pendingMembers = members
    .map((member) => {
      const update = {};
      if (!isValidAcademicYearValue(member.academicYear)) update.academicYear = academicYear;
      if (!DEFAULT_TERMS.slice(0, 2).includes(member.term)) update.term = term;
      return Object.keys(update).length && member.id ? { member, update } : null;
    })
    .filter(Boolean);

  for (let index = 0; index < pendingMembers.length; index += 200) {
    const entries = pendingMembers.slice(index, index + 200);
    const batch = writeBatch(db);
    entries.forEach(({ member, update }) => {
      batch.set(
        getMemberDocRef(member.id),
        { ...update, academicPeriodBackfilledAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
    await batch.commit();
    entries.forEach(({ member, update }) => Object.assign(member, update));
  }
  return pendingMembers.length;
};

const matchesMemberFilter = (entry) => {
  const yearValue = entry.academicYear || "未設定";
  const termValue = entry.term || "未設定";

  const yearMatch = memberFilters.year === "all" || yearValue === memberFilters.year;
  const termMatch = memberFilters.term === "all" || termValue === memberFilters.term;
  const status = getManagedMembershipStatus(entry);
  const category = status === "formal_member"
    ? "member"
    : getMembershipIntentFromProfile(entry) === "join"
      ? "applicant"
      : "non_member";
  const categoryMatch = memberFilters.category === "all" || category === memberFilters.category;
  const queryValue = memberFilters.query.trim().toLocaleLowerCase("zh-TW");
  const queryMatch =
    !queryValue ||
    [entry.name, entry.studentId, entry.department, entry.school, entry.email, entry.gmail, entry.phone]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-TW")
      .includes(queryValue);
  return yearMatch && termMatch && categoryMatch && queryMatch;
};

const renderFilteredMemberViews = () => {
  if (!membersDashboardCache.loaded) {
    void refreshMembersDashboardSafe();
    return;
  }

  const displayMembers = mergeMembersWithApprovedApplications(membersDashboardCache.members);
  renderMembersSummary(displayMembers);
  renderMembersExportToolbar(displayMembers);
  renderMembersList(displayMembers);
};

const initMembersFilters = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");
  const categorySelect = document.querySelector("[data-filter-category]");
  const queryInput = document.querySelector("[data-filter-query]");

  if (!yearSelect || !termSelect || yearSelect.dataset.initialized === "true") {
    return;
  }

  yearSelect.addEventListener("change", () => {
    memberFilters.year = yearSelect.value;
    renderFilteredMemberViews();
  });

  termSelect.addEventListener("change", () => {
    memberFilters.term = termSelect.value;
    renderFilteredMemberViews();
  });

  categorySelect?.addEventListener("change", () => {
    memberFilters.category = categorySelect.value;
    renderFilteredMemberViews();
  });

  queryInput?.addEventListener("input", () => {
    memberFilters.query = queryInput.value;
    renderFilteredMemberViews();
  });

  yearSelect.dataset.initialized = "true";
};

const patchMembersFilterUI = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");
  const categorySelect = document.querySelector("[data-filter-category]");
  const queryInput = document.querySelector("[data-filter-query]");

  if (queryInput instanceof HTMLInputElement && queryInput.value !== memberFilters.query) {
    queryInput.value = memberFilters.query;
  }

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

  if (categorySelect) {
    const options = [
      { value: "all", label: "全部身分" },
      { value: "member", label: "社員" },
      { value: "applicant", label: "申請成為社員" },
      { value: "non_member", label: "非社員" },
    ];
    categorySelect.innerHTML = options
      .map(({ value, label }) => `<option value="${value}"${value === memberFilters.category ? " selected" : ""}>${label}</option>`)
      .join("");
  }
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
    (activeElement.closest("[data-members-list]") ||
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

const bindMemberActionButtons = (memberList) => {
  memberList.querySelectorAll("[data-member-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const memberId = button.dataset.memberId;
      const action = button.dataset.memberAction;
      const origin = button.dataset.memberOrigin || "members";
      const email = String(button.dataset.memberEmail || "").trim().toLowerCase();
      const applicationId = String(button.dataset.memberApplicationId || "").trim();

      if (!memberId) {
        return;
      }

      if (action === "toggle-membership-payment") {
        const nextPaymentStatus = button.dataset.paymentStatus === "paid" ? "paid" : "unpaid";
        const isPaid = nextPaymentStatus === "paid";
        const confirmed = window.confirm(isPaid ? "要將這位成員標記為社費已繳並成為正式社員嗎？" : "要取消這位成員的正式社員資格嗎？");
        if (!confirmed) {
          return;
        }

        const previousStatus = getManagedMembershipStatus(
          membersDashboardCache.members.find((member) => member.id === memberId) || "non_member",
        );
        const nextMembershipStatus = isPaid ? "formal_member" : "pending_payment";
        button.disabled = true;
        try {
          await setDoc(
            getMemberDocRef(memberId),
            {
              paymentStatus: nextPaymentStatus,
              membershipStatus: nextMembershipStatus,
              status: nextMembershipStatus,
              membershipStatusChange: {
                previousStatus,
                nextStatus: nextMembershipStatus,
                changedAt: serverTimestamp(),
                changedBy: currentUser?.uid || "",
              },
              paidAt: isPaid ? serverTimestamp() : null,
              paymentConfirmedAt: isPaid ? serverTimestamp() : null,
              paymentConfirmedBy: isPaid ? currentUser?.uid || "" : "",
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          if (email) {
            if (isPaid) {
              await setDoc(
                getApprovalDocRef(email),
                {
                  email,
                  status: "approved",
                  approvedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            } else {
              const approvalDoc = await getDoc(getApprovalDocRef(email));
              if (approvalDoc.exists()) {
                await deleteDoc(getApprovalDocRef(email));
              }
            }
          }

          await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
          showToast(isPaid ? "社費已確認，社員狀態已更新。" : "社費確認已取消。", { tone: "success" });
        } catch (error) {
          console.error("Update membership payment failed:", error);
          window.alert(`更新社費狀態失敗：${error?.message || "請稍後再試一次。"}`);
        } finally {
          button.disabled = false;
        }
        return;
      }

      if (action !== "delete") {
        return;
      }

      const confirmed = window.confirm("Delete this member record?");
      if (!confirmed) {
        return;
      }

      const collectionName = origin === "applications" ? "applications" : "members";
      await deleteDoc(doc(db, collectionName, memberId));
      if (email) {
        const approvalDoc = await getDoc(getApprovalDocRef(email));
        if (approvalDoc.exists()) {
          await deleteDoc(getApprovalDocRef(email));
        }
      }
      if (applicationId && collectionName !== "applications") {
        const applicationDoc = await getDoc(doc(db, "applications", applicationId));
        if (applicationDoc.exists()) {
          await deleteDoc(doc(db, "applications", applicationId));
        }
      }
      await refreshMembersDashboardSafe({ force: true });
    });
  });
};

const bindMemberEditForms = (memberList) => {
  memberList.querySelectorAll("[data-member-edit-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const memberId = String(form.dataset.memberId || "").trim();
      const submitButton = form.querySelector("[data-member-edit-save]");
      const values = Object.fromEntries(new FormData(form));
      const payload = {
        name: String(values.name || "").trim(),
        studentId: String(values.studentId || "").trim().toUpperCase(),
        school: String(values.school || "").trim(),
        department: String(values.department || "").trim(),
        phone: String(values.phone || "").trim(),
        academicYear: String(values.academicYear || "").trim(),
        term: String(values.term || "").trim(),
      };
      if (
        !memberId ||
        !payload.name ||
        !payload.studentId ||
        !payload.school ||
        payload.school.length > 100 ||
        !payload.department ||
        !payload.phone ||
        !isValidAcademicYearValue(payload.academicYear) ||
        !DEFAULT_TERMS.slice(0, 2).includes(payload.term)
      ) {
        showToast("請完整填寫社員姓名、學號、學校、系別、電話、學年度與學期。", { tone: "error" });
        return;
      }
      setButtonLoading(submitButton, true, "儲存中…");
      try {
        await setDoc(getMemberDocRef(memberId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
        showToast("社員資料已更新。", { tone: "success" });
      } catch (error) {
        showToast(error?.message || "社員資料更新失敗。", { tone: "error" });
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
  });
};
const getDashboardAdminIds = () =>
  new Set(
    [
      ...(membersDashboardCache.admins || []).flatMap((admin) => [admin.id, admin.uid]),
      currentUserIsAdmin ? currentUser?.uid : "",
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

const compactMembershipApplicationPositions = (members = []) => {
  const updates = [];
  const periodKeys = new Set(members.map((member) => `${member.academicYear || "未設定"}:${member.term || "未設定"}`));
  periodKeys.forEach((key) => {
    const [academicYear, term] = key.split(":");
    const inPeriod = (member) => String(member.academicYear || "未設定") === academicYear && String(member.term || "未設定") === term;
    const accepted = members
      .filter((member) => inPeriod(member)
        && getMembershipIntentFromProfile(member) === "join"
        && !["officer", "admin", "membership_waitlisted"].includes(getManagedMembershipStatus(member)))
      .sort((a, b) => getTimestampMs(a.paymentSubmittedAt || a.submittedAt || a.createdAt) - getTimestampMs(b.paymentSubmittedAt || b.submittedAt || b.createdAt));
    const waitlisted = members
      .filter((member) => inPeriod(member) && getManagedMembershipStatus(member) === "membership_waitlisted")
      .sort((a, b) => getTimestampMs(a.membershipWaitlistedAt || a.updatedAt || a.createdAt) - getTimestampMs(b.membershipWaitlistedAt || b.updatedAt || b.createdAt));
    accepted.forEach((member, index) => {
      const position = index + 1;
      if (getMembershipRegistrationPosition(member) !== position) {
        member.membershipRegistrationPosition = position;
        updates.push({ member, field: "membershipRegistrationPosition", position });
      }
    });
    waitlisted.forEach((member, index) => {
      const position = index + 1;
      if (Math.floor(Number(member.membershipWaitlistPosition || 0)) !== position) {
        member.membershipWaitlistPosition = position;
        updates.push({ member, field: "membershipWaitlistPosition", position });
      }
    });
  });
  return updates;
};

const mergeMembersWithApprovedApplications = (members = []) => {
  const adminIds = getDashboardAdminIds();
  const normalizedMembers = members
    .filter(
      (member) =>
        ![member.id, member.uid]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .some((value) => adminIds.has(value)),
    )
    .map((member) => ({ ...member, origin: "members" }));

  compactMembershipApplicationPositions(normalizedMembers);

  return normalizedMembers.sort(
      (a, b) =>
        getTimestampMs(a.submittedAt || a.createdAt || a.approvedAt) -
        getTimestampMs(b.submittedAt || b.createdAt || b.approvedAt),
    );
};

const getFilteredMembersForExport = (members = []) => members.filter(matchesMemberFilter);
const getMemberFilterCategoryLabel = () => ({
  all: "全部身分",
  member: "社員",
  applicant: "申請成為社員",
  non_member: "非社員",
})[memberFilters.category] || "全部身分";

const buildClassSignupWorksheetMarkup = (name, session, signups = [], membersById = {}) => {
  const columns = ["姓名", "學號", "Email", "報名狀態", "候補順位", "零打費", "備註", "報名時間"];
  const rows = signups.map((signup, index) => {
    const member = membersById[signup.userId] || null;
    const computedStatus = getComputedSignupStatus(signup, index, session);
    const position = computedStatus === "waitlisted" ? Math.max(0, Number(signup.waitlistPosition || 0)) : 0;
    return [
      signup.name || "",
      signup.studentId || "",
      signup.email || "",
      getSignupStatusLabel({ ...signup, signupStatus: computedStatus }),
      position || "",
      getSignupPaymentLabel(signup, member),
      signup.note || "",
      formatTimestamp(signup.createdAt || signup.submittedAt),
    ];
  });
  const allRows = [
    [`${session.title || "社課"}－${name}`],
    ["社課時間", [getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" / ")],
    ["匯出時間", new Date().toLocaleString("zh-TW")],
    ["人數", String(rows.length)],
    [""],
    columns,
    ...rows,
  ];
  const rowMarkup = allRows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeSpreadsheetXml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${escapeSpreadsheetXml(name)}"><Table>${rowMarkup}</Table></Worksheet>`;
};

const buildClassSignupExportWorkbook = (session, signups = []) => {
  const membersById = Object.fromEntries(membersDashboardCache.members.map((member) => [member.uid || member.id, member]));
  const sortedSignups = [...signups]
    .sort((a, b) => getTimestampMs(a.createdAt || a.submittedAt) - getTimestampMs(b.createdAt || b.submittedAt))
    .map((signup, index) => ({ ...signup, signupStatus: getComputedSignupStatus(signup, index, session) }));
  const memberSignups = sortedSignups.filter((signup) => isFormalMemberSignup(signup, membersById[signup.userId] || null));
  const nonMemberSignups = sortedSignups.filter((signup) => !isFormalMemberSignup(signup, membersById[signup.userId] || null));
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${buildClassSignupWorksheetMarkup("社員", session, memberSignups, membersById)}
 ${buildClassSignupWorksheetMarkup("非社員", session, nonMemberSignups, membersById)}
</Workbook>`;
};

const isClassSignupExportAvailable = (session = {}) => {
  return isClassSignupWindowClosed(session);
};

const downloadClassSignupExcel = (session, signups = []) => {
  if (!isClassSignupExportAvailable(session)) throw new Error("報名截止後才能匯出名單。");
  const workbook = buildClassSignupExportWorkbook(session, signups);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const sessionDate = String(session.date || session.sessionDate || "session").replaceAll(/[^0-9-]/g, "");
  link.href = url;
  link.download = `ntust-class-signups-${sessionDate || "session"}-${formatExportTimestamp()}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const getMemberStatusOptionsMarkup = (status) => {
  const selectedStatus = getManagedMembershipStatus(status);
  const options = [
    { value: "non_member", label: "非社員" },
    { value: "former_member", label: "前社員" },
    { value: "formal_member", label: "社員" },
    { value: "officer", label: "幹部" },
    { value: "admin", label: "管理員" },
  ];
  if (["pending_payment", "membership_waitlisted"].includes(selectedStatus)) {
    options.unshift({
      value: selectedStatus,
      label: selectedStatus === "pending_payment" ? "待繳社費" : "社員候補",
    });
  }
  return options
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === selectedStatus ? " selected" : ""}>${option.label}</option>`,
    )
    .join("");
};

const bindMemberStatusSelects = (container) => {
  container.querySelectorAll("[data-member-status-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      const memberId = String(select.dataset.memberId || "").trim();
      const email = String(select.dataset.memberEmail || "").trim().toLowerCase();
      const previousStatus = getManagedMembershipStatus(select.dataset.currentStatus || "non_member");
      const nextStatus = getManagedMembershipStatus(select.value);
      if (!memberId || nextStatus === previousStatus) {
        return;
      }

      const isAdmin = nextStatus === "admin";
      const isOfficer = nextStatus === "officer";
      const isFormalMember = nextStatus === "formal_member";
      const isFormerMember = nextStatus === "former_member";
      const memberUpdate = {
        membershipIntent: isFormalMember ? "join" : "not_join",
        membershipStatus: nextStatus,
        status: nextStatus,
        officerPreviousMembershipStatus: isOfficer ? previousStatus : null,
        officerPreviousMembershipIntent: isOfficer
          ? getMembershipIntentFromProfile(
            membersDashboardCache.members.find((member) => member.id === memberId || member.uid === memberId) || {},
          )
          : null,
        membershipStatusChange: {
          previousStatus,
          nextStatus,
          changedAt: serverTimestamp(),
          changedBy: currentUser?.uid || "",
        },
        paymentStatus: isAdmin || isOfficer ? "not_required" : isFormalMember ? "paid" : "unpaid",
        paidAt: isFormalMember ? serverTimestamp() : null,
        paymentConfirmedAt: isFormalMember ? serverTimestamp() : null,
        paymentConfirmedBy: isFormalMember ? currentUser?.uid || "" : "",
        formerMemberAt: isFormerMember ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      };
      select.disabled = true;

      try {
        const academicYear = getConfiguredAcademicYear();
        const term = getConfiguredAcademicTerm();
        const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
        const nextCount = await runTransaction(db, async (transaction) => {
          const memberRef = getMemberDocRef(memberId);
          const [memberSnapshot, statsSnapshot] = await Promise.all([
            transaction.get(memberRef),
            transaction.get(statsRef),
          ]);
          if (!memberSnapshot.exists()) throw new Error("找不到這筆社員資料。");

          const beforeMember = memberSnapshot.data() || {};
          const afterMember = { ...beforeMember, ...memberUpdate };
          const beforeOccupies = doesMemberOccupyMembershipSlot(beforeMember, academicYear, term);
          const afterOccupies = previousStatus === "admin" && !isAdmin
            ? doesMembershipProfileOccupySlot(afterMember, academicYear, term)
            : doesMemberOccupyMembershipSlot(afterMember, academicYear, term);
          let count = statsSnapshot.exists() ? Math.max(0, Number(statsSnapshot.data()?.count || 0)) : 0;
          if (beforeOccupies !== afterOccupies) {
            count = Math.max(0, count + (afterOccupies ? 1 : -1));
            const statsLimit = statsSnapshot.exists()
              ? Math.max(0, Number(statsSnapshot.data()?.limit || 0))
              : membershipRegistrationSettings.limit;
            transaction.set(statsRef, {
              academicYear,
              term,
              count,
              limit: statsLimit,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }

          transaction.set(memberRef, memberUpdate, { merge: true });
          if (isAdmin) {
            transaction.set(
            getAdminDocRef(memberId),
            {
              uid: memberId,
              email,
              role: "admin",
              updatedAt: serverTimestamp(),
              updatedBy: currentUser?.uid || "",
            },
            { merge: true },
          );
          } else {
            transaction.delete(getAdminDocRef(memberId));
          }
          if (email) {
            if (isFormalMember) {
              transaction.set(
              getApprovalDocRef(email),
              {
                email,
                status: "approved",
                approvedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
            } else {
              transaction.delete(getApprovalDocRef(email));
            }
          }
          return count;
        });
        membershipRegistrationSettings.count = nextCount;
        syncMembershipRegistrationSettingForm();
        const cachedAdmins = (membersDashboardCache.admins || []).filter(
          (admin) => admin.id !== memberId && admin.uid !== memberId,
        );
        membersDashboardCache.admins = isAdmin
          ? [...cachedAdmins, { id: memberId, uid: memberId, email, role: "admin" }]
          : cachedAdmins;

        const cachedMember = membersDashboardCache.members.find((member) => member.id === memberId);
        if (cachedMember) {
          Object.assign(cachedMember, {
            membershipStatus: nextStatus,
            status: nextStatus,
            paymentStatus: memberUpdate.paymentStatus,
          });
        }
        const displayMembers = mergeMembersWithApprovedApplications(membersDashboardCache.members);
        renderMembersSummary(displayMembers);
        renderMembersExportToolbar(displayMembers);
        renderMembersList(displayMembers);
        renderOfficerRoster();
        renderAdminRoster();
        showToast(`${email || "這筆帳號"} 已設定為「${getMembershipStatusCopy(nextStatus).label}」。`, { tone: "success" });
      } catch (error) {
        console.error("Update member status failed:", error);
        select.value = previousStatus;
        window.alert(`社員狀態更新失敗：${error?.message || "請稍後再試一次。"}`);
      } finally {
        select.disabled = false;
      }
    });
  });
};

const bindMemberDeleteButtons = (container) => {
  container.querySelectorAll("[data-member-account-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const memberId = String(button.dataset.memberId || "").trim();
      const email = String(button.dataset.memberEmail || "").trim().toLowerCase();
      if (!memberId || !email || !currentUser || !currentUserIsAdmin) {
        return;
      }

      const confirmed = window.confirm(
        `確定要刪除 ${email} 的社員資料嗎？\n\n這會刪除 Firestore 中的社員資料、管理員資格、核准紀錄、入社申請與社課報名。Firebase Authentication 登入帳號不會被刪除，仍需到 Firebase Console 手動處理。`,
      );
      if (!confirmed) {
        return;
      }

      const rowControls = button.closest("tr")?.querySelectorAll("button, select") || [];
      rowControls.forEach((control) => {
        control.disabled = true;
      });
      const originalLabel = button.textContent;
      button.textContent = "刪除中…";

      try {
        const [applicationsSnapshot, signupsSnapshot, publicRosterSnapshot] = await Promise.all([
          getDocs(query(collection(db, "applications"), where("email", "==", email))),
          getDocs(query(collection(db, CLASS_SIGNUP_COLLECTION), where("userId", "==", memberId))),
          getDocs(query(collection(db, CLASS_PUBLIC_ROSTER_COLLECTION), where("userId", "==", memberId))),
        ]);
        const batch = writeBatch(db);
        batch.delete(doc(db, "members", memberId));
        batch.delete(doc(db, "admins", memberId));
        batch.delete(getApprovalDocRef(email));
        applicationsSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
        signupsSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
        publicRosterSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
        await batch.commit();

        membersDashboardCache.members = membersDashboardCache.members.filter((member) => member.id !== memberId);
        membersDashboardCache.admins = (membersDashboardCache.admins || []).filter(
          (admin) => admin.id !== memberId && admin.uid !== memberId,
        );
        await refreshMembersDashboardSafe({ force: true });
        openActionSuccessModal({
          title: "社員資料已刪除",
          copy: `${email} 的 Firestore 社員資料已刪除。若也要移除登入帳號，請到 Firebase Console 的 Authentication 使用者清單手動刪除。`,
        });
      } catch (error) {
        console.error("Delete member Firestore data failed:", error);
        rowControls.forEach((control) => {
          control.disabled = false;
        });
        button.textContent = originalLabel;
        window.alert(`刪除社員資料失敗：${error?.message || "請稍後再試一次。"}`);
      }
    });
  });
};

const addOfficer = async (memberId) => {
  const cachedMember = membersDashboardCache.members.find(
    (member) => [member.id, member.uid].map((value) => String(value || "").trim()).includes(memberId),
  );
  if (!cachedMember) throw new Error("找不到這個註冊帳號。");

  const academicYear = getConfiguredAcademicYear();
  const term = getConfiguredAcademicTerm();
  const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
  const result = await runTransaction(db, async (transaction) => {
    const memberRef = getMemberDocRef(memberId);
    const [memberSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(statsRef),
    ]);
    if (!memberSnapshot.exists()) throw new Error("找不到這個註冊帳號的社員資料。");

    const beforeMember = { id: memberId, ...(memberSnapshot.data() || {}) };
    const previousStatus = getManagedMembershipStatus(beforeMember);
    if (previousStatus === "admin") throw new Error("管理員帳號不需要再設定為幹部。");
    const email = String(beforeMember.email || cachedMember.email || "").trim().toLowerCase();
    const beforeOccupies = doesMemberOccupyMembershipSlot(beforeMember, academicYear, term);
    let count = statsSnapshot.exists()
      ? Math.max(0, Number(statsSnapshot.data()?.count || 0))
      : membershipRegistrationSettings.count;
    if (beforeOccupies) {
      count = Math.max(0, count - 1);
      transaction.set(statsRef, {
        academicYear,
        term,
        count,
        limit: statsSnapshot.exists()
          ? Math.max(0, Number(statsSnapshot.data()?.limit || membershipRegistrationSettings.limit || 0))
          : membershipRegistrationSettings.limit,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(memberRef, {
      membershipIntent: "not_join",
      membershipStatus: "officer",
      status: "officer",
      paymentStatus: "not_required",
      officerPreviousMembershipStatus: previousStatus,
      officerPreviousMembershipIntent: getMembershipIntentFromProfile(beforeMember),
      officerPreviousPaymentStatus: String(beforeMember.paymentStatus || "unpaid"),
      membershipStatusChange: {
        previousStatus,
        nextStatus: "officer",
        changedAt: serverTimestamp(),
        changedBy: currentUser?.uid || "",
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (email) transaction.delete(getApprovalDocRef(email));
    return { count, email };
  });

  membershipRegistrationSettings.count = result.count;
  syncMembershipRegistrationSettingForm();
  await refreshMembersDashboardSafe({ force: true });
  showToast(`${result.email || "這個帳號"} 已新增為幹部。`, { tone: "success" });
};

const removeOfficer = async (memberId) => {
  const academicYear = getConfiguredAcademicYear();
  const term = getConfiguredAcademicTerm();
  const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
  const result = await runTransaction(db, async (transaction) => {
    const memberRef = getMemberDocRef(memberId);
    const [memberSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(statsRef),
    ]);
    if (!memberSnapshot.exists()) throw new Error("找不到這筆幹部資料。");

    const beforeMember = { id: memberId, ...(memberSnapshot.data() || {}) };
    if (getManagedMembershipStatus(beforeMember) !== "officer") throw new Error("這個帳號目前不是幹部。");
    const storedPreviousStatus = String(beforeMember.officerPreviousMembershipStatus || "").trim();
    const normalizedPreviousStatus = getManagedMembershipStatus(storedPreviousStatus);
    const nextStatus = storedPreviousStatus && !["admin", "officer"].includes(normalizedPreviousStatus)
      ? normalizedPreviousStatus
      : "formal_member";
    const nextIntent = nextStatus === "formal_member" ? "join" : "not_join";
    const nextPaymentStatus = nextStatus === "formal_member" ? "paid" : "unpaid";
    const email = String(beforeMember.email || "").trim().toLowerCase();
    const afterMember = {
      ...beforeMember,
      membershipIntent: nextIntent,
      membershipStatus: nextStatus,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
    };
    const afterOccupies = doesMembershipProfileOccupySlot(afterMember, academicYear, term);
    let count = statsSnapshot.exists()
      ? Math.max(0, Number(statsSnapshot.data()?.count || 0))
      : membershipRegistrationSettings.count;
    if (afterOccupies) {
      count += 1;
      transaction.set(statsRef, {
        academicYear,
        term,
        count,
        limit: statsSnapshot.exists()
          ? Math.max(0, Number(statsSnapshot.data()?.limit || membershipRegistrationSettings.limit || 0))
          : membershipRegistrationSettings.limit,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(memberRef, {
      membershipIntent: nextIntent,
      membershipStatus: nextStatus,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      officerPreviousMembershipStatus: null,
      officerPreviousMembershipIntent: null,
      officerPreviousPaymentStatus: null,
      membershipStatusChange: {
        previousStatus: "officer",
        nextStatus,
        changedAt: serverTimestamp(),
        changedBy: currentUser?.uid || "",
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (email) {
      if (nextStatus === "formal_member") {
        transaction.set(getApprovalDocRef(email), {
          email,
          status: "approved",
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        transaction.delete(getApprovalDocRef(email));
      }
    }
    return { count, email, nextStatus };
  });

  membershipRegistrationSettings.count = result.count;
  syncMembershipRegistrationSettingForm();
  await refreshMembersDashboardSafe({ force: true });
  showToast(`${result.email || "這個帳號"} 已移出幹部名單。`, { tone: "success" });
};

const getRosterManagementRowMarkup = (member = {}, index = 0, { disableStatus = false } = {}) => {
  const memberId = String(member.uid || member.id || "").trim();
  const email = String(member.email || "").trim().toLowerCase();
  const managedStatus = getManagedMembershipStatus(member);
  const membershipIntent = getMembershipIntentFromProfile(member);
  const paymentMethod = member.paymentMethod || (membershipIntent === "join" ? "later" : "none");
  const paymentNotRequired = ["officer", "admin"].includes(managedStatus);
  const paymentConfirmed = member.paymentStatus === "paid" || hasMemberPrivileges(managedStatus);
  const paymentMeta = [
    getMembershipApplicationPositionLabel(member),
    paymentMethod === "cash" ? getCashPaymentSlotLabel(member.cashPaymentSlot) : "",
    paymentMethod === "transfer" && member.transferLastFive ? `末五碼 ${member.transferLastFive}` : "",
    paymentMethod === "transfer" && member.transferAt ? member.transferAt.replace("T", " ") : "",
  ].filter(Boolean);
  const paymentTitle = paymentNotRequired
    ? "免繳社費"
    : managedStatus === "membership_waitlisted" ? "社員候補"
    : paymentConfirmed ? "已確認收款" : membershipIntent === "join" ? getPaymentMethodLabel(paymentMethod) : "未申請社員";
  const paymentStateClass = paymentConfirmed ? "is-confirmed" : membershipIntent === "join" ? "is-pending" : "is-neutral";
  const paymentMetaCopy = paymentNotRequired
    ? `${getMembershipStatusCopy(managedStatus).label}不計入社員名額`
    : paymentConfirmed
      ? `${getPaymentMethodLabel(paymentMethod)}${paymentMeta.length ? `・${paymentMeta.join("・")}` : ""}`
      : paymentMeta.join("・") || (membershipIntent === "join" ? "等待社員完成社費繳納" : "本學期未提出申請");
  const lockCurrentAdmin = managedStatus === "admin" && memberId === currentUser?.uid;
  const controlsDisabled = disableStatus || lockCurrentAdmin || !memberId;

  return `
    <tr>
      <td>${String(index + 1).padStart(2, "0")}</td>
      <td>${escapeHtml(member.name || member.displayName || "未填姓名")}</td>
      <td>${escapeHtml(member.studentId || "未填學號")}</td>
      <td>${escapeHtml(member.department || member.school || "未填寫")}</td>
      <td>${escapeHtml(email || "未填寫")}</td>
      <td>${escapeHtml(member.phone || "未填寫")}</td>
      <td>
        <div class="member-payment-cell">
          <div class="member-payment-state ${paymentStateClass}">
            <span class="member-payment-state-dot" aria-hidden="true"></span>
            <span class="member-payment-state-copy"><strong>${escapeHtml(paymentTitle)}</strong><small>${escapeHtml(paymentMetaCopy)}</small></span>
          </div>
        </div>
      </td>
      <td>
        <select class="member-status-select" data-member-status-select data-member-id="${escapeHtml(memberId)}" data-member-email="${escapeHtml(email)}" data-current-status="${escapeHtml(managedStatus)}" aria-label="設定 ${escapeHtml(member.name || email || "帳號")} 的社員狀態"${controlsDisabled ? ' disabled title="不能變更目前登入中的管理員狀態"' : ""}>
          ${getMemberStatusOptionsMarkup(managedStatus)}
        </select>
      </td>
      <td>
        <button class="member-delete-button" data-member-account-delete data-member-id="${escapeHtml(memberId)}" data-member-email="${escapeHtml(email)}" type="button"${controlsDisabled ? ' disabled title="不能刪除目前登入中的管理員帳號"' : ""}>刪除資料</button>
      </td>
    </tr>
  `;
};

const getRosterManagementTableMarkup = (rows = "") => `
  <div class="member-table-wrap">
    <table class="member-table">
      <thead>
        <tr><th scope="col">#</th><th scope="col">姓名</th><th scope="col">學號</th><th scope="col">系級</th><th scope="col">Gmail</th><th scope="col">聯絡電話</th><th scope="col">社費資訊</th><th scope="col">社員狀態</th><th scope="col">操作</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
`;

const matchesOfficerFilter = (member = {}) => {
  const yearValue = member.academicYear || "未設定";
  const termValue = member.term || "未設定";
  const queryValue = officerFilters.query.trim().toLocaleLowerCase("zh-TW");
  const queryMatch = !queryValue || [
    member.name,
    member.displayName,
    member.studentId,
    member.department,
    member.school,
    member.email,
    member.gmail,
    member.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-TW")
    .includes(queryValue);
  return (officerFilters.year === "all" || yearValue === officerFilters.year)
    && (officerFilters.term === "all" || termValue === officerFilters.term)
    && queryMatch;
};

const syncOfficerFilterUI = () => {
  const queryInput = document.querySelector("[data-officer-filter-query]");
  const yearSelect = document.querySelector("[data-officer-filter-year]");
  const termSelect = document.querySelector("[data-officer-filter-term]");
  if (!queryInput || !yearSelect || !termSelect) return;

  if (queryInput.value !== officerFilters.query) queryInput.value = officerFilters.query;
  yearSelect.innerHTML = buildAdminAcademicYearOptions()
    .map((value) => {
      const label = value === "all" ? "全部學年度" : getAcademicYearLabel(value);
      return `<option value="${escapeHtml(value)}"${value === officerFilters.year ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
  termSelect.innerHTML = ["all", ...DEFAULT_TERMS]
    .map((value) => {
      const label = value === "all" ? "全部學期" : getAcademicTermLabel(value);
      return `<option value="${escapeHtml(value)}"${value === officerFilters.term ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");

  if (queryInput.dataset.initialized === "true") return;
  queryInput.dataset.initialized = "true";
  queryInput.addEventListener("input", () => {
    officerFilters.query = queryInput.value;
    renderOfficerRoster();
  });
  yearSelect.addEventListener("change", () => {
    officerFilters.year = yearSelect.value;
    renderOfficerRoster();
  });
  termSelect.addEventListener("change", () => {
    officerFilters.term = termSelect.value;
    renderOfficerRoster();
  });
};

const renderOfficerRoster = () => {
  const form = document.querySelector("[data-officer-roster-add-form]");
  const select = document.querySelector("[data-officer-roster-member]");
  const list = document.querySelector("[data-officer-roster-list]");
  const hint = document.querySelector("[data-officer-roster-hint]");
  if (!form || !select || !list) return;
  syncOfficerFilterUI();

  const adminIds = getDashboardAdminIds();
  const candidates = membersDashboardCache.members
    .filter((member) => {
      const memberId = String(member.uid || member.id || "").trim();
      return memberId
        && !adminIds.has(memberId)
        && getManagedMembershipStatus(member) !== "officer";
    })
    .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "zh-TW"));
  select.innerHTML = candidates.length
    ? `<option value="">請選擇帳號</option>${candidates.map((member) => {
      const memberId = String(member.uid || member.id || "").trim();
      const label = [member.name || member.displayName, member.studentId, member.email].filter(Boolean).join(" / ");
      return `<option value="${escapeHtml(memberId)}">${escapeHtml(label || memberId)}</option>`;
    }).join("")}`
    : `<option value="">目前沒有可新增的帳號</option>`;
  select.disabled = candidates.length === 0;
  form.querySelector("[data-officer-roster-add]").disabled = candidates.length === 0;

  const allOfficers = membersDashboardCache.members
    .filter((member) => getManagedMembershipStatus(member) === "officer")
    .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "zh-TW"));
  const officers = allOfficers.filter(matchesOfficerFilter);
  const filterSummary = document.querySelector("[data-officer-filter-summary]");
  if (filterSummary) {
    filterSummary.textContent = `目前顯示 ${officers.length} 位，共 ${allOfficers.length} 位幹部。`;
  }
  if (officers.length === 0) {
    list.innerHTML = `<p class="content-copy member-table-empty">目前沒有符合篩選條件的幹部資料。</p>`;
  } else {
    const rows = officers.map((member, index) => getRosterManagementRowMarkup(member, index)).join("");
    list.innerHTML = getRosterManagementTableMarkup(rows);
  }

  if (form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const memberId = String(select.value || "").trim();
      const button = form.querySelector("[data-officer-roster-add]");
      if (!memberId) {
        setMessageTone(hint, "請先選擇要新增的帳號。", "error");
        return;
      }
      setButtonLoading(button, true, "新增中…");
      try {
        await addOfficer(memberId);
        setMessageTone(hint, "幹部名單已更新。", "success");
      } catch (error) {
        setMessageTone(hint, error?.message || "新增幹部失敗。", "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  bindMemberStatusSelects(list);
  bindMemberDeleteButtons(list);
};

const getAdminRosterEntryId = (admin = {}) => String(admin.uid || admin.id || "").trim();

const getAdminRosterMember = (admin = {}) => {
  const adminId = getAdminRosterEntryId(admin);
  return membersDashboardCache.members.find(
    (member) => [member.id, member.uid].map((value) => String(value || "").trim()).includes(adminId),
  ) || null;
};

const addAdministrator = async (memberId) => {
  const cachedMember = membersDashboardCache.members.find(
    (member) => [member.id, member.uid].map((value) => String(value || "").trim()).includes(memberId),
  );
  if (!cachedMember) throw new Error("找不到這個註冊帳號。");

  const academicYear = getConfiguredAcademicYear();
  const term = getConfiguredAcademicTerm();
  const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
  const result = await runTransaction(db, async (transaction) => {
    const memberRef = getMemberDocRef(memberId);
    const adminRef = getAdminDocRef(memberId);
    const [memberSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(statsRef),
    ]);
    if (!memberSnapshot.exists()) throw new Error("找不到這個註冊帳號的社員資料。");

    const beforeMember = { id: memberId, ...(memberSnapshot.data() || {}) };
    const email = String(beforeMember.email || cachedMember.email || "").trim().toLowerCase();
    const previousStatus = getManagedMembershipStatus(beforeMember);
    const afterMember = {
      ...beforeMember,
      membershipIntent: "not_join",
      membershipStatus: "admin",
      status: "admin",
      paymentStatus: "not_required",
    };
    const beforeOccupies = doesMemberOccupyMembershipSlot(beforeMember, academicYear, term);
    const afterOccupies = false;
    let count = statsSnapshot.exists()
      ? Math.max(0, Number(statsSnapshot.data()?.count || 0))
      : membershipRegistrationSettings.count;
    if (beforeOccupies !== afterOccupies) {
      count = Math.max(0, count - 1);
      transaction.set(statsRef, {
        academicYear,
        term,
        count,
        limit: statsSnapshot.exists()
          ? Math.max(0, Number(statsSnapshot.data()?.limit || membershipRegistrationSettings.limit || 0))
          : membershipRegistrationSettings.limit,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(memberRef, {
      membershipIntent: afterMember.membershipIntent,
      membershipStatus: afterMember.membershipStatus,
      status: afterMember.status,
      paymentStatus: afterMember.paymentStatus,
      membershipStatusChange: {
        previousStatus,
        nextStatus: "admin",
        changedAt: serverTimestamp(),
        changedBy: currentUser?.uid || "",
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(adminRef, {
      uid: memberId,
      email,
      name: String(beforeMember.name || beforeMember.displayName || "").trim(),
      role: "admin",
      previousMembershipStatus: previousStatus,
      previousMembershipIntent: getMembershipIntentFromProfile(beforeMember),
      previousPaymentStatus: String(beforeMember.paymentStatus || "unpaid"),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid || "",
    });
    if (email) transaction.delete(getApprovalDocRef(email));
    return { count, email };
  });

  membershipRegistrationSettings.count = result.count;
  syncMembershipRegistrationSettingForm();
  await refreshMembersDashboardSafe({ force: true });
  showToast(`${result.email || "這個帳號"} 已新增為管理員。`, { tone: "success" });
};

const removeAdministrator = async (adminId) => {
  if (adminId === currentUser?.uid) throw new Error("不能移除目前登入帳號的管理權限。");

  const academicYear = getConfiguredAcademicYear();
  const term = getConfiguredAcademicTerm();
  const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
  const result = await runTransaction(db, async (transaction) => {
    const adminRef = getAdminDocRef(adminId);
    const memberRef = getMemberDocRef(adminId);
    const [adminSnapshot, memberSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(adminRef),
      transaction.get(memberRef),
      transaction.get(statsRef),
    ]);
    if (!adminSnapshot.exists()) throw new Error("找不到這筆管理員資料。");

    const adminData = adminSnapshot.data() || {};
    const email = String(memberSnapshot.data()?.email || adminData.email || "").trim().toLowerCase();
    let count = statsSnapshot.exists()
      ? Math.max(0, Number(statsSnapshot.data()?.count || 0))
      : membershipRegistrationSettings.count;
    transaction.delete(adminRef);

    if (memberSnapshot.exists()) {
      const beforeMember = { id: adminId, ...(memberSnapshot.data() || {}) };
      const storedPreviousStatus = String(adminData.previousMembershipStatus || "").trim();
      const nextStatus = storedPreviousStatus && getManagedMembershipStatus(storedPreviousStatus) !== "admin"
        ? getManagedMembershipStatus(storedPreviousStatus)
        : "officer";
      const nextIntent = nextStatus === "formal_member" ? "join" : "not_join";
      const nextPaymentStatus = nextStatus === "formal_member"
        ? "paid"
        : nextStatus === "officer" ? "not_required" : "unpaid";
      const afterMember = {
        ...beforeMember,
        membershipIntent: nextIntent,
        membershipStatus: nextStatus,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
      };
      const beforeOccupies = false;
      const afterOccupies = doesMembershipProfileOccupySlot(afterMember, academicYear, term);
      if (beforeOccupies !== afterOccupies) {
        count += 1;
        transaction.set(statsRef, {
          academicYear,
          term,
          count,
          limit: statsSnapshot.exists()
            ? Math.max(0, Number(statsSnapshot.data()?.limit || membershipRegistrationSettings.limit || 0))
            : membershipRegistrationSettings.limit,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      transaction.set(memberRef, {
        membershipIntent: nextIntent,
        membershipStatus: nextStatus,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        membershipStatusChange: {
          previousStatus: "admin",
          nextStatus,
          changedAt: serverTimestamp(),
          changedBy: currentUser?.uid || "",
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (email) {
        if (nextStatus === "formal_member") {
          transaction.set(getApprovalDocRef(email), {
            email,
            status: "approved",
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          transaction.delete(getApprovalDocRef(email));
        }
      }
    }
    return { count, email };
  });

  membershipRegistrationSettings.count = result.count;
  syncMembershipRegistrationSettingForm();
  await refreshMembersDashboardSafe({ force: true });
  showToast(`${result.email || "這個帳號"} 的管理權限已移除。`, { tone: "success" });
};

const renderAdminRoster = () => {
  const form = document.querySelector("[data-admin-roster-add-form]");
  const select = document.querySelector("[data-admin-roster-member]");
  const list = document.querySelector("[data-admin-roster-list]");
  const hint = document.querySelector("[data-admin-roster-hint]");
  if (!form || !select || !list) return;

  const adminIds = getDashboardAdminIds();
  const candidates = membersDashboardCache.members
    .filter((member) => {
      const memberId = String(member.uid || member.id || "").trim();
      return memberId && !adminIds.has(memberId);
    })
    .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "zh-TW"));
  select.innerHTML = candidates.length
    ? `<option value="">請選擇帳號</option>${candidates.map((member) => {
      const memberId = String(member.uid || member.id || "").trim();
      const label = [member.name || member.displayName, member.studentId, member.email].filter(Boolean).join(" / ");
      return `<option value="${escapeHtml(memberId)}">${escapeHtml(label || memberId)}</option>`;
    }).join("")}`
    : `<option value="">目前沒有可新增的帳號</option>`;
  select.disabled = candidates.length === 0;
  form.querySelector("[data-admin-roster-add]").disabled = candidates.length === 0;

  const admins = [...(membersDashboardCache.admins || [])]
    .filter((admin) => getAdminRosterEntryId(admin))
    .sort((a, b) => {
      const aMember = getAdminRosterMember(a);
      const bMember = getAdminRosterMember(b);
      return String(aMember?.name || a.name || a.email || "").localeCompare(String(bMember?.name || b.name || b.email || ""), "zh-TW");
    });
  if (admins.length === 0) {
    list.innerHTML = `<p class="content-copy member-table-empty">目前沒有管理員資料。</p>`;
  } else {
    const rows = admins.map((admin, index) => {
      const adminId = getAdminRosterEntryId(admin);
      const member = getAdminRosterMember(admin);
      return getRosterManagementRowMarkup({
        id: adminId,
        uid: adminId,
        ...(member || {}),
        email: member?.email || admin.email || "",
        name: member?.name || member?.displayName || admin.name || "",
        membershipStatus: "admin",
        status: "admin",
        paymentStatus: "not_required",
      }, index, { disableStatus: !member });
    }).join("");
    list.innerHTML = getRosterManagementTableMarkup(rows);
  }

  if (form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const memberId = String(select.value || "").trim();
      const button = form.querySelector("[data-admin-roster-add]");
      if (!memberId) {
        setMessageTone(hint, "請先選擇要新增的帳號。", "error");
        return;
      }
      setButtonLoading(button, true, "新增中…");
      try {
        await addAdministrator(memberId);
        setMessageTone(hint, "管理員名單已更新。", "success");
      } catch (error) {
        setMessageTone(hint, error?.message || "新增管理員失敗。", "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  bindMemberStatusSelects(list);
  bindMemberDeleteButtons(list);
};

const reconcileMembershipRegistrationCount = async (members = []) => {
  if (!db || !currentUserIsAdmin) return;
  const academicYear = getConfiguredAcademicYear();
  const term = getConfiguredAcademicTerm();
  const positionUpdates = compactMembershipApplicationPositions(members)
    .filter(({ member }) => String(member.academicYear || "") === academicYear && String(member.term || "") === term);
  for (let index = 0; index < positionUpdates.length; index += 200) {
    const batch = writeBatch(db);
    positionUpdates.slice(index, index + 200).forEach(({ member, field, position }) => {
      const memberId = String(member.uid || member.id || "").trim();
      if (memberId) batch.set(getMemberDocRef(memberId), { [field]: position, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  const expectedCount = members.filter((member) => doesMemberOccupyMembershipSlot(member, academicYear, term)).length;
  const expectedWaitlistCount = members.filter((member) =>
    String(member.academicYear || "") === academicYear &&
    String(member.term || "") === term &&
    getManagedMembershipStatus(member) === "membership_waitlisted").length;
  if (
    expectedCount === membershipRegistrationSettings.count &&
    expectedCount === Number(membershipRegistrationSettings.registrationSequence || 0) &&
    expectedWaitlistCount === Number(membershipRegistrationSettings.waitlistSequence || 0) &&
    positionUpdates.length === 0
  ) return;

  await setDoc(doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`), {
    academicYear,
    term,
    count: expectedCount,
    limit: membershipRegistrationSettings.limit,
    registrationSequence: expectedCount,
    waitlistSequence: expectedWaitlistCount,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  membershipRegistrationSettings.count = expectedCount;
  membershipRegistrationSettings.registrationSequence = expectedCount;
  membershipRegistrationSettings.waitlistSequence = expectedWaitlistCount;
  syncMembershipRegistrationSettingForm();
};

const renderMembersExportToolbar = (members = []) => {
  const content = document.querySelector("[data-members-content]");
  const filterCard = content?.querySelector(".member-filter-card");
  if (!content || !filterCard) {
    return;
  }

  const filteredMembers = getFilteredMembersForExport(members)
    .filter((member) => getManagedMembershipStatus(member) !== "officer");
  const exportableMembers = filteredMembers.filter(isMemberRosterRecord);
  const filterLabel = `${memberFilters.year === "all" ? "全部學年度" : getAcademicYearLabel(memberFilters.year)} / ${
    memberFilters.term === "all" ? "全部學期" : getAcademicTermLabel(memberFilters.term)
  } / ${getMemberFilterCategoryLabel()}`;
  let tableCard = content.querySelector("[data-members-table-card]");
  if (!tableCard) {
    filterCard.insertAdjacentHTML(
      "afterend",
      `
        <section class="content-card is-tight member-table-card" data-members-table-card></section>
      `,
    );
    tableCard = content.querySelector("[data-members-table-card]");
  }

  if (!tableCard) {
    return;
  }

  if (filteredMembers.length === 0) {
    tableCard.innerHTML = `
      <div class="member-filter-header">
        <div>
          <p class="section-kicker">Members</p>
          <h3 class="content-title">篩選結果名單</h3>
          <p class="content-copy">目前篩選：${escapeHtml(filterLabel)}，共 0 筆。</p>
        </div>
      </div>
      <p class="content-copy member-table-empty">目前沒有符合這個學年度與學期的帳號資料。</p>
    `;
    return;
  }

  const rows = filteredMembers
    .map((member, index) => {
      const managedStatus = getManagedMembershipStatus(member);
      const membershipIntent = getMembershipIntentFromProfile(member);
      const paymentMethod = member.paymentMethod || (membershipIntent === "join" ? "later" : "none");
      const paymentNotRequired = ["officer", "admin"].includes(managedStatus);
      const paymentConfirmed = member.paymentStatus === "paid" || hasMemberPrivileges(managedStatus);
      const paymentMeta = [
        getMembershipApplicationPositionLabel(member),
        paymentMethod === "cash" ? getCashPaymentSlotLabel(member.cashPaymentSlot) : "",
        paymentMethod === "transfer" && member.transferLastFive ? `末五碼 ${member.transferLastFive}` : "",
        paymentMethod === "transfer" && member.transferAt ? member.transferAt.replace("T", " ") : "",
      ].filter(Boolean);
      const paymentTitle = paymentNotRequired
        ? "免繳社費"
        : managedStatus === "membership_waitlisted"
          ? "社員候補"
        : paymentConfirmed
          ? "已確認收款"
        : membershipIntent === "join"
          ? getPaymentMethodLabel(paymentMethod)
          : "未申請社員";
      const paymentStateClass = paymentConfirmed ? "is-confirmed" : membershipIntent === "join" ? "is-pending" : "is-neutral";
      const paymentMetaCopy = paymentNotRequired
        ? `${getMembershipStatusCopy(managedStatus).label}不計入社員名額`
        : paymentConfirmed
          ? `${getPaymentMethodLabel(paymentMethod)}${paymentMeta.length ? `・${paymentMeta.join("・")}` : ""}`
        : paymentMeta.join("・") || (membershipIntent === "join" ? "等待社員完成社費繳納" : "本學期未提出申請");
      const confirmPaymentButton =
        membershipIntent === "join" && managedStatus !== "membership_waitlisted" && !hasMemberPrivileges(managedStatus)
          ? `<button class="member-payment-confirm" data-member-action="toggle-membership-payment" data-member-id="${escapeHtml(member.id)}" data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}" data-payment-status="paid" type="button"><span aria-hidden="true">✓</span>確認已收款</button>`
          : "";
      return `
        <tr>
          <td>${escapeHtml(member.name || "未填姓名")}</td>
          <td>${escapeHtml(member.studentId || "未填學號")}</td>
          <td>${escapeHtml(member.department || member.school || "未填寫")}</td>
          <td>${escapeHtml(member.email || "未填寫")}</td>
          <td>${escapeHtml(member.phone || "未填寫")}</td>
          <td>${escapeHtml(getMembershipApplicationPositionLabel(member) || "—")}</td>
          <td>
            <div class="member-payment-cell">
              <div class="member-payment-state ${paymentStateClass}">
                <span class="member-payment-state-dot" aria-hidden="true"></span>
                <span class="member-payment-state-copy">
                  <strong>${escapeHtml(paymentTitle)}</strong>
                  <small>${escapeHtml(paymentMetaCopy)}</small>
                </span>
              </div>
              ${confirmPaymentButton}
            </div>
          </td>
          <td>
            <select
              class="member-status-select"
              data-member-status-select
              data-member-id="${escapeHtml(member.id)}"
              data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}"
              data-current-status="${escapeHtml(managedStatus)}"
              aria-label="設定 ${escapeHtml(member.name || member.email || "帳號")} 的社員狀態"
            >
              ${getMemberStatusOptionsMarkup(managedStatus)}
            </select>
          </td>
          <td>
            <button
              class="member-delete-button"
              data-member-account-delete
              data-member-id="${escapeHtml(member.id)}"
              data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}"
              type="button"
              ${member.id === currentUser?.uid ? 'disabled title="不能刪除目前登入中的管理員帳號"' : ""}
            >刪除資料</button>
          </td>
        </tr>
      `;
    })
    .join("");

  tableCard.innerHTML = `
    <div class="member-filter-header">
      <div>
        <p class="section-kicker">Members</p>
        <h3 class="content-title">篩選結果名單</h3>
        <p class="content-copy">目前篩選：${escapeHtml(filterLabel)}，共 ${filteredMembers.length} 筆。可直接從下拉選單變更社員狀態。</p>
      </div>
      <button class="button-primary" data-export-members-csv type="button"${exportableMembers.length ? "" : " disabled"}>匯出社員 CSV（${exportableMembers.length}）</button>
    </div>
    <div class="member-table-wrap">
      <table class="member-table">
        <thead>
          <tr>
            <th scope="col">姓名</th>
            <th scope="col">學號</th>
            <th scope="col">系級</th>
            <th scope="col">Gmail</th>
            <th scope="col">聯絡電話</th>
            <th scope="col">申請順位</th>
            <th scope="col">社費資訊</th>
            <th scope="col">社員狀態</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  bindMemberStatusSelects(tableCard);
  bindMemberActionButtons(tableCard);
  bindMemberDeleteButtons(tableCard);
  tableCard.querySelector("[data-export-members-csv]")?.addEventListener("click", () => {
    const rows = exportableMembers.map((member) => [
      member.name || "",
      member.studentId || "",
      member.department || member.school || "",
      member.email || "",
      member.phone || "",
      getAcademicYearLabel(member.academicYear),
      getAcademicTermLabel(member.term),
      getMembershipApplicationPositionLabel(member),
      getPaymentMethodLabel(member.paymentMethod || "none"),
      getMembershipStatusCopy(member).label,
    ]);
    const period = `${memberFilters.year === "all" ? "全部學年度" : memberFilters.year}-${memberFilters.term === "all" ? "全部學期" : memberFilters.term}`;
    downloadCsv({
      filename: `臺科大羽球社-社員名單-${period}-${formatDateInputValue(new Date())}.csv`,
      headers: ["姓名", "學號", "系級", "Email", "電話", "學年度", "學期", "社員申請順位", "社費方式", "社員狀態"],
      rows,
    });
    showToast(`已匯出 ${rows.length} 位正式社員。`, { tone: "success" });
  });
};
const renderMembersList = (members = []) => {
  const list = document.querySelector("[data-members-list]");
  if (!list) {
    return;
  }

  const filteredMembers = members.filter((member) => {
    const status = getManagedMembershipStatus(member);
    return matchesMemberFilter(member) && !["officer", "admin"].includes(status);
  });

  if (filteredMembers.length === 0) {
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有符合條件的帳號資料</h3>
        <p class="content-copy">這個篩選範圍內目前沒有已註冊帳號。</p>
      </article>
    `;
    return;
  }

  const getRowsMarkup = (group) => group
    .map((member, index) => {
      const memberStatusLabel = getMembershipStatusCopy(member).label;
      const applicationPositionLabel = getMembershipApplicationPositionLabel(member);
      const school = String(member.school || "臺科大").trim();
      const customSchoolOption = !["臺科大", "外校"].includes(school)
        ? `<option value="${escapeHtml(school)}" selected>${escapeHtml(school)}</option>`
        : "";
      return `
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
                <span class="member-row-status">${escapeHtml([memberStatusLabel, applicationPositionLabel].filter(Boolean).join("・"))}</span>
                <span class="member-row-toggle">展開</span>
              </span>
            </span>
          </button>
          <div class="member-row-detail" data-member-detail id="member-detail-${escapeHtml(member.id)}" hidden>
            <div class="member-row-meta">
              <span>學年度：${escapeHtml(getAcademicYearLabel(member.academicYear || "未設定"))}</span>
              <span>學期：${escapeHtml(getAcademicTermLabel(member.term || "未設定"))}</span>
              ${applicationPositionLabel ? `<span>${escapeHtml(applicationPositionLabel)}</span>` : ""}
              <span>系別：${escapeHtml(member.department || member.school || "未填寫")}</span>
              <span>電話：${escapeHtml(member.phone || "未填寫")}</span>
              <span>信箱：${escapeHtml(member.email || "未填寫")}</span>
              <span>建立時間：${escapeHtml(formatTimestamp(member.createdAt))}</span>
              <span>最近登入：${escapeHtml(formatTimestamp(member.lastLoginAt))}</span>
            </div>
            <form class="form-grid member-edit-form" data-member-edit-form data-member-id="${escapeHtml(member.id)}">
              <div class="class-signup-profile">
                <div class="form-field"><label>姓名</label><input name="name" value="${escapeHtml(member.name || "")}" required /></div>
                <div class="form-field"><label>學號</label><input name="studentId" value="${escapeHtml(member.studentId || "")}" required /></div>
                <div class="form-field"><label>學校</label><select name="school" required><option value="臺科大"${school === "臺科大" ? " selected" : ""}>臺科大</option><option value="外校"${school === "外校" ? " selected" : ""}>外校</option>${customSchoolOption}</select></div>
                <div class="form-field"><label>系別</label><input name="department" value="${escapeHtml(member.department || "")}" required /></div>
                <div class="form-field"><label>電話</label><input name="phone" type="tel" value="${escapeHtml(member.phone || "")}" required /></div>
                <div class="form-field"><label>學年度</label><select name="academicYear" required>${getMemberAcademicYearOptionsMarkup(member.academicYear)}</select></div>
                <div class="form-field"><label>學期</label><select name="term" required>${getMemberAcademicTermOptionsMarkup(member.term)}</select></div>
              </div>
              <button class="button-primary" data-member-edit-save type="submit">儲存社員資料</button>
            </form>
            <div class="application-actions member-actions">
              <button class="button-secondary application-save" data-member-action="delete" data-member-origin="${escapeHtml(member.origin || "members")}" data-member-id="${escapeHtml(member.origin === "applications" ? member.applicationId : member.id)}" data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}" data-member-application-id="${escapeHtml(member.applicationId || "")}" type="button">
                刪除社員資料
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const appliedMembers = filteredMembers
    .filter((member) => getMembershipIntentFromProfile(member) === "join")
    .sort((a, b) => {
      const aWaitlisted = getManagedMembershipStatus(a) === "membership_waitlisted";
      const bWaitlisted = getManagedMembershipStatus(b) === "membership_waitlisted";
      if (aWaitlisted !== bWaitlisted) return aWaitlisted ? 1 : -1;
      return aWaitlisted
        ? Number(a.membershipWaitlistPosition || 0) - Number(b.membershipWaitlistPosition || 0)
        : getMembershipRegistrationPosition(a) - getMembershipRegistrationPosition(b);
    });
  const accountsWithoutApplication = filteredMembers.filter((member) => getMembershipIntentFromProfile(member) !== "join");
  const getGroupMarkup = (title, copy, group, emptyCopy) => `
    <section class="member-roster-group">
      <div class="section-header is-compact">
        <h4 class="content-title">${escapeHtml(title)}（${group.length}）</h4>
        <p class="section-description">${escapeHtml(copy)}</p>
      </div>
      <div class="member-list">
        ${group.length ? getRowsMarkup(group) : `<article class="content-card is-tight"><p class="content-copy">${escapeHtml(emptyCopy)}</p></article>`}
      </div>
    </section>
  `;
  const filteredCategoryMarkup = {
    member: () => getGroupMarkup("社員", "已完成社費確認的正式社員。", filteredMembers, "目前沒有符合條件的社員。"),
    applicant: () => getGroupMarkup("申請成為社員", "包含現金、轉帳、待繳費與社員候補。", appliedMembers, "目前沒有符合條件的社員申請。"),
    non_member: () => getGroupMarkup("非社員", "已有帳號但目前不是社員，且未提出社員申請。", accountsWithoutApplication, "目前沒有符合條件的非社員帳號。"),
  }[memberFilters.category];
  list.innerHTML = filteredCategoryMarkup
    ? filteredCategoryMarkup()
    : [
        getGroupMarkup("已申請成為社員", "包含選擇現金或轉帳的申請者，以及待繳費、正式社員與社員候補。", appliedMembers, "目前沒有符合條件的社員申請。"),
        getGroupMarkup("有帳號但未申請社員", "已建立網站帳號，但本學期尚未提出社員申請。", accountsWithoutApplication, "目前沒有符合條件的未申請帳號。"),
      ].join("");

  bindMemberToggleButtons(list);
  bindMemberEditForms(list);
  bindMemberActionButtons(list);
};

const renderMembersSummary = (members = []) => {
  const summary = document.querySelector("[data-members-summary]");
  if (!summary) {
    return;
  }

  const filteredMembers = members.filter(matchesMemberFilter);
  const appliedMembers = filteredMembers.filter((member) => getMembershipIntentFromProfile(member) === "join");
  const formalMembers = filteredMembers.filter((member) => getManagedMembershipStatus(member) === "formal_member");
  const officers = filteredMembers.filter((member) => getManagedMembershipStatus(member) === "officer");

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">社員申請數</p>
      <p class="member-stat-value">${appliedMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">正式社員數</p>
      <p class="member-stat-value">${formalMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">幹部數</p>
      <p class="member-stat-value">${officers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">符合篩選帳號數</p>
      <p class="member-stat-value">${filteredMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">目前篩選</p>
      <p class="member-stat-value member-stat-value-small">${escapeHtml(
        memberFilters.year === "all" ? "全部學年度" : getAcademicYearLabel(memberFilters.year),
      )}<br />${escapeHtml(memberFilters.term === "all" ? "全部學期" : getAcademicTermLabel(memberFilters.term))}<br />${escapeHtml(getMemberFilterCategoryLabel())}</p>
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

  syncMembersPageHero();

  const gate = document.querySelector("[data-members-gate]");
  const content = document.querySelector("[data-members-content]");
  const summary = document.querySelector("[data-members-summary]");
  const list = document.querySelector("[data-members-list]");
  const officerList = document.querySelector("[data-officer-roster-list]");
  const adminList = document.querySelector("[data-admin-roster-list]");

  if (!gate || !content || !summary || !list) {
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
      <p class="content-copy">按上方 <code>登入／註冊</code> 後登入，才能查看管理資料。</p>
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
  patchMembersFilterUI();
  const expandedMemberKeys = preserveExpandedRows ? getExpandedMemberKeys() : [];
  bindAdminClassCreationForms();
  if ((force || !membersDashboardCache.loaded) && !membersDashboardLoadPromise) {
    renderLoadingSkeleton(summary, { rows: 2, label: "管理摘要載入中" });
    renderLoadingSkeleton(list, { rows: 4, label: "社員名單載入中" });
    renderLoadingSkeleton(officerList, { rows: 3, label: "幹部名單載入中" });
    renderLoadingSkeleton(adminList, { rows: 3, label: "管理員名單載入中" });
    renderLoadingSkeleton(document.querySelector("[data-class-session-calendar]"), { rows: 3, label: "行事曆載入中" });
  }

  try {
    if (force || !membersDashboardCache.loaded) {
      if (!membersDashboardLoadPromise) {
        membersDashboardLoadPromise = (async () => {
          const dashboardWarnings = [];
          try {
            await ensureDefaultCalendarHolidaysSeeded();
          } catch (error) {
            dashboardWarnings.push({ label: "建立預設連續假期", error });
          }
          const supportingDataPromise = Promise.all([
            loadWithFallback("社課日期", dashboardWarnings, () => getCollectionEntries(CLASS_SESSION_COLLECTION), []),
            loadWithFallback("社課報名", dashboardWarnings, () => getCollectionEntries(CLASS_SIGNUP_COLLECTION), []),
            loadWithFallback("公告", dashboardWarnings, () => getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION), []),
            loadWithFallback("FAQ", dashboardWarnings, () => getCollectionEntries(FAQ_COLLECTION), []),
            loadWithFallback("待回答問題", dashboardWarnings, () => getCollectionEntries(FAQ_QUESTION_COLLECTION), []),
            loadWithFallback("社課相簿", dashboardWarnings, () => getCollectionEntries(CLASS_ALBUM_COLLECTION), []),
          ]);
          const [members, admins] = await Promise.all([
            loadWithFallback("社員名單", dashboardWarnings, () => getCollectionEntries("members"), []),
            loadWithFallback("管理員名單", dashboardWarnings, () => getCollectionEntries("admins"), []),
          ]);
          try {
            await backfillUnsetMemberAcademicPeriods(members);
          } catch (error) {
            dashboardWarnings.push({ label: "補齊社員學年度與學期", error });
          }

          membersDashboardCache = {
            ...membersDashboardCache,
            members,
            admins,
            loadWarnings: dashboardWarnings,
            loaded: false,
          };
          try {
            await reconcileMembershipRegistrationCount(members);
          } catch (error) {
            dashboardWarnings.push({ label: "校正社員申請名額", error });
          }

          const earlyDisplayMembers = mergeMembersWithApprovedApplications(members);
          renderMembersSummary(earlyDisplayMembers);
          clearLoadingState(summary);
          renderMembersExportToolbar(earlyDisplayMembers);
          renderMembersList(earlyDisplayMembers);
          clearLoadingState(list);
          renderOfficerRoster();
          clearLoadingState(officerList);
          renderAdminRoster();
          clearLoadingState(adminList);

          const [classSessions, classSessionSignups, announcements, faqs, faqQuestions, classAlbums] = await supportingDataPromise;
          membersDashboardCache = {
            members,
            admins,
            classSessions,
            classSessionSignups,
            classAlbums,
            announcements,
            faqs,
            faqQuestions,
            loadWarnings: dashboardWarnings,
            loaded: true,
          };
        })().finally(() => {
          membersDashboardLoadPromise = null;
        });
      }

      await membersDashboardLoadPromise;
    }

    const displayMembers = mergeMembersWithApprovedApplications(membersDashboardCache.members);

    renderMembersSummary(displayMembers);
    renderMembersExportToolbar(displayMembers);
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
    renderMembersList(displayMembers);
    renderOfficerRoster();
    renderAdminRoster();
    renderAdminClassCalendarCompact(membersDashboardCache.classSessions, membersDashboardCache.classSessionSignups);
    renderAdminAnnouncements(membersDashboardCache.announcements);
    renderAdminFaqQuestions(membersDashboardCache.faqQuestions);
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

function getMemberSignupOpenMs(session = {}) {
  return getDateTimeLocalMs(session.memberSignupOpenAt || session.signupOpenAt);
}

function getPublicSignupOpenMs(session = {}) {
  const configuredPublicMs = getDateTimeLocalMs(session.publicSignupOpenAt);
  if (configuredPublicMs) return configuredPublicMs;
  const legacyMemberMs = getMemberSignupOpenMs(session);
  return session.allowNonMembers === true && legacyMemberMs ? legacyMemberMs + NON_MEMBER_SIGNUP_DELAY_MS : null;
}

function isClassSignupWindowOpen(session) {
  const now = Date.now();
  const isFormalMember = hasFormalMemberAccess(classSignupPageState.approval);
  const openMs = isFormalMember
    ? getMemberSignupOpenMs(session)
    : getPublicSignupOpenMs(session);
  const closeMs = getDateTimeLocalMs(session.signupCloseAt);

  if (!isFormalMember && !openMs) {
    return false;
  }

  if (openMs && now < openMs) {
    return false;
  }

  if (closeMs && now > closeMs) {
    return false;
  }

  if (openMs || closeMs) {
    return true;
  }

  const sessionDateMs = getClassSessionSortMs(session);
  if (!Number.isFinite(sessionDateMs) || sessionDateMs === Number.POSITIVE_INFINITY) {
    return false;
  }

  const endOfSessionDayMs = sessionDateMs + 24 * 60 * 60 * 1000;
  return endOfSessionDayMs > now;
}

function isClassSignupWindowClosed(session = {}) {
  const closeMs = getDateTimeLocalMs(session.signupCloseAt);
  return Boolean(closeMs && Date.now() > closeMs);
}

function isNonMemberPriorityWindow(session) {
  if (hasFormalMemberAccess(classSignupPageState.approval)) return false;
  const now = Date.now();
  const memberOpenMs = getMemberSignupOpenMs(session);
  const publicOpenMs = getPublicSignupOpenMs(session);
  return Boolean(memberOpenMs && publicOpenMs && now >= memberOpenMs && now < publicOpenMs);
}

function getSessionSignupLimit(session = {}) {
  const limit = Number(session.signupLimit || 0);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
}

function isFormalMemberRecord(member = {}) {
  return hasMemberPrivileges(member);
}

function isMemberRosterRecord(member = {}) {
  return getManagedMembershipStatus(member) === "formal_member";
}

function isFormalMemberSignup(signup = {}, member = null) {
  return isFormalMemberRecord(member || {}) || signup.isFormalMemberAtSignup === true || ["formal_member", "officer", "admin"].includes(signup.membershipStatusAtSignup);
}

function getSignupPaymentLabel(signup = {}, member = null) {
  if (isFormalMemberSignup(signup, member)) {
    return "正式社員免零打費";
  }

  return signup.dropInPaymentStatus === "paid" ? "零打已繳" : "零打未繳";
}

function getSignupStatusLabel(signup = {}) {
  if (signup.signupStatus === "accepted") {
    return "報名成功";
  }
  if (signup.signupStatus === "waitlisted") {
    const position = Math.max(0, Number(signup.waitlistPosition || 0));
    return position ? `候補第 ${position} 位` : "候補";
  }
  return "待確認";
}

function getSessionSignupCount(sessionId) {
  const stats = classSignupPageState.sessionSignups.find((entry) => String(entry.sessionId || entry.id || "") === String(sessionId || ""));
  return Math.max(0, Number(stats?.signupCount || 0));
}
function getSessionWaitlistCount(sessionId) {
  const stats = classSignupPageState.sessionSignups.find((entry) => String(entry.sessionId || entry.id || "") === String(sessionId || ""));
  return Math.max(0, Number(stats?.waitlistCount || 0));
}
function getRemainingCapacityMarkup(session) {
  const limit = getSessionSignupLimit(session);
  const count = getSessionSignupCount(getClassSessionId(session));
  return limit ? `剩餘 ${Math.max(0, limit - count)} 名` : "名額不限";
}
function getComputedSignupStatus(signup = {}, index = 0, session = {}) {
  if (signup.signupStatus === "accepted" || signup.signupStatus === "waitlisted") {
    return signup.signupStatus;
  }

  const limit = getSessionSignupLimit(session);
  return limit && index >= limit ? "waitlisted" : "accepted";
}

function maskPublicName(value) {
  const characters = Array.from(String(value || "").trim());
  if (characters.length === 0) {
    return "未填姓名";
  }
  if (characters.length === 1) {
    return `${characters[0]}O`;
  }
  if (characters.length === 2) {
    return `${characters[0]}O`;
  }
  return `${characters[0]}${"O".repeat(characters.length - 2)}${characters.at(-1)}`;
}

function getPublicRosterDisplayName(entry = {}) {
  return String(entry.maskedName || "").trim() || maskPublicName(entry.name);
}

function getUpcomingSignupSessions(sessions = [], now = Date.now()) {
  return sessions
    .filter((session) => {
      const startMs = getClassSessionStartMs(session);
      const closeMs = getDateTimeLocalMs(session.signupCloseAt);
      return Boolean(session.signupRequired)
        && Number.isFinite(startMs)
        && startMs >= now
        && (!closeMs || closeMs >= now);
    })
    .sort((a, b) => getClassSessionStartMs(a) - getClassSessionStartMs(b))
    .slice(0, 3);
}

function renderUpcomingClassSessions(sessions = []) {
  const container = document.querySelector("[data-upcoming-class-sessions]");
  if (!container) return;
  const upcoming = getUpcomingSignupSessions(sessions);
  const timeLabel = (value) => value ? formatTimestamp(value) : "尚未設定";
  container.innerHTML = upcoming.length ? `
    <div class="timeline-grid">
      ${upcoming.map((session, index) => `
        <details class="timeline-card upcoming-session-card">
          <summary class="upcoming-session-summary">
            <span class="timeline-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="upcoming-session-summary-copy">
              <strong class="timeline-title">${escapeHtml(getClassSessionDateLabel(session))}</strong>
              <span class="timeline-copy">${escapeHtml([getLocalizedContentTitle(session, "社課"), getClassSessionTimeLabel(session)].filter(Boolean).join(" ・ "))}</span>
            </span>
            <span class="upcoming-session-toggle">展開</span>
          </summary>
          <div class="upcoming-session-detail">
            <dl class="upcoming-session-times">
              <div><dt>社課時間</dt><dd>${escapeHtml(getClassSessionTimeLabel(session) || "尚未設定")}</dd></div>
              <div><dt>社員優先報名</dt><dd>${escapeHtml(timeLabel(getMemberSignupOpenMs(session)))}</dd></div>
              <div><dt>全面開放報名</dt><dd>${escapeHtml(getPublicSignupOpenMs(session) ? timeLabel(getPublicSignupOpenMs(session)) : "尚未開放非社員報名")}</dd></div>
              <div><dt>報名截止</dt><dd>${escapeHtml(timeLabel(getDateTimeLocalMs(session.signupCloseAt)))}</dd></div>
            </dl>
          </div>
        </details>
      `).join("")}
    </div>
  ` : `<article class="content-card is-tight"><p class="content-copy">目前沒有即將開放或仍可報名的社課場次。</p></article>`;
  clearLoadingState(container);
}

function renderClassCalendarBoard(sessions = []) {
  renderUpcomingClassSessions(sessions);
  const container = document.querySelector("[data-class-calendar]");
  if (!container) {
    return;
  }

  const openSignupSessions = [...sessions]
    .filter((session) => {
      const isSignupSession = Boolean(session.signupRequired);
      return isSignupSession && isClassSignupWindowOpen(session);
    })
    .sort((a, b) => getClassSessionSortMs(a) - getClassSessionSortMs(b));

  const sessionMarkup = openSignupSessions
    .map((session) => {
      const sessionId = getClassSessionId(session);
      const signupCount = getSessionSignupCount(sessionId);
      const signupLimit = getSessionSignupLimit(session);
      const signupCountLabel = signupLimit ? `${signupCount} / ${signupLimit} 人` : `${signupCount} 人已報名`;
      const publicSignupOpenMs = getPublicSignupOpenMs(session);
      const signupAudienceLabel = publicSignupOpenMs && Date.now() >= publicSignupOpenMs
        ? "社員與非社員皆可報名"
        : "社員優先報名中";

      return `
        <button class="content-card is-tight class-signup-date-card" data-open-class-signup-session data-session-id="${escapeHtml(sessionId)}" type="button">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "可報名社課")}</p>
              <h3 class="content-title">${escapeHtml(getClassSessionDateLabel(session))}</h3>
              <p class="content-copy">${escapeHtml([getClassSessionTimeLabel(session), getLocalizedContentTitle(session, "社課")].filter(Boolean).join(" ・ "))}</p>
              ${session.location ? `<p class="content-copy">地點：${escapeHtml(session.location)}</p>` : ""}
            </div>
            <span class="member-row-status">開放報名</span>
          </div>
          <p class="content-copy">${escapeHtml(signupCountLabel)}，${escapeHtml(signupAudienceLabel)}。</p>
        </button>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="calendar-shell class-signup-availability">
      <div class="calendar-header">
        <div>
          <p class="section-description">只顯示目前報名期間已開放的社課。</p>
        </div>
      </div>
      ${
        sessionMarkup
          ? `<div class="class-signup-date-grid">${sessionMarkup}</div>`
          : `
            <article class="content-card is-tight">
              <h3 class="content-title">目前沒有開放報名的社課</h3>
              <p class="content-copy">有新的報名日期時會顯示在這裡。</p>
            </article>
          `
      }
    </div>
  `;

  container.querySelectorAll("[data-open-class-signup-session]").forEach((button) => {
    button.addEventListener("click", () => {
      openClassSignupModal(button.dataset.sessionId || "", button);
    });
  });
}

function buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, signupOpen) {
  const nameValue = currentMemberProfile?.name || approvalData?.name || currentUser?.displayName || currentUser?.email || "";
  const studentIdValue = currentMemberProfile?.studentId || approvalData?.studentId || "";
  const noteValue = ownSignup?.note || "";
  const sessionId = getClassSessionId(session);
  const deleteButton = ownSignup
    ? `<button class="button-secondary" data-class-signup-delete type="button" data-session-id="${escapeHtml(sessionId)}">取消報名</button>`
    : "";

  if (ownSignup && (!signupOpen || !canSignup)) {
    return `
      <div class="class-session-locked">
        <p class="signup-alert ${ownSignup.signupStatus === "waitlisted" ? "is-waitlisted" : "is-success"}">
          <strong>${escapeHtml(getSignupStatusLabel(ownSignup))}</strong>
          ${signupOpen ? "你仍可自行取消這筆報名。" : "報名期間已結束，但你仍可自行取消；若為正取，系統會自動遞補候補者。"}
        </p>
        <div class="class-signup-actions">${deleteButton}</div>
      </div>
    `;
  }

  if (!canSignup) {
    return `
      <div class="class-session-locked">
        <p class="content-copy">${currentUser ? "本場社課僅開放正式社員報名。" : "請先登入或註冊帳號後再報名。"}</p>
      </div>
    `;
  }

  if (!signupOpen) {
    return `
      <div class="class-session-locked">
        <p class="content-copy">${isClassSignupWindowClosed(session) ? "這場社課報名已截止。" : isNonMemberPriorityWindow(session) ? "目前為社員優先報名期間。非社員請於管理員設定的全面開放時間後再報名。" : "這場社課尚未開放報名，請稍後再回來查看。"}</p>
      </div>
    `;
  }

  return `
    <form class="form-grid class-signup-form" data-class-signup-form data-session-id="${escapeHtml(sessionId)}">
      ${ownSignup ? `<p class="signup-alert ${ownSignup.signupStatus === "waitlisted" ? "is-waitlisted" : "is-success"}"><strong>${escapeHtml(getSignupStatusLabel(ownSignup))}</strong>${ownSignup.signupStatus === "waitlisted" ? "目前在候補名單中，有人取消時會依順序自動遞補。" : "你的名額已保留。"}</p>` : ""}
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
      <div class="form-field">
        <label for="class-note-${escapeHtml(sessionId)}">備註</label>
        <textarea id="class-note-${escapeHtml(sessionId)}" name="note" rows="3" placeholder="如果有需要補充的資訊可以寫在這裡">${escapeHtml(noteValue)}</textarea>
      </div>
      <div class="class-signup-actions">
        <button class="button-primary" data-class-signup-submit type="submit">${ownSignup ? "更新報名資料" : getSessionSignupLimit(session) && getSessionSignupCount(sessionId) >= getSessionSignupLimit(session) ? "加入候補" : "送出報名"}</button>
        ${deleteButton}
      </div>
    </form>
  `;
}

function renderClassRosterBoard(sessions = []) {
  const container = document.querySelector("[data-class-roster-board]");
  if (!container) {
    return;
  }

  const groupedSignups = groupClassSignupsBySession(classSignupPageState.sessionSignups);
  const sessionsWithSignups = [...sessions]
    .map((session) => ({
      session,
      signups: [...(groupedSignups[getClassSessionId(session)] || [])].sort(
        (a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt),
      ),
    }))
    .filter((entry) => entry.signups.length > 0)
    .sort((a, b) => getClassSessionSortMs(a.session) - getClassSessionSortMs(b.session));

  if (sessionsWithSignups.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前還沒有報名名單</h3>
        <p class="content-copy">有人完成報名後，姓名與學號會立即顯示在這裡。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sessionsWithSignups
    .map(
      ({ session, signups }) => `
        <article class="content-card class-roster-card">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h3 class="content-title">${escapeHtml(getLocalizedContentTitle(session, "社課名單"))}</h3>
              <p class="content-copy">${escapeHtml([getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" ・ "))}</p>
            </div>
            <span class="member-row-status">${escapeHtml(`${signups.length} 人報名`)}</span>
          </div>
          ${session.location ? `<p class="content-copy">地點：${escapeHtml(session.location)}</p>` : ""}
          <div class="class-roster-list">
            ${signups
              .map(
                (entry, index) => `
                  <div class="class-roster-item">
                    <span class="class-roster-index">#${String(index + 1).padStart(2, "0")}</span>
                    <p class="class-roster-name">${escapeHtml(entry.studentId || "未填學號")}　${escapeHtml(getPublicRosterDisplayName(entry))}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
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

      const confirmed = window.confirm("確定要取消這筆社課報名嗎？若你是正取，名額會自動遞補給候補者。");
      if (!confirmed) {
        return;
      }

      try {
        setButtonLoading(button, true, "取消中…");
        await deleteClassSessionSignup(sessionId);
        await refreshClassSignupPageSafe({ force: true });
        showToast("已取消報名；若有候補者，系統會自動依序遞補。", { tone: "success" });
      } catch (error) {
        console.error("Delete class signup failed:", error);
        showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "取消報名失敗" });
        setButtonLoading(button, false);
      }
    });
  });
}

function bindPublicCalendarModalEvents() {
  const { calendarModal, closeButtons } = getPublicCalendarModalElements();
  if (!calendarModal) {
    return;
  }

  closeButtons.forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", closePublicCalendarModal);
  });

  if (calendarModal.dataset.initialized !== "true") {
    calendarModal.dataset.initialized = "true";
    calendarModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === calendarModal || target.hasAttribute("data-modal-backdrop")) {
        closePublicCalendarModal();
      }
    });
  }
}

function bindClassSignupModalEvents() {
  const { calendarModal, closeButtons } = getClassSignupModalElements();
  if (!calendarModal) {
    return;
  }

  closeButtons.forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", closeClassSignupModal);
  });

  if (calendarModal.dataset.initialized !== "true") {
    calendarModal.dataset.initialized = "true";
    calendarModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === calendarModal || target.hasAttribute("data-modal-backdrop")) {
        closeClassSignupModal();
      }
    });
  }
}

async function upsertClassSessionSignup(session, values) {
  if (!functionsClient || !httpsCallable) throw new Error("報名服務目前無法使用，請稍後再試。");
  const result = await httpsCallable(functionsClient, "upsertClassSessionSignup")({
    sessionId: getClassSessionId(session),
    note: values.note || "",
  });
  return result.data || { ok: true, signupStatus: "accepted" };
}

async function deleteClassSessionSignup(sessionId) {
  if (!functionsClient || !httpsCallable) throw new Error("取消報名服務目前無法使用，請稍後再試。");
  await httpsCallable(functionsClient, "deleteClassSessionSignup")({ sessionId });
}

async function adminDeleteClassSessionSignup(sessionId, signupId) {
  if (!functionsClient || !httpsCallable) throw new Error("管理報名服務目前無法使用，請稍後再試。");
  await httpsCallable(functionsClient, "adminDeleteClassSessionSignup")({ sessionId, signupId });
}

async function adminDeleteClassSession(sessionId) {
  if (!functionsClient || !httpsCallable) throw new Error("管理社課服務目前無法使用，請稍後再試。");
  return (await httpsCallable(functionsClient, "adminDeleteClassSession")({ sessionId })).data || { ok: true };
}

async function handleClassSignupSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-class-signup-submit]");
  const sessionId = String(form.dataset.sessionId || form.querySelector("[name='sessionId']")?.value || "").trim();
  const note = String(form.querySelector("[name='note']")?.value || "").trim();
  const name = String(form.querySelector("[name='name']")?.value || "").trim();
  const studentId = String(form.querySelector("[name='studentId']")?.value || "").trim();

  if (!currentUser?.uid || !sessionId) {
    return;
  }

  const session = classSignupPageState.sessions.find((item) => getClassSessionId(item) === sessionId);
  if (!session) {
    return;
  }

  setButtonLoading(submitButton, true, "送出中…");

  try {
    const result = await upsertClassSessionSignup(session, { note, name, studentId });

    await refreshClassSignupPageSafe({ force: true });
    showToast(result.signupStatus === "waitlisted" ? "本場已額滿，已依順序加入候補名單。" : "社課報名成功。", {
      tone: result.signupStatus === "waitlisted" ? "info" : "success",
      title: result.signupStatus === "waitlisted" ? "已加入候補" : "報名完成",
    });
  } catch (error) {
    console.error("Class signup submit failed:", error);
    const errorCode = String(error?.code || "").replace(/^firestore\//, "");
    const offline = !navigator.onLine || errorCode.includes("unavailable") || errorCode.includes("network");
    showToast(offline ? "網路連線中斷，這次報名尚未寫入，請恢復連線後再試。" : `${error?.message || "請稍後再試一次。"}${errorCode ? `（${errorCode}）` : ""}`, { tone: "error", title: "社課報名失敗" });
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function refreshClassSignupPageSafe({ force = false } = {}) {
  if (pageName !== "class-signup") {
    return;
  }

  const calendar = document.querySelector("[data-class-calendar]");
  const upcomingSessions = document.querySelector("[data-upcoming-class-sessions]");
  const rosterBoard = document.querySelector("[data-class-roster-board]");

  if (!calendar) {
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
    if (upcomingSessions) upcomingSessions.innerHTML = message;
    if (rosterBoard) rosterBoard.innerHTML = message;
    return;
  }

  if (force || !classSignupPageState.loaded) {
    renderLoadingSkeleton(calendar, { rows: 4, label: "社課資料載入中" });
    if (upcomingSessions) renderLoadingSkeleton(upcomingSessions, { rows: 3, label: "社課資料載入中" });
    if (rosterBoard) renderLoadingSkeleton(rosterBoard, { rows: 3, label: "報名名單載入中" });
  }

  try {
    const loadWarnings = [];
    if (currentUser?.uid) {
      await loadWithFallback("社員狀態", loadWarnings, () => loadCurrentMemberStatus(currentUser), currentMemberStatus);
    }
    if (force || !classSignupPageState.loaded) {
      const [sessions, allSignups, ownSignups, approvalDoc, classAlbums] = await Promise.all([
        loadWithFallback("社課日期", loadWarnings, () => getCollectionEntries(CLASS_SESSION_COLLECTION), []),
        loadWithFallback("剩餘名額", loadWarnings, () => getCollectionEntries(CLASS_SESSION_STATS_COLLECTION), []),
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
        currentUser?.uid
          ? loadWithFallback("社課相簿", loadWarnings, () => getCollectionEntries(CLASS_ALBUM_COLLECTION), [])
          : Promise.resolve([]),
      ]);

      classSignupPageState.sessions = sessions;
      classSignupPageState.sessionSignups = allSignups;
      classSignupPageState.classAlbums = classAlbums;
      classSignupPageState.ownSignups = ownSignups.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      classSignupPageState.approval =
        approvalDoc && typeof approvalDoc.exists === "function" && approvalDoc.exists() ? approvalDoc.data() : null;
      classSignupPageState.loadWarnings = loadWarnings;
      classSignupPageState.loaded = true;
    }

    renderClassCalendarBoard(classSignupPageState.sessions);
    clearLoadingState(calendar);
    if (rosterBoard) {
      renderClassRosterBoard(classSignupPageState.sessions);
      clearLoadingState(rosterBoard);
    }
    const { calendarModal: classSignupModal } = getClassSignupModalElements();
    const activeSessionId = classSignupModal?.dataset.sessionId || "";
    if (classSignupModal && !classSignupModal.hidden && activeSessionId) {
      renderClassSignupModalContent(activeSessionId);
    }
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
    if (upcomingSessions) {
      upcomingSessions.innerHTML = message;
      clearLoadingState(upcomingSessions);
    }
    if (rosterBoard) rosterBoard.innerHTML = message;
  }
}

function renderAnnouncementsBoard(announcements = []) {
  const container = document.querySelector("[data-announcement-board]");
  if (!container) {
    return;
  }

  const datedAnnouncements = [...announcements]
    .map((announcement) => ({
      ...announcement,
      dateKey: getAnnouncementDateKey(announcement),
    }))
    .filter((announcement) => announcement.dateKey);

  const referenceDate = new Date();
  referenceDate.setDate(1);
  referenceDate.setMonth(referenceDate.getMonth() + announcementCalendarMonthOffset);

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const monthLabel = referenceDate.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = formatDateInputValue(new Date());

  const announcementsByDate = datedAnnouncements.reduce((acc, announcement) => {
    getAnnouncementDateKeys(announcement).forEach((dateKey) => {
      const date = parseDateKey(dateKey);
      if (!date || date.getFullYear() !== year || date.getMonth() !== month) {
        return;
      }
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(announcement);
    });
    return acc;
  }, {});

  const cells = [];
  for (let index = 0; index < offset; index += 1) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = formatDateInputValue(new Date(year, month, day));
    const dayAnnouncements = (announcementsByDate[dateKey] || []).sort((a, b) => getAnnouncementSortMs(a) - getAnnouncementSortMs(b));
    const hasAnnouncement = dayAnnouncements.length > 0;
    const hasHoliday = dayAnnouncements.some((announcement) => getNoticeEventType(announcement) === "holiday");
    const isToday = dateKey === todayKey;
    const dayColor = hasAnnouncement
      ? normalizeCalendarColor(dayAnnouncements[0].color || (getNoticeEventType(dayAnnouncements[0]) === "holiday" ? "orange" : "blue"))
      : "";

    const dayTag = hasAnnouncement ? "button" : "article";
    const dayAttrs = hasAnnouncement ? ` type="button" data-public-announcement-day data-date-key="${escapeHtml(dateKey)}"` : "";
    cells.push(`
      <${dayTag} class="admin-calendar-day${hasAnnouncement ? " is-session has-announcement is-clickable" : ""}${dayColor ? ` calendar-day-color-${escapeHtml(dayColor)}` : ""}${hasHoliday ? " has-holiday" : ""}${isToday ? " is-today" : ""}"${dayAttrs}>
        <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
        <span class="admin-calendar-day-events">
          ${dayAnnouncements
            .map((announcement) => {
              const isHoliday = getNoticeEventType(announcement) === "holiday";
              const color = normalizeCalendarColor(announcement.color || (isHoliday ? "orange" : "blue"));
              const timeLabel = isHoliday ? "連續假期" : getAnnouncementTimeLabel(announcement);
              return `
                <span class="admin-calendar-day-event calendar-color-${escapeHtml(color)}${isHoliday ? " is-holiday" : ""}">
                  <span class="admin-calendar-day-event-bullet" aria-hidden="true">•</span>
                  <span class="admin-calendar-day-event-copy">
                    <strong class="announcement-calendar-title">${escapeHtml(getLocalizedContentTitle(announcement))}</strong>
                    ${timeLabel ? `<small>${escapeHtml(timeLabel)}</small>` : ""}
                  </span>
                </span>
              `;
            })
            .join("")}
        </span>
      </${dayTag}>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="admin-calendar-day is-empty" aria-hidden="true"></div>`);
  }

  const monthAnnouncementCount = Object.values(announcementsByDate).reduce((total, items) => total + items.length, 0);

  container.classList.remove("notice-grid");
  container.innerHTML = `
    <div class="admin-calendar-shell announcement-calendar-shell">
      <div class="admin-calendar-header">
        <div>
          <p class="section-kicker">Calendar</p>
          <h3 class="content-title">${escapeHtml(monthLabel)}</h3>
          <p class="section-description">管理行事曆中的社課、公告與連續假期會同步顯示在這裡。</p>
        </div>
        <div class="admin-calendar-nav">
          <button class="button-secondary" data-announcement-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-announcement-calendar-next type="button">下個月</button>
        </div>
      </div>
      ${monthAnnouncementCount === 0 ? `<p class="admin-calendar-empty-board">這個月份目前沒有社課或公告。</p>` : ""}
      <div class="admin-calendar-weekdays">
        ${dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="admin-calendar-grid">
        ${cells.join("")}
      </div>
    </div>
  `;

  container.querySelector("[data-announcement-calendar-prev]")?.addEventListener("click", () => {
    announcementCalendarMonthOffset -= 1;
    renderAnnouncementsBoard(announcementPageState.announcements);
  });

  container.querySelector("[data-announcement-calendar-next]")?.addEventListener("click", () => {
    announcementCalendarMonthOffset += 1;
    renderAnnouncementsBoard(announcementPageState.announcements);
  });

  container.querySelectorAll("[data-public-announcement-day]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const dateKey = button.dataset.dateKey || "";
      const events = announcementPageState.announcements
        .filter((announcement) => isDateWithinAnnouncement(dateKey, announcement))
        .map((announcement) => ({
          type: getNoticeEventType(announcement),
          id: getAdminCalendarAnnouncementId(announcement),
          title: getLocalizedContentTitle(announcement, getNoticeEventType(announcement) === "class" ? "社課" : "公告"),
          timeLabel: getNoticeEventType(announcement) === "holiday" ? "連續假期" : getAnnouncementTimeLabel(announcement),
          location: announcement.location || "",
          note: getAnnouncementNote(announcement),
          color: normalizeCalendarColor(announcement.color || (getNoticeEventType(announcement) === "holiday" ? "orange" : "blue")),
          source: announcement,
        }));
      const parsedDate = parseDateKey(dateKey);
      openPublicCalendarModal({
        title: parsedDate
          ? parsedDate.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
          : dateKey,
        subtitle: `${getWeekdayLabel(DATE_WEEKDAY_ORDER[parsedDate?.getDay?.() ?? 0] || "")} · ${events.length} 筆內容`,
        events,
      });
    });
  });
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

  if (force || !announcementPageState.loaded) {
    renderLoadingSkeleton(board, { rows: 4, label: "公告載入中" });
  }

  try {
    const loadWarnings = [];
    if (force || !announcementPageState.loaded) {
      const [announcements, sessions, holidaySeedSnapshot] = await Promise.all([
        loadWithFallback(
          "公告",
          loadWarnings,
          () => getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION),
          [],
        ),
        loadWithFallback(
          "社課",
          loadWarnings,
          () => getCollectionEntries(CLASS_SESSION_COLLECTION),
          [],
        ),
        loadWithFallback(
          "連續假期設定",
          loadWarnings,
          () => getDoc(getSiteSettingsDocRef(CALENDAR_HOLIDAY_SEED_DOC)),
          null,
        ),
      ]);
      const defaultHolidayEntries = holidaySeedSnapshot?.exists?.()
        ? []
        : TAIWAN_LONG_HOLIDAYS.map((holiday) => ({
            id: `holiday-${holiday.startDate}`,
            date: holiday.startDate,
            endDate: holiday.endDate,
            title: holiday.title,
            reminder: "連續假期",
            body: "連續假期",
            color: "orange",
            eventType: "holiday",
            calendarEventType: "holiday",
          }));
      announcementPageState.announcements = [
        ...announcements.map((entry) => ({ ...entry, calendarEventType: getNoticeEventType(entry) })),
        ...sessions.map(normalizeClassSessionAsNotice),
        ...defaultHolidayEntries,
      ];
      announcementPageState.loadWarnings = loadWarnings;
      announcementPageState.loaded = true;
    }

    renderAnnouncementsBoard(announcementPageState.announcements);
    clearLoadingState(board);
    if (announcementPageState.loadWarnings.length > 0) {
      board.insertAdjacentHTML(
        "afterbegin",
        buildLoadWarningMarkup({
          title: "部分資料載入失敗",
          copy: "目前部分社課或公告資料無法讀取，下面仍會顯示已載入的內容。",
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

  const requiredFaq = {
    question: "註冊網站帳號就算加入羽球社了嗎？",
    answer: "不算。註冊時會填寫入社資料，註冊後可以登入並送出報名；社費是入社時一次付清，完成社費繳納並由幹部標記後，才會成為正式社員。尚未成為社員者，報名單場社課時才需要依場次繳零打費。",
    pinned: true,
  };
  const answeredFaqs = faqEntries.filter((faq) => String(faq.answer || faq.body || "").trim());
  const hasRequiredFaq = answeredFaqs.some((faq) => String(faq.question || "").trim() === requiredFaq.question);
  const sortedFaqs = [
    requiredFaq,
    ...answeredFaqs.filter((faq) => !(hasRequiredFaq && String(faq.question || "").trim() === requiredFaq.question)),
  ].sort((a, b) => {
    if (a.pinned) return -1;
    if (b.pinned) return 1;
    return getFaqSortMs(b) - getFaqSortMs(a);
  });

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

function bindFaqQuestionForm() {
  const form = document.querySelector("[data-faq-question-form]");
  if (!form || form.dataset.initialized === "true") {
    return;
  }

  form.dataset.initialized = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = String(form.querySelector("[name='question']")?.value || "").trim();
    const submitButton = form.querySelector("[data-faq-question-submit]");
    const status = form.querySelector("[data-faq-question-status]");

    if (question.length < 2) {
      window.alert("請輸入想詢問的問題。");
      return;
    }
    if (/[<>]/.test(question)) {
      window.alert("問題內容不可包含 HTML 標籤或角括號。");
      return;
    }

    submitButton.disabled = true;
    if (status) {
      status.textContent = "問題送出中…";
    }

    try {
      await ensureAuthReady();
      if (!currentUser?.uid) {
        if (status) status.textContent = "請先登入後再送出問題。";
        openLoginModal(submitButton);
        return;
      }
      const questionRef = doc(collection(db, FAQ_QUESTION_COLLECTION));
      await setDoc(questionRef, {
        question,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      form.reset();
      if (status) {
        status.textContent = "問題已送出，管理員回答後會顯示在上方 FAQ。";
      }
    } catch (error) {
      console.error("Submit FAQ question failed:", error);
      if (status) {
        status.textContent = "問題送出失敗，請稍後再試一次。";
      }
      window.alert(`問題送出失敗：${error?.message || "請稍後再試一次。"}`);
    } finally {
      submitButton.disabled = false;
    }
  });
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
                <span>${escapeHtml(
                  getAnnouncementDateKey(announcement)
                    ? getAnnouncementEndDateKey(announcement) !== getAnnouncementDateKey(announcement)
                      ? `${getAnnouncementDateKey(announcement)} ～ ${getAnnouncementEndDateKey(announcement)}`
                      : getAnnouncementDateKey(announcement)
                    : formatTimestamp(announcement.createdAt),
                )}</span>
                ${getAnnouncementTimeLabel(announcement) ? `<span>${escapeHtml(getAnnouncementTimeLabel(announcement))}</span>` : ""}
                <span>${escapeHtml(announcement.reminder || "公告")}</span>
              </div>
              <h3 class="notice-title">${escapeHtml(getLocalizedContentTitle(announcement, "公告"))}</h3>
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

function renderAdminFaqQuestions(questionEntries = []) {
  const container = document.querySelector("[data-faq-question-admin-list]");
  if (!container) {
    return;
  }

  const sortedQuestions = questionEntries
    .filter((entry) => entry.status !== "answered" && !String(entry.answer || "").trim())
    .sort((a, b) => getFaqSortMs(b) - getFaqSortMs(a));

  if (sortedQuestions.length === 0) {
    container.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有待處理問題</h3>
        <p class="content-copy">訪客從 FAQ 頁送出問題後，會依序顯示在這裡。</p>
      </article>
    `;
    return;
  }

  container.innerHTML = sortedQuestions
    .map((entry, index) => {
      return `
        <article class="content-card is-tight faq-question-admin-card">
          <div class="faq-question-admin-header">
            <span class="timeline-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="member-status-badge">待回答</span>
          </div>
          <h4 class="content-title">${escapeHtml(entry.question || "未填寫問題")}</h4>
          <form class="form-grid faq-form" data-faq-question-answer-form data-question-id="${escapeHtml(entry.id)}">
            <div class="form-field">
              <label for="faq-question-answer-${escapeHtml(entry.id)}">回答</label>
              <textarea id="faq-question-answer-${escapeHtml(entry.id)}" name="answer" rows="4" placeholder="輸入回答後會發布到 FAQ">${escapeHtml(entry.answer || "")}</textarea>
            </div>
            <div class="application-actions class-admin-actions">
              <button class="button-primary" type="submit">發布回答</button>
              <button class="button-secondary application-save" data-faq-question-delete data-question-id="${escapeHtml(entry.id)}" type="button">刪除問題</button>
            </div>
          </form>
        </article>
      `;
    })
    .join("");

  bindAdminFaqQuestionActions(container);
}

function bindAdminFaqQuestionActions(container) {
  container.querySelectorAll("[data-faq-question-answer-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const questionId = String(form.dataset.questionId || "").trim();
      const answer = String(form.querySelector("[name='answer']")?.value || "").trim();
      const entry = membersDashboardCache.faqQuestions.find((question) => question.id === questionId);
      const submitButton = form.querySelector("[type='submit']");
      if (!questionId || !entry || !answer) {
        window.alert("請先輸入回答內容。");
        return;
      }

      submitButton.disabled = true;
      try {
        const batch = writeBatch(db);
        batch.set(
          getFaqDocRef(questionId),
          {
            question: entry.question || "",
            answer,
            sourceQuestionId: questionId,
            createdAt: entry.createdAt || serverTimestamp(),
            answeredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        batch.delete(getFaqQuestionDocRef(questionId));
        await batch.commit();
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
        showToast("問題回答已發布。", { tone: "success" });
      } catch (error) {
        console.error("Answer FAQ question failed:", error);
        window.alert(`回答問題失敗：${error?.message || "請稍後再試一次。"}`);
        submitButton.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-faq-question-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const questionId = String(button.dataset.questionId || "").trim();
      if (!questionId || !window.confirm("確定要刪除這個問題嗎？已發布的 FAQ 回答也會一併移除。")) {
        return;
      }

      button.disabled = true;
      try {
        const batch = writeBatch(db);
        batch.delete(getFaqQuestionDocRef(questionId));
        batch.delete(getFaqDocRef(questionId));
        await batch.commit();
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete FAQ question failed:", error);
        window.alert(`刪除問題失敗：${error?.message || "請稍後再試一次。"}`);
        button.disabled = false;
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

    announcementPageState.loaded = false;
    form.reset();
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
    showToast("公告已儲存。", { tone: "success" });
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
    showToast("FAQ 已儲存。", { tone: "success" });
  } catch (error) {
    console.error("Save FAQ failed:", error);
    window.alert(`儲存 FAQ 失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
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

const buildAdminSignupOverviewMarkup = (sessions = [], signups = []) => {
  const grouped = groupClassSignupsBySession(signups);
  const membersById = Object.fromEntries(membersDashboardCache.members.map((member) => [member.uid || member.id, member]));
  const sessionsWithSignups = sessions
    .map((session) => ({ session, sessionId: getClassSessionId(session), signups: grouped[getClassSessionId(session)] || [] }))
    .filter((entry) => entry.signups.length > 0)
    .sort((a, b) => getClassSessionSortMs(a.session) - getClassSessionSortMs(b.session));

  if (sessionsWithSignups.length === 0) {
    return `
      <section class="member-section">
        <div class="section-header is-compact">
          <div class="section-kicker">Signups</div>
          <h3 class="content-title">報名名單</h3>
          <p class="section-description">目前還沒有任何報名資料。</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="member-section">
      <div class="section-header is-compact">
        <div class="section-kicker">Signups</div>
        <h3 class="content-title">報名名單</h3>
        <p class="section-description">依場次顯示所有報名者。正式社員不需要單場零打費；非社員可在這裡標記該場零打費，社費請到社員名單標記。</p>
      </div>
      <div class="member-list">
        ${sessionsWithSignups
          .map(({ session, sessionId, signups: sessionSignups }) => {
            const limit = getSessionSignupLimit(session);
            const sortedSignups = [...sessionSignups].sort((a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt));
            const exportAvailable = isClassSignupExportAvailable(session);
            return `
              <article class="member-row">
                <div class="member-row-top">
                  <p class="member-row-index">${escapeHtml(getLocalizedContentTitle(session, "社團報名"))}</p>
                  <p class="member-row-status">${limit ? `上限 ${limit} 人` : "不限人數"}</p>
                </div>
                <p class="member-row-email">${escapeHtml([getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" / "))}</p>
                <div class="application-actions">
                  <button class="button-primary" data-class-signup-export type="button" data-session-id="${escapeHtml(sessionId)}"${exportAvailable ? "" : " disabled"}>
                    ${exportAvailable ? "匯出 Excel（社員／非社員）" : "報名截止後可匯出 Excel"}
                  </button>
                </div>
                <div class="member-list">
                  ${sortedSignups
                    .map((signup, index) => {
                      const computedStatus = getComputedSignupStatus(signup, index, session);
                      const member = membersById[signup.userId] || null;
                      const isFormalMember = isFormalMemberSignup(signup, member);
                      const dropInPaid = signup.dropInPaymentStatus === "paid";
                      const paymentLabel = getSignupPaymentLabel(signup, member);
                      const paymentAction = isFormalMember
                        ? ""
                        : `<button class="button-secondary application-save" data-class-dropin-payment type="button" data-signup-id="${escapeHtml(signup.id || `${sessionId}-${signup.userId}`)}" data-dropin-payment-status="${dropInPaid ? "unpaid" : "paid"}">${dropInPaid ? "標記零打未繳" : "標記零打已繳"}</button>`;
                      return `
                        <details class="member-row is-nested member-row-expandable class-signup-member-row">
                          <summary class="member-row-summary">
                            <span class="member-row-top">
                              <span class="member-row-index">#${String(index + 1).padStart(2, "0")} ${escapeHtml(signup.name || "未填姓名")}</span>
                              <span class="member-row-summary-side">
                                <span class="member-row-status">${escapeHtml(getSignupStatusLabel({ ...signup, signupStatus: computedStatus }))} / ${escapeHtml(paymentLabel)}</span>
                                <span class="faq-icon" aria-hidden="true">
                                  <span class="faq-icon-line faq-icon-line-horizontal"></span>
                                  <span class="faq-icon-line faq-icon-line-vertical"></span>
                                </span>
                              </span>
                            </span>
                          </summary>
                          <div class="member-row-detail">
                            <p class="member-row-email">${escapeHtml(signup.email || "未填信箱")}</p>
                            <div class="member-row-meta">
                              <span>學號：${escapeHtml(signup.studentId || "未填寫")}</span>
                              <span>身分：${escapeHtml(isFormalMember ? "正式社員" : "非社員零打")}</span>
                              <span>備註：${escapeHtml(signup.note || "無")}</span>
                            </div>
                            <div class="application-actions">
                              ${paymentAction}
                              <button class="button-secondary application-save" data-class-signup-admin-delete type="button" data-signup-id="${escapeHtml(signup.id || `${sessionId}-${signup.userId}`)}" data-signup-name="${escapeHtml(signup.name || signup.email || "這位成員")}" data-session-id="${escapeHtml(sessionId)}">刪除報名</button>
                            </div>
                          </div>
                        </details>
                      `;
                    })
                    .join("")}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
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
  const monthAnnouncements = membersDashboardCache.announcements;

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
  const announcementsByDate = monthAnnouncements.reduce((acc, announcement) => {
    getAnnouncementDateKeys(announcement).forEach((dateKey) => {
      const date = parseDateKey(dateKey);
      if (!date || date.getFullYear() !== year || date.getMonth() !== month) {
        return;
      }
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(announcement);
    });
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
    const dayAnnouncements = announcementsByDate[dateKey] || [];
    const dayHolidays = dayAnnouncements.filter((announcement) => getNoticeEventType(announcement) === "holiday");
    const dayEvents = [
      ...daySessions.map((session) => ({
        title: getLocalizedContentTitle(session),
        timeLabel: getClassSessionTimeLabel(session),
        sortMs: getClassSessionSortMs(session),
        color: normalizeCalendarColor(session.color),
      })),
      ...dayAnnouncements.map((announcement) => ({
        title: getLocalizedContentTitle(announcement),
        timeLabel: getNoticeEventType(announcement) === "holiday" ? "連續假期" : getAnnouncementTimeLabel(announcement),
        sortMs: getAnnouncementSortMs(announcement),
        color: normalizeCalendarColor(announcement.color || (getNoticeEventType(announcement) === "holiday" ? "orange" : "blue")),
        isHoliday: getNoticeEventType(announcement) === "holiday",
      })),
    ].sort((a, b) => a.sortMs - b.sortMs || a.title.localeCompare(b.title, "zh-Hant"));
    const eventCount = dayEvents.length;
    const announcementCount = dayAnnouncements.length;
    const isToday = dateKey === todayKey;
    const dayColor = dayEvents[0]?.color || "";

    cells.push(`
      <button
        class="admin-calendar-day${eventCount > 0 ? " is-session" : ""}${announcementCount > 0 ? " has-announcement" : ""}${dayColor ? ` calendar-day-color-${escapeHtml(dayColor)}` : ""}${dayHolidays.length ? " has-holiday" : ""}${isToday ? " is-today" : ""}"
        type="button"
        data-admin-calendar-day
        data-date-key="${escapeHtml(dateKey)}"
      >
        <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
        <span class="admin-calendar-day-events">
          ${dayEvents
            .map(
              (event) => `
                <span class="admin-calendar-day-event calendar-color-${escapeHtml(event.color || DEFAULT_CALENDAR_COLOR)}${event.isHoliday ? " is-holiday" : ""}">
                  <span class="admin-calendar-day-event-bullet" aria-hidden="true">•</span>
                  <span class="admin-calendar-day-event-copy">
                    <strong class="announcement-calendar-title">${escapeHtml(event.title)}</strong>
                    ${event.timeLabel ? `<small>${escapeHtml(event.timeLabel)}</small>` : ""}
                  </span>
                </span>
              `,
            )
            .join("")}
        </span>
      </button>
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
          <p class="section-description">點選任何日期都可以新增社課或公告。</p>
        </div>
        <div class="admin-calendar-nav">
          <label class="admin-calendar-date-jump">
            <span>快速選擇日期</span>
            <input data-admin-calendar-date-jump type="date" value="${escapeHtml(todayKey)}" />
          </label>
          <button class="button-secondary" data-admin-calendar-today type="button">今天</button>
          <button class="button-secondary" data-admin-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-admin-calendar-next type="button">下個月</button>
        </div>
      </div>
      ${monthSessions.length + monthAnnouncements.length === 0 ? `<p class="admin-calendar-empty-board">這個月份目前沒有社課或公告，可以直接點選日期新增。</p>` : ""}
      <div class="admin-calendar-weekdays">
        ${dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="admin-calendar-grid">
        ${cells.join("")}
      </div>
    </div>
    ${buildAdminSignupOverviewMarkup(sessions, signups)}
  `;

  container.querySelector("[data-admin-calendar-prev]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset -= 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  container.querySelector("[data-admin-calendar-next]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset += 1;
    renderAdminClassCalendarCompact(sessions, signups);
  });

  container.querySelector("[data-admin-calendar-today]")?.addEventListener("click", () => {
    adminClassCalendarMonthOffset = 0;
    renderAdminClassCalendarCompact(sessions, signups);
    window.setTimeout(() => openAdminClassCalendarModal(formatDateInputValue(new Date())), 0);
  });

  const dateJumpInput = container.querySelector("[data-admin-calendar-date-jump]");
  const handleAdminCalendarDateJump = (event) => {
    const dateKey = String(event.currentTarget.value || "");
    const date = parseDateKey(dateKey);
    if (!date) {
      return;
    }
    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(date);
    renderAdminClassCalendarCompact(sessions, signups);
    const nextDateJumpInput = container.querySelector("[data-admin-calendar-date-jump]");
    if (nextDateJumpInput instanceof HTMLInputElement) {
      nextDateJumpInput.value = dateKey;
    }
    window.setTimeout(() => openAdminClassCalendarModal(dateKey), 0);
  };
  dateJumpInput?.addEventListener("input", handleAdminCalendarDateJump);
  dateJumpInput?.addEventListener("change", handleAdminCalendarDateJump);

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
      openAdminClassCalendarModal(dateKey, button);
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

  const { form, deleteButton } = getAdminClassCalendarModalElements();
  if (form && form.dataset.initialized !== "true") {
    form.dataset.initialized = "true";
    form.addEventListener("submit", handleAdminCalendarEventSubmit);
    form.querySelector("[name='eventType']")?.addEventListener("change", (event) => {
      const signupToggle = form.querySelector(".admin-calendar-signup-toggle");
      const signupSettings = form.querySelector("[data-admin-calendar-signup-settings]");
      const signupPanel = form.querySelector("[data-admin-calendar-signup-panel]");
      const announcementEndDateField = form.querySelector("[data-announcement-end-date-field]");
      const classAlbumField = form.querySelector("[data-class-album-field]");
      const signupFieldsHidden = event.target.value !== "class";
      const colorSelect = form.querySelector("[name='color']");
      if (colorSelect instanceof HTMLSelectElement && event.target.value === "holiday" && colorSelect.value === DEFAULT_CALENDAR_COLOR) {
        colorSelect.value = "orange";
      }
      if (signupToggle) {
        signupToggle.hidden = signupFieldsHidden;
      }
      if (signupSettings) {
        signupSettings.hidden = signupFieldsHidden || !form.querySelector("[name='signupRequired']")?.checked;
      }
      if (signupPanel) {
        signupPanel.hidden = signupFieldsHidden;
      }
      if (announcementEndDateField) {
        announcementEndDateField.hidden = !signupFieldsHidden;
      }
      if (classAlbumField) {
        classAlbumField.hidden = signupFieldsHidden;
      }
      if (signupFieldsHidden) {
        const startDate = form.querySelector("[name='date']")?.value || "";
        const endDateInput = form.querySelector("[name='endDate']");
        if (endDateInput instanceof HTMLInputElement && !endDateInput.value) {
          endDateInput.value = startDate;
        }
      }
    });
    form.querySelector("[name='signupRequired']")?.addEventListener("change", (event) => {
      const signupSettings = form.querySelector("[data-admin-calendar-signup-settings]");
      if (signupSettings) signupSettings.hidden = !event.target.checked;
    });
    form.querySelector("[name='date']")?.addEventListener("change", (event) => {
      const endDateInput = form.querySelector("[name='endDate']");
      if (endDateInput instanceof HTMLInputElement && (!endDateInput.value || endDateInput.value < event.target.value)) {
        endDateInput.value = event.target.value;
      }
    });
  }

  if (deleteButton && deleteButton.dataset.initialized !== "true") {
    deleteButton.dataset.initialized = "true";
    deleteButton.addEventListener("click", handleAdminCalendarEventDelete);
  }

  document.querySelectorAll("[data-admin-calendar-event-edit]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const eventType = button.dataset.eventType || "";
      const eventId = button.dataset.eventId || "";
      const dateKey = getAdminClassCalendarModalElements().form?.querySelector("[name='date']")?.value || "";
      const event = getAdminCalendarEventsForDate(dateKey).find((item) => item.type === eventType && item.id === eventId);
      if (event) {
        setAdminCalendarEventForm(event, dateKey);
      }
    });
  });

  document.querySelector("[data-admin-calendar-event-add]")?.addEventListener("click", () => {
    const dateKey = getAdminClassCalendarModalElements().form?.querySelector("[name='date']")?.value || "";
    setAdminCalendarEventForm(null, dateKey);
  });

  document.querySelectorAll("[data-class-dropin-payment]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const signupId = button.dataset.signupId || "";
      const nextDropInPaymentStatus = button.dataset.dropinPaymentStatus === "paid" ? "paid" : "unpaid";

      if (!signupId) {
        return;
      }

      button.disabled = true;
      try {
        await updateDoc(doc(db, CLASS_SIGNUP_COLLECTION, signupId), {
          dropInPaymentStatus: nextDropInPaymentStatus,
          dropInPaidAt: nextDropInPaymentStatus === "paid" ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        });

        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Update drop-in payment status failed:", error);
        window.alert(`更新零打費狀態失敗：${error?.message || "請稍後再試一次。"}`);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-class-signup-export]").forEach((button) => {
    if (button.dataset.initialized === "true") return;
    button.dataset.initialized = "true";
    button.addEventListener("click", () => {
      const sessionId = String(button.dataset.sessionId || "").trim();
      const session = membersDashboardCache.classSessions.find((entry) => getClassSessionId(entry) === sessionId);
      const signups = membersDashboardCache.classSessionSignups.filter((entry) => String(entry.sessionId || "") === sessionId);
      if (!session) return;
      try {
        downloadClassSignupExcel(session, signups);
        showToast(`已匯出「${session.title || "社課"}」名單，並分成社員與非社員工作表。`, { tone: "success" });
      } catch (error) {
        showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "匯出失敗" });
      }
    });
  });

  document.querySelectorAll("[data-class-signup-admin-delete]").forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", async () => {
      const signupId = String(button.dataset.signupId || "").trim();
      const sessionId = String(button.dataset.sessionId || "").trim();
      const signupName = String(button.dataset.signupName || "這位成員").trim();
      if (!signupId || !sessionId || !window.confirm(`確定要刪除 ${signupName} 的這筆社課報名嗎？`)) {
        return;
      }

      button.disabled = true;
      try {
        await adminDeleteClassSessionSignup(sessionId, signupId);
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
      } catch (error) {
        console.error("Delete class signup failed:", error);
        window.alert(`刪除報名失敗：${error?.message || "請稍後再試一次。"}`);
        button.disabled = false;
      }
    });
  });

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
        await adminDeleteClassSession(sessionId);

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

async function handleAdminCalendarEventSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-admin-calendar-save]");
  const eventId = String(form.dataset.editingId || form.querySelector("[name='eventId']")?.value || "").trim();
  const originalEventType = String(form.dataset.editingType || "").trim();
  const date = String(form.querySelector("[name='date']")?.value || "").trim();
  const eventType = String(form.querySelector("[name='eventType']")?.value || form.dataset.editingType || "class").trim();
  const titleZh = String(form.querySelector("[name='titleZh']")?.value || "").trim();
  const titleEn = String(form.querySelector("[name='titleEn']")?.value || "").trim();
  const title = titleZh;
  const endDate = eventType !== "class" ? String(form.querySelector("[name='endDate']")?.value || date).trim() : date;
  const color = normalizeCalendarColor(form.querySelector("[name='color']")?.value);
  const startTime = String(form.querySelector("[name='startTime']")?.value || "").trim();
  const endTime = String(form.querySelector("[name='endTime']")?.value || "").trim();
  const timeLabel = buildEventTimeLabel(startTime, endTime);
  const location = String(form.querySelector("[name='location']")?.value || "").trim();
  const note = String(form.querySelector("[name='note']")?.value || "").trim();
  const albumUrl = String(form.querySelector("[name='albumUrl']")?.value || "").trim();
  const signupRequired = Boolean(form.querySelector("[name='signupRequired']")?.checked);
  const memberSignupOpenAt = String(form.querySelector("[name='memberSignupOpenAt']")?.value || "").trim();
  const publicSignupOpenAt = String(form.querySelector("[name='publicSignupOpenAt']")?.value || "").trim();
  const signupCloseAt = String(form.querySelector("[name='signupCloseAt']")?.value || "").trim();
  const signupLimit = Number(form.querySelector("[name='signupLimit']")?.value || 0);
  const weekday = getWeekdayKeyFromDateValue(date);

  if (!["class", "announcement", "holiday"].includes(eventType)) {
    showToast("請選擇有效的行事曆類型。", { tone: "error" });
    return;
  }

  if (!date || !titleZh || !titleEn) {
    showToast("請先填寫中文標題、英文標題與日期。", { tone: "error", title: "資料尚未完整" });
    return;
  }

  if (eventType === "class" && albumUrl && !/^https:\/\//i.test(albumUrl)) {
    showToast("相簿連結必須使用 https:// 開頭。", { tone: "error", title: "相簿連結格式錯誤" });
    form.querySelector("[name='albumUrl']")?.focus();
    return;
  }

  if ((startTime && !endTime) || (!startTime && endTime)) {
    showToast("開始時間與結束時間請一起填寫，或兩者都留空。", { tone: "error" });
    return;
  }

  if (eventType !== "class" && endDate < date) {
    showToast("結束日期不能早於開始日期。", { tone: "error" });
    form.querySelector("[name='endDate']")?.focus();
    return;
  }

  if (startTime && endTime && date === endDate && startTime >= endTime) {
    showToast("結束時間必須晚於開始時間。", { tone: "error" });
    return;
  }

  if (eventType === "class" && signupRequired && (!memberSignupOpenAt || !publicSignupOpenAt || !signupCloseAt)) {
    showToast("請完整設定社員開始、全面開放與報名截止三個時間。", { tone: "error" });
    return;
  }

  if (eventType === "class" && signupRequired && !(
    getDateTimeLocalMs(memberSignupOpenAt) < getDateTimeLocalMs(publicSignupOpenAt)
    && getDateTimeLocalMs(publicSignupOpenAt) < getDateTimeLocalMs(signupCloseAt)
  )) {
    showToast("三個報名時間必須依序為：社員開始、全面開放、報名截止。", { tone: "error" });
    form.querySelector("[name='publicSignupOpenAt']")?.focus();
    return;
  }

  const changesStorageCollection = Boolean(
    eventId
    && originalEventType
    && originalEventType !== eventType
    && (originalEventType === "class" || eventType === "class"),
  );
  if (changesStorageCollection) {
    const confirmed = window.confirm(
      originalEventType === "class"
        ? "確定要把這筆社課改成公告或連續假期嗎？原社課與相關報名資料會一併移除，且無法復原。"
        : "確定要把這筆公告或連續假期改成社課嗎？原本的公告資料會移除並建立新的社課資料。",
    );
    if (!confirmed) {
      return;
    }
  }

  setButtonLoading(submitButton, true, "儲存中…");

  try {
    if (eventType !== "class") {
      const announcementRef = eventId ? getClassAnnouncementDocRef(eventId) : doc(collection(db, CLASS_ANNOUNCEMENT_COLLECTION));
      const existing = eventId ? await getDoc(announcementRef) : null;
      await setDoc(
        announcementRef,
        {
          date,
          endDate,
          title,
          titleZh,
          titleEn,
          eventType,
          calendarEventType: eventType,
          color,
          startTime,
          endTime,
          timeLabel,
          location,
          reminder: note,
          body: note,
          createdAt: existing?.exists() ? existing.data()?.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (originalEventType === "class") {
        await adminDeleteClassSession(eventId);
      }
      announcementPageState.loaded = false;
    } else {
      const sessionRef = eventId ? getClassSessionDocRef(eventId) : doc(collection(db, CLASS_SESSION_COLLECTION));
      const existing = eventId ? await getDoc(sessionRef) : null;
      await setDoc(
        sessionRef,
        {
          sessionId: sessionRef.id,
          date,
          weekday,
          title,
          titleZh,
          titleEn,
          color,
          startTime,
          endTime,
          timeLabel,
          location,
          description: note,
          reminder: note,
          signupRequired,
          allowNonMembers: signupRequired && Boolean(publicSignupOpenAt),
          memberSignupOpenAt,
          publicSignupOpenAt,
          signupOpenAt: memberSignupOpenAt,
          signupCloseAt,
          signupLimit: Number.isFinite(signupLimit) && signupLimit > 0 ? Math.floor(signupLimit) : null,
          rosterPublished: existing?.exists() ? Boolean(existing.data()?.rosterPublished) : false,
          publishedRoster: existing?.exists() ? existing.data()?.publishedRoster || [] : [],
          publishedAt: existing?.exists() ? existing.data()?.publishedAt || null : null,
          createdAt: existing?.exists() ? existing.data()?.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await setDoc(
        getClassAlbumDocRef(sessionRef.id),
        {
          sessionId: sessionRef.id,
          url: albumUrl,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || "",
        },
        { merge: true },
      );
      if (eventId && originalEventType && originalEventType !== "class") {
        await deleteDoc(getClassAnnouncementDocRef(eventId));
      }
      classSignupPageState.loaded = false;
    }

    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(parseDateKey(date) || new Date());
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
    closeAdminClassCalendarModal();
    showToast(eventId ? "行事曆內容已更新。" : "行事曆內容已建立。", { tone: "success" });
  } catch (error) {
    console.error("Save calendar event failed:", error);
    showToast(error?.message || "請稍後再試一次。", { tone: "error", title: "儲存失敗" });
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function handleAdminCalendarEventDelete() {
  const { form, deleteButton } = getAdminClassCalendarModalElements();
  const eventId = String(form?.querySelector("[name='eventId']")?.value || "").trim();
  const eventType = String(form?.dataset.editingType || form?.querySelector("[name='eventType']")?.value || "").trim();
  const date = String(form?.querySelector("[name='date']")?.value || "").trim();

  if (!eventId || !eventType) {
    return;
  }

  const eventTypeLabel = eventType === "holiday" ? "連續假期" : eventType === "announcement" ? "公告" : "社課";
  const confirmed = window.confirm(`確定要刪除這筆${eventTypeLabel}嗎？`);
  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;

  try {
    if (eventType !== "class") {
      await deleteDoc(getClassAnnouncementDocRef(eventId));
    } else {
      await adminDeleteClassSession(eventId);
    }

    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
    openAdminClassCalendarModal(date, lastAdminClassCalendarTrigger);
  } catch (error) {
    console.error("Delete calendar event failed:", error);
    window.alert(`刪除失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    deleteButton.disabled = false;
  }
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
  const signupOpenAt = String(form.querySelector("[name='signupOpenAt']")?.value || "").trim();
  const signupCloseAt = String(form.querySelector("[name='signupCloseAt']")?.value || "").trim();
  const signupLimit = Number(form.querySelector("[name='signupLimit']")?.value || 0);
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

  const faqForm = document.querySelector("[data-faq-form]");
  if (faqForm && faqForm.dataset.initialized !== "true") {
    faqForm.dataset.initialized = "true";
    faqForm.addEventListener("submit", handleFaqFormSubmit);
  }
}

const populatePersonalProfileForm = (form) => {
  if (!(form instanceof HTMLFormElement)) return;
  const profile = currentMemberProfile || {};
  const settingsName = form.querySelector("[data-account-settings-name]");
  const settingsEmail = form.querySelector("[data-account-settings-email]");
  if (settingsName) settingsName.textContent = profile.displayName || profile.name || getMembershipStatusCopy(getCurrentMembershipStatus()).label;
  if (settingsEmail) settingsEmail.textContent = `${currentUser?.email || ""} · ${getMembershipStatusCopy(getCurrentMembershipStatus()).label}`;
  ["displayName", "name", "studentId", "department", "phone"].forEach((key) => {
    const input = form.elements.namedItem(key);
    if (input instanceof HTMLInputElement) input.value = profile[key] || (key === "displayName" ? profile.name || "" : "");
  });
  const schoolInput = form.elements.namedItem("school");
  if (schoolInput instanceof HTMLSelectElement) {
    const school = String(profile.school || "臺科大").trim();
    schoolInput.querySelectorAll("[data-custom-school-option]").forEach((option) => option.remove());
    if (school && !["臺科大", "外校"].includes(school)) {
      const option = document.createElement("option");
      option.value = school;
      option.textContent = school;
      option.dataset.customSchoolOption = "true";
      schoolInput.append(option);
    }
    schoolInput.value = school;
  }
  const preferences = profile.notificationPreferences || {};
  const defaults = { notificationAnnouncements: true, notificationClassReminders: true, notificationRegistrationUpdates: true };
  Object.entries(defaults).forEach(([name, fallback]) => {
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.checked = preferences[name.replace("notification", "").replace(/^./, (c) => c.toLowerCase())] ?? fallback;
  });
  const membershipSettingsButton = form.querySelector("[data-open-membership-settings]");
  if (membershipSettingsButton instanceof HTMLButtonElement) {
    membershipSettingsButton.hidden = hasFormalMemberAccess();
  }
  const dangerZone = form.querySelector(".account-danger-zone");
  if (dangerZone instanceof HTMLElement) {
    dangerZone.hidden = currentUserIsAdmin;
  }
};

const handlePersonalProfileSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const hint = form.querySelector("[data-personal-profile-hint]");
  if (!currentUser?.uid) return;
  const values = Object.fromEntries(new FormData(form));
  const displayName = String(values.displayName || "").trim();
  const name = String(values.name || "").trim();
  const studentId = String(values.studentId || "").trim();
  const school = String(values.school || "").trim();
  const department = String(values.department || "").trim();
  const phone = String(values.phone || "").trim();
  if (!name || !studentId || !school || school.length > 100 || !department || !phone) {
    setMessageTone(hint, "請依序選擇學校，並完整填寫姓名、學號、系別與聯絡電話。", "error");
    return;
  }
  try {
    await setDoc(getMemberDocRef(currentUser.uid), {
      displayName: displayName || name, name, studentId, department, school, phone,
      notificationPreferences: {
        announcements: Boolean(form.elements.namedItem("notificationAnnouncements")?.checked),
        classReminders: Boolean(form.elements.namedItem("notificationClassReminders")?.checked),
        registrationUpdates: Boolean(form.elements.namedItem("notificationRegistrationUpdates")?.checked),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await loadCurrentMemberStatus(currentUser);
    updateLoginButtons();
    setMessageTone(hint, "個人資料與通知設定已儲存。", "success");
  } catch (error) {
    setMessageTone(hint, error?.message || "儲存失敗，請稍後再試。", "error");
  }
};

const deleteOwnFirestoreData = async (userId, email) => {
  const [applicationsSnapshot, signupsSnapshot, publicRosterSnapshot, notificationsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "applications"), where("email", "==", email))),
    getDocs(query(collection(db, CLASS_SIGNUP_COLLECTION), where("userId", "==", userId))),
    getDocs(query(collection(db, CLASS_PUBLIC_ROSTER_COLLECTION), where("userId", "==", userId))),
    getDocs(query(collection(db, MEMBER_NOTIFICATION_COLLECTION), where("userId", "==", userId))),
  ]);
  const refs = [
    getMemberDocRef(userId),
    getApprovalDocRef(email),
    ...applicationsSnapshot.docs.map((snapshot) => snapshot.ref),
    ...signupsSnapshot.docs.map((snapshot) => snapshot.ref),
    ...publicRosterSnapshot.docs.map((snapshot) => snapshot.ref),
    ...notificationsSnapshot.docs.map((snapshot) => snapshot.ref),
  ];

  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

const handleDeleteOwnAccount = async (event) => {
  const button = event.currentTarget;
  if (!currentUser?.uid) return;
  const confirmed = window.confirm("確定要永久刪除帳號嗎？\n\n個人資料、入社申請與社課報名紀錄都會刪除，而且無法復原。");
  if (!confirmed) return;
  const password = window.prompt("為了確認是本人操作，請輸入目前的登入密碼：");
  if (password === null) return;
  if (!password) {
    showToast("請輸入目前的登入密碼。", { tone: "error", title: "無法刪除帳號" });
    return;
  }

  setButtonLoading(button, true, "刪除中…");
  try {
    await ensureAuthReady();
    const accountUser = auth?.currentUser || currentUser;
    const email = String(accountUser?.email || "").trim().toLowerCase();
    if (!accountUser?.uid || !email || !EmailAuthProvider || !reauthenticateWithCredential || !deleteUser) {
      throw new Error("帳號驗證服務目前無法使用，請稍後再試。");
    }
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(accountUser, credential);
    const deletedAccountName = String(
      currentMemberProfile?.name || currentMemberProfile?.displayName || accountUser.displayName || "未提供姓名",
    ).trim().slice(0, 100) || "未提供姓名";
    await deleteOwnFirestoreData(accountUser.uid, email);
    const deletionNotificationRef = doc(db, ADMIN_NOTIFICATION_COLLECTION, `account-deleted-${accountUser.uid}`);
    await setDoc(deletionNotificationRef, {
      type: "account_deleted",
      title: "使用者已刪除帳號",
      message: `${deletedAccountName}（${email}）已自行刪除網站帳號。`,
      userId: accountUser.uid,
      email,
      name: deletedAccountName,
      createdAt: serverTimestamp(),
    });
    try {
      await deleteUser(accountUser);
    } catch (deleteError) {
      try {
        await deleteDoc(deletionNotificationRef);
      } catch (rollbackError) {
        console.warn("Rollback account deletion notification failed:", rollbackError);
      }
      throw deleteError;
    }
    currentUser = null;
    currentUserIsAdmin = false;
    currentMemberProfile = null;
    currentMemberStatus = "non_member";
    writeAuthSnapshot(null);
    updateLoginButtons();
    closeLoginModal();
    showToast("帳號與相關資料已永久刪除。", { tone: "success", title: "帳號已刪除" });
  } catch (error) {
    console.error("Delete own account failed:", error);
    const code = String(error?.code || "");
    const message = ["auth/invalid-credential", "auth/wrong-password"].includes(code)
      ? "密碼錯誤，請確認後再試一次。"
      : code === "permission-denied"
        ? "帳號資料刪除權限尚未更新，請先部署最新 Firestore Rules。"
        : code.startsWith("auth/")
          ? getFriendlyAuthError(error)
          : error?.message || "請稍後再試一次。";
    showToast(message, { tone: "error", title: "刪除帳號失敗" });
  } finally {
    setButtonLoading(button, false);
  }
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();

  const { emailInput, passwordInput, confirmInput, authSubmit, signupNameInput, signupStudentIdInput, signupSchoolInput, signupExternalSchoolInput, signupDepartmentInput, signupPhoneInput, privacyConsentInput } = getLoginModalElements();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;
  const signupSchoolType = String(signupSchoolInput?.value || "").trim();
  const signupExternalSchoolName = String(signupExternalSchoolInput?.value || "").trim();
  const signupProfile = {
    name: String(signupNameInput?.value || "").trim(),
    studentId: String(signupStudentIdInput?.value || "").trim(),
    school: signupSchoolType === "外校" ? signupExternalSchoolName : signupSchoolType,
    department: String(signupDepartmentInput?.value || "").trim(),
    phone: String(signupPhoneInput?.value || "").trim(),
    ...readMembershipPaymentForm(event.currentTarget),
  };

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

  if (authMode === "signup" && signupSchoolType === "外校" && !signupExternalSchoolName) {
    setHint("選擇外校時，請輸入學校名稱。", "error");
    return;
  }

  if (authMode === "signup" && (!signupProfile.name || !signupProfile.studentId || !["臺科大", "外校"].includes(signupSchoolType) || !signupProfile.school || signupProfile.school.length > 100 || !signupProfile.department || !signupProfile.phone)) {
    setHint("請先選擇學校，再完整填寫姓名、學號、系別與聯絡電話。", "error");
    return;
  }

  if (authMode === "signup" && !privacyConsentInput?.checked) {
    setHint("必須閱讀並同意個人資料蒐集說明後才能註冊帳號。", "error");
    return;
  }

  if (authMode === "signup") {
    if (signupProfile.membershipIntent === "join") {
      const availability = getMembershipRegistrationAvailability();
      if (!availability.available) {
        setHint(availability.message, "error");
        return;
      }
    }
    const paymentValidationMessage = validateMembershipPaymentData(signupProfile);
    if (paymentValidationMessage) {
      setHint(paymentValidationMessage, "error");
      return;
    }
  }

  authSubmit.disabled = true;

  try {
    const readyAuth = await ensureAuthReady();
    if (!readyAuth) {
      return;
    }

    const credential = authMode === "signup"
      ? await createUserWithEmailAndPassword(readyAuth, email, password)
      : await signInWithEmailAndPassword(readyAuth, email, password);

    let membershipApplicationError = null;
    let membershipApplicationResult = null;
    if (authMode === "signup") {
      await setDoc(getMemberDocRef(credential.user.uid), {
        uid: credential.user.uid,
        email,
        name: signupProfile.name,
        displayName: signupProfile.name,
        studentId: signupProfile.studentId.toUpperCase(),
        department: signupProfile.department,
        school: signupProfile.school,
        phone: signupProfile.phone,
        academicYear: getConfiguredAcademicYear(),
        term: getConfiguredAcademicTerm(),
        membershipIntent: "not_join",
        paymentMethod: "none",
        cashPaymentSlot: "",
        transferAt: "",
        transferLastFive: "",
        membershipStatus: "not_applied",
        status: "not_applied",
        paymentStatus: "unpaid",
        notificationPreferences: { announcements: true, classReminders: true, registrationUpdates: true },
        privacyConsent: { version: "2026-08-07", accepted: true, acceptedAt: serverTimestamp() },
        source: "spark_signup",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      if (signupProfile.membershipIntent === "join") {
        try {
          membershipApplicationResult = await saveMembershipApplication(signupProfile);
        } catch (error) {
          membershipApplicationError = error;
          console.error("Membership application after signup failed:", error);
        }
      }
    }

    currentUser = credential.user;
    let profileSyncFailed = false;

    try {
      await Promise.all([
        loadAdminStatus(credential.user),
        authMode === "signup" ? Promise.resolve() : syncMemberProfile(
          credential.user,
          authMode === "signup" ? "signup" : "signin",
          authMode === "signup" ? signupProfile : {},
        ),
      ]);
      await loadCurrentMemberStatus(credential.user);
    } catch (error) {
      profileSyncFailed = true;
      console.error("Post-login profile sync failed:", error);
    }
    writeAuthSnapshot(credential.user, currentUserIsAdmin);
    updateLoginButtons();
    updateAuthView();

    if (pageName === "members") {
      membersDashboardCache.loaded = false;
      await loadCurrentTermSettings();
      await applyAcademicPeriodRolloverIfNeeded();
      await refreshMembersDashboardSafe({ force: true });
    }

    setHint(
      membershipApplicationError
        ? `帳號已建立並自動登入，但社員申請未送出：${membershipApplicationError.message || "目前無法申請社員資格。"}`
        : profileSyncFailed
        ? "登入成功，但社員資料暫時無法同步；你仍可保持登入並稍後再試。"
        : authMode === "signup"
          ? signupProfile.membershipIntent === "join"
            ? membershipApplicationResult?.membershipStatus === "membership_waitlisted"
              ? `帳號註冊完成，你目前是社員候補第 ${membershipApplicationResult.waitlistPosition} 位；候補期間不需付款。`
              : `帳號註冊完成，你是本學期第 ${membershipApplicationResult?.registrationPosition || "—"} 位申請者；請依選擇完成社費繳納。`
            : "帳號註冊完成，已自動登入；目前狀態為非社員。"
          : "登入成功，已更新社員狀態。",
      membershipApplicationError || profileSyncFailed ? "error" : "success",
    );
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
  const school = String(formData.get("school") || "").trim();
  const department = String(formData.get("department") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim();
  const applicationType = String(formData.get("applicationType") || "club");

  if (!firebaseConfigured) {
    setApplicationHint("Firebase 尚未設定完成，請先確認 src/firebase-config.js。", "error");
    return;
  }

  if (!name || !studentId || !["臺科大", "外校"].includes(school) || !department || !phone || !email) {
    setApplicationHint("請先選擇學校，再完整填寫姓名、學號、系別、連絡電話與聯絡信箱。", "error");
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
    let membershipApplicationResult = null;
    await ensureAuthReady();

    if (!currentUser?.uid || currentUser.email?.trim().toLowerCase() !== email) {
      setApplicationHint("請先使用相同 Email 登入，再送出社員申請。", "error");
      return;
    }

    if (applicationType === "club") {
      await setDoc(getMemberDocRef(currentUser.uid), {
        name,
        displayName: name,
        studentId,
        school,
        department,
        phone,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      membershipApplicationResult = await saveMembershipApplication({
        membershipIntent: "join",
        paymentMethod: "later",
        cashPaymentSlot: "",
        transferAt: "",
        transferLastFive: "",
      });
    } else {
      const applicationRef = doc(db, "applications", getApplicationDocId(currentUser.uid, applicationType));
      await setDoc(applicationRef, {
        name,
        studentId,
        department,
        school,
        phone,
        email,
        note,
        applicationType,
        academicYear: getConfiguredAcademicYear(),
        term: getConfiguredAcademicTerm(),
        approved: false,
        reviewStatus: "pending",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (currentUser?.uid && currentUser.email?.trim().toLowerCase() === email) {
      await setDoc(
        getMemberDocRef(currentUser.uid),
        {
          uid: currentUser.uid,
          email,
          name,
          studentId,
          school,
          department,
          phone,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await loadCurrentMemberStatus(currentUser);
      updateAuthView();
    }

    rememberApplicationSubmit(email, applicationType);
    applicationForm.reset();
    closeApplicationModal();
    const successModal = getApplicationSuccessModalElements().successModal;
    const successTitle = successModal.querySelector(".modal-title");
    const successCopy = successModal.querySelector(".success-modal-copy");
    if (applicationType === "club" && membershipApplicationResult?.membershipStatus === "membership_waitlisted") {
      successTitle.textContent = `社員候補第 ${membershipApplicationResult.waitlistPosition} 位`;
      successCopy.innerHTML = `
        <p>社員名額目前已滿，你是候補第 ${escapeHtml(membershipApplicationResult.waitlistPosition)} 位。</p>
        <p>候補期間不需進行社費付款；名額釋出時請依最新通知操作。</p>
      `;
    } else if (applicationType === "club") {
      successTitle.textContent = "申請已送出！";
      successCopy.innerHTML = `
        <p>感謝你申請加入臺科大羽球社！我們已收到你的資料。</p>
        <p>請依通知完成社費繳納，幹部確認後會更新正式社員資格。</p>
      `;
    } else {
      successTitle.textContent = "申請已送出！";
      successCopy.innerHTML = `
        <p>感謝你送出申請！我們已收到你的資料。</p>
        <p>管理員審核後會再通知你最新結果。</p>
      `;
    }
    openApplicationSuccessModal();
    setApplicationHint(
      membershipApplicationResult?.membershipStatus === "membership_waitlisted"
        ? `已加入社員候補第 ${membershipApplicationResult.waitlistPosition} 位，候補期間不需付款。`
        : "申請已送出。請依通知完成一次性社費繳納，幹部確認後才會成為正式社員。",
      "success",
    );
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

const bindMembershipPaymentFormControls = (form) => {
  if (!(form instanceof HTMLFormElement) || form.dataset.paymentControlsBound === "true") {
    return;
  }
  form.dataset.paymentControlsBound = "true";
  form.addEventListener("change", (event) => {
    if (event.target.matches("[name='membershipIntent'], [name='paymentMethod']")) {
      syncMembershipPaymentForm(form);
    }
  });
  syncMembershipPaymentForm(form);
};

const saveMembershipApplication = async (paymentData) => {
  if (!db || !runTransaction || !currentUser?.uid) {
    throw new Error("請先登入後再申請社員資格。");
  }
  const uid = currentUser.uid;
  const memberRef = getMemberDocRef(uid);
  const applicationRef = doc(db, "applications", `club-${uid}`);
  const settingsRef = getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC);
  const result = await runTransaction(db, async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    if (!settingsSnapshot.exists()) throw new Error("管理員尚未設定目前學期。");
    const settings = settingsSnapshot.data() || {};
    const academicYear = String(settings.academicYear || "").trim();
    const term = String(settings.term || "").trim();
    const registration = settings.membershipRegistration || {};
    const limit = Math.max(0, Math.floor(Number(registration.limit || 0)));
    const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
    const [memberSnapshot, applicationSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(applicationRef),
      transaction.get(statsRef),
    ]);
    if (!memberSnapshot.exists()) throw new Error("社員基本資料尚未建立，請重新登入後再試。");

    const member = memberSnapshot.data() || {};
    const previousStatus = String(member.membershipStatus || member.status || "").trim().toLowerCase();
    const alreadyOccupiesSlot = doesMemberOccupyMembershipSlot(member, academicYear, term);
    const wasWaitlisted = previousStatus === "membership_waitlisted";
    let count = statsSnapshot.exists() ? Math.max(0, Number(statsSnapshot.data()?.count || 0)) : 0;
    let registrationSequence = statsSnapshot.exists()
      ? Math.max(count, Number(statsSnapshot.data()?.registrationSequence || 0))
      : count;
    let waitlistSequence = statsSnapshot.exists() ? Math.max(0, Number(statsSnapshot.data()?.waitlistSequence || 0)) : 0;
    let membershipStatus = "not_applied";
    let registrationPosition = null;
    let waitlistPosition = null;
    let statsChanged = false;
    let normalizedPayment = { paymentMethod: "none", cashPaymentSlot: "", transferAt: "", transferLastFive: "" };

    if (paymentData.membershipIntent === "join") {
      if (!alreadyOccupiesSlot && !wasWaitlisted) {
        const openAt = getDateTimeLocalMs(registration.openAt);
        const closeAt = getDateTimeLocalMs(registration.closeAt);
        const now = Date.now();
        if (!openAt || !closeAt || openAt >= closeAt || limit <= 0) throw new Error("社員申請尚未開放。");
        if (now < openAt) throw new Error(`社員申請將於 ${new Date(openAt).toLocaleString("zh-TW")} 開放。`);
        if (now > closeAt) throw new Error("本學期社員申請已截止。");
      }
      if (wasWaitlisted) {
        membershipStatus = "membership_waitlisted";
        waitlistPosition = Math.max(1, Number(member.membershipWaitlistPosition || 1));
      } else if (alreadyOccupiesSlot) {
        membershipStatus = "pending_payment";
        registrationPosition = Math.max(1, Number(member.membershipRegistrationPosition || count));
        normalizedPayment = paymentData.paymentMethod === "none"
          ? {
              paymentMethod: member.paymentMethod || "later",
              cashPaymentSlot: member.cashPaymentSlot || "",
              transferAt: member.transferAt || "",
              transferLastFive: member.transferLastFive || "",
            }
          : paymentData;
      } else if (count >= limit) {
        membershipStatus = "membership_waitlisted";
        waitlistSequence += 1;
        waitlistPosition = waitlistSequence;
        statsChanged = true;
      } else {
        if (!paymentData.paymentMethod || paymentData.paymentMethod === "none") throw new Error("請選擇社費繳費方式。");
        count += 1;
        registrationSequence += 1;
        registrationPosition = Math.max(count, registrationSequence);
        registrationSequence = registrationPosition;
        membershipStatus = "pending_payment";
        normalizedPayment = paymentData;
        statsChanged = true;
      }
    } else if (alreadyOccupiesSlot) {
      count = Math.max(0, count - 1);
      statsChanged = true;
    }

    if (statsChanged) {
      transaction.set(statsRef, {
        academicYear,
        term,
        count,
        limit,
        registrationSequence,
        waitlistSequence,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    transaction.set(memberRef, {
      membershipIntent: paymentData.membershipIntent,
      membershipStatus,
      status: membershipStatus,
      paymentStatus: "unpaid",
      ...normalizedPayment,
      membershipRegistrationPosition: registrationPosition,
      membershipWaitlistPosition: waitlistPosition,
      membershipWaitlistedAt: membershipStatus === "membership_waitlisted"
        ? member.membershipWaitlistedAt || serverTimestamp()
        : null,
      academicYear,
      term,
      paymentSubmittedAt: membershipStatus === "pending_payment" ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (membershipStatus === "pending_payment") {
      transaction.set(applicationRef, {
        userId: uid,
        name: String(member.name || member.displayName || "").slice(0, 100),
        studentId: String(member.studentId || "").slice(0, 30),
        department: String(member.department || "").slice(0, 100),
        school: String(member.school || "").slice(0, 100),
        phone: String(member.phone || "").slice(0, 30),
        email: String(currentUser.email || member.email || "").trim().toLowerCase(),
        note: String(applicationSnapshot.data()?.note || "").slice(0, 1000),
        applicationType: "club",
        academicYear,
        term,
        approved: false,
        reviewStatus: "pending",
        submittedAt: applicationSnapshot.data()?.submittedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else if (applicationSnapshot.exists()) {
      transaction.delete(applicationRef);
    }
    return { membershipStatus, count, limit, registrationPosition, waitlistPosition };
  });

  membershipRegistrationSettings.count = result.count;
  if (result.limit > 0) membershipRegistrationSettings.limit = result.limit;
  return result;
};

const handleAccountMembershipSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const hint = form.querySelector("[data-account-membership-hint]");
  const submitButton = form.querySelector("[data-account-membership-save]");
  const paymentData = readMembershipPaymentForm(form);
  const validationMessage = validateMembershipPaymentData(paymentData);
  if (validationMessage) {
    setMessageTone(hint, validationMessage, "error");
    return;
  }
  if (!currentUser?.uid || currentMemberProfile?.paymentStatus === "paid") {
    setMessageTone(hint, "社費已確認，若需變更請聯絡幹部。", "error");
    return;
  }

  submitButton.disabled = true;
  try {
    const result = await saveMembershipApplication(paymentData);
    await loadCurrentMemberStatus(currentUser);
    updateLoginButtons();
    const personalProfileForm = getLoginModalElements().personalProfileForm;
    if (getLoginModalElements().loginModal.dataset.view === "account-settings") {
      form.hidden = true;
      populatePersonalProfileForm(personalProfileForm);
      personalProfileForm.hidden = false;
      showToast(
        result.membershipStatus === "membership_waitlisted"
          ? `已加入社員候補第 ${result.waitlistPosition} 位；候補期間不需付款。`
          : result.membershipStatus === "pending_payment"
            ? `社員名額已保留（第 ${result.registrationPosition} 位），請依選擇完成社費繳納。`
            : "社員申請資料已更新。",
        { tone: "success" },
      );
    } else {
      updateAuthView();
      setMessageTone(
        hint,
        result.membershipStatus === "membership_waitlisted"
          ? `已加入社員候補第 ${result.waitlistPosition} 位；候補期間不需付款。`
          : result.membershipStatus === "pending_payment"
            ? `社員名額已保留（第 ${result.registrationPosition} 位），請依選擇完成社費繳納。`
            : "社員申請資料已更新。",
        "success",
      );
    }
  } catch (error) {
    console.error("Update membership application failed:", error);
    setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試一次。"}`, "error");
  } finally {
    submitButton.disabled = false;
  }
};

const bindLoginModalEvents = () => {
  const { loginModal, loginForm, authTabs, authSubmit, closeButtons, accountMembershipForm, editAccountMembershipButton, personalProfileForm, editPersonalProfileButton, signupSchoolInput, signupExternalSchoolField, signupExternalSchoolInput } = getLoginModalElements();

  const syncSignupExternalSchoolField = () => {
    const isExternalSchool = signupSchoolInput?.value === "外校";
    if (signupExternalSchoolField instanceof HTMLElement) signupExternalSchoolField.hidden = !isExternalSchool;
    if (signupExternalSchoolInput instanceof HTMLInputElement) {
      signupExternalSchoolInput.required = isExternalSchool;
      if (!isExternalSchool) signupExternalSchoolInput.value = "";
    }
  };
  signupSchoolInput?.addEventListener("change", syncSignupExternalSchoolField);
  syncSignupExternalSchoolField();

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", handleAuthSubmit);
  bindMembershipPaymentFormControls(loginForm);
  bindMembershipPaymentFormControls(accountMembershipForm);
  accountMembershipForm.addEventListener("submit", handleAccountMembershipSubmit);
  editAccountMembershipButton.addEventListener("click", () => {
    personalProfileForm.hidden = true;
    populateAccountMembershipForm(accountMembershipForm);
    accountMembershipForm.hidden = false;
    accountMembershipForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  personalProfileForm.addEventListener("submit", handlePersonalProfileSubmit);
  personalProfileForm.querySelector("[data-delete-own-account]")?.addEventListener("click", handleDeleteOwnAccount);
  editPersonalProfileButton.addEventListener("click", () => {
    accountMembershipForm.hidden = true;
    populatePersonalProfileForm(personalProfileForm);
    personalProfileForm.hidden = false;
    personalProfileForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  personalProfileForm.querySelector("[data-personal-profile-cancel]")?.addEventListener("click", closeLoginModal);
  personalProfileForm.querySelector("[data-open-membership-settings]")?.addEventListener("click", () => {
    personalProfileForm.hidden = true;
    populateAccountMembershipForm(accountMembershipForm);
    accountMembershipForm.hidden = false;
  });
  accountMembershipForm.querySelector("[data-account-membership-cancel]")?.addEventListener("click", () => {
    accountMembershipForm.hidden = true;
    if (loginModal.dataset.view === "account-settings") {
      populatePersonalProfileForm(personalProfileForm);
      personalProfileForm.hidden = false;
    }
  });
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

const bindActionSuccessModalEvents = () => {
  const { successModal, confirmButton, closeButtons } = getActionSuccessModalElements();
  if (!successModal || !confirmButton) {
    return;
  }

  if (confirmButton.dataset.initialized !== "true") {
    confirmButton.dataset.initialized = "true";
    confirmButton.addEventListener("click", closeActionSuccessModal);
  }

  closeButtons.forEach((button) => {
    if (button.dataset.initialized === "true") {
      return;
    }

    button.dataset.initialized = "true";
    button.addEventListener("click", closeActionSuccessModal);
  });

  if (successModal.dataset.initialized !== "true") {
    successModal.dataset.initialized = "true";
    successModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === successModal || target.hasAttribute("data-modal-backdrop")) {
        closeActionSuccessModal();
      }
    });
  }
};


const syncMembersPageHero = () => {
  if (pageName !== "members") {
    return;
  }

  const heroEyebrow = document.querySelector("[data-members-hero-eyebrow]");
  const heroTitle = document.querySelector("[data-members-hero-title]");
  const heroCopy = document.querySelector("[data-members-hero-copy]");
  const heroSideTitle = document.querySelector("[data-members-hero-side-title]");
  const heroSideCopy = document.querySelector("[data-members-hero-side-copy]");
  const overviewTitle = document.querySelector("[data-members-overview-title]");
  const overviewCopy = document.querySelector("[data-members-overview-copy]");
  const heroState = currentUserIsAdmin ? membersPageCopy.admin : currentUser ? membersPageCopy.signedIn : membersPageCopy.public;

  if (heroEyebrow) {
    heroEyebrow.textContent = currentUserIsAdmin ? "MANAGEMENT DASHBOARD" : currentUser ? "MEMBER DASHBOARD" : "MEMBERS DASHBOARD";
  }

  if (heroTitle) {
    heroTitle.textContent = heroState.title;
  }

  if (heroCopy) {
    heroCopy.textContent = heroState.copy;
  }

  if (heroSideTitle) {
    heroSideTitle.textContent = heroState.sideTitle;
  }

  if (heroSideCopy) {
    heroSideCopy.textContent = heroState.sideCopy;
  }

  if (overviewTitle) {
    overviewTitle.textContent = heroState.overviewTitle;
  }

  if (overviewCopy) {
    overviewCopy.textContent = heroState.overviewCopy;
  }

  syncAcademicYearSetting();
  document.title = `${currentUserIsAdmin ? "社團管理頁" : "社員註冊名單"} | 臺科大羽球社`;
  applyLanguage(window.localStorage.getItem(STORAGE_KEYS.language) || body.dataset.language || "zh-Hant");
};

const getDefaultAdminAcademicYear = () => getConfiguredAcademicYear();

const syncAcademicYearSetting = () => {
  const form = document.querySelector("[data-academic-year-setting]");
  const input = document.querySelector("[data-current-academic-year-input]");
  const termSelect = document.querySelector("[data-current-academic-term]");
  const hint = document.querySelector("[data-current-academic-year-hint]");
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(termSelect instanceof HTMLSelectElement)) {
    return;
  }

  form.hidden = !currentUserIsAdmin;
  input.value = getDefaultAdminAcademicYear();
  termSelect.value = getConfiguredAcademicTerm();
  if (hint) {
    hint.textContent = currentUserIsAdmin
      ? "2/1、8/1 後首次開啟管理頁會自動切換學期並將社員轉為前社員；也可以手動調整。"
      : "登入管理員後可以設定目前學年度。";
  }
};

const bindAcademicYearSetting = () => {
  const form = document.querySelector("[data-academic-year-setting]");
  const input = document.querySelector("[data-current-academic-year-input]");
  const termSelect = document.querySelector("[data-current-academic-term]");
  const hint = document.querySelector("[data-current-academic-year-hint]");
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(termSelect instanceof HTMLSelectElement) || form.dataset.bound === "true") {
    return;
  }

  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    const term = termSelect.value;
    if (!isValidAcademicYearValue(value)) {
      if (hint) {
        hint.textContent = "請輸入 2 到 3 位數的民國學年度，例如 115。";
      }
      input.focus();
      return;
    }
    if (!DEFAULT_TERMS.slice(0, 2).includes(term)) {
      if (hint) {
        hint.textContent = "請選擇第一學期或第二學期。";
      }
      termSelect.focus();
      return;
    }

    const years = Array.from(new Set([value, ...getStoredAdminAcademicYears()])).sort((a, b) => Number(b) - Number(a));
    const submitButton = form.querySelector("button[type=\"submit\"]");
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }
    try {
      await setDoc(
        getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC),
        {
          academicYear: value,
          term,
          academicPeriodKey: `${value}-${term}`,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
        },
        { merge: true },
      );
      saveAdminAcademicYears(years);
      configuredAcademicYear = value;
      configuredAcademicTerm = term;
      configuredAcademicPeriodKey = `${value}-${term}`;
      await backfillUnsetMemberAcademicPeriods(membersDashboardCache.members, value, term);
      memberFilters.year = value;
      memberFilters.term = term;
      patchMembersFilterUI();
      void refreshMembersDashboardSafe();
      if (hint) {
        hint.textContent = `已設定目前學期為 ${value} 學年度 ${getAcademicTermLabel(term)}。`;
      }
      showToast(`目前學期已設定為 ${value} 學年度 ${getAcademicTermLabel(term)}。`, { tone: "success" });
    } catch (error) {
      console.error("Save academic year setting failed:", error);
      if (hint) {
        hint.textContent = `儲存失敗：${error?.message || "請稍後再試一次。"}`;
      }
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
    }
  });
};

const createCashPaymentOptionId = () =>
  `cash_${Date.now().toString(36)}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;

const getCashPaymentOptionRowMarkup = (option = {}) => `
  <div class="cash-payment-option-row" data-cash-payment-option-row>
    <div class="form-field">
      <label>選項說明</label>
      <input
        name="cashPaymentOptionLabel"
        data-cash-payment-option-id="${escapeHtml(option.id || createCashPaymentOptionId())}"
        maxlength="100"
        placeholder="例如：每週三中午 12:20–13:10 社辦"
        type="text"
        value="${escapeHtml(option.label || "")}"
        required
      />
    </div>
    <button class="member-delete-button" data-cash-payment-option-delete type="button">刪除</button>
  </div>
`;

const renderCashPaymentOptionSettings = (options = membershipPaymentSettings.cashPaymentOptions) => {
  const list = document.querySelector("[data-cash-payment-option-list]");
  if (!list) return;
  list.innerHTML = options.map(getCashPaymentOptionRowMarkup).join("");
};

const syncMembershipPaymentSettingForm = () => {
  const form = document.querySelector("[data-membership-payment-setting-form]");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  Object.entries(membershipPaymentSettings).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field instanceof HTMLInputElement) {
      field.value = value;
    }
  });
  renderCashPaymentOptionSettings();
};

const syncMembershipRegistrationSettingForm = () => {
  const form = document.querySelector("[data-membership-registration-setting-form]");
  if (!(form instanceof HTMLFormElement)) return;
  const openAt = form.elements.namedItem("openAt");
  const closeAt = form.elements.namedItem("closeAt");
  const limit = form.elements.namedItem("limit");
  if (openAt instanceof HTMLInputElement) openAt.value = membershipRegistrationSettings.openAt;
  if (closeAt instanceof HTMLInputElement) closeAt.value = membershipRegistrationSettings.closeAt;
  if (limit instanceof HTMLInputElement) limit.value = membershipRegistrationSettings.limit || "";
  const count = form.querySelector("[data-membership-registration-setting-count]");
  if (count) {
    count.textContent = `目前已占用 ${membershipRegistrationSettings.count} / ${membershipRegistrationSettings.limit || "未設定"} 個名額。`;
  }
};

const bindMembershipRegistrationSetting = () => {
  const form = document.querySelector("[data-membership-registration-setting-form]");
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  syncMembershipRegistrationSettingForm();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const nextSettings = {
      openAt: String(formData.get("openAt") || "").trim(),
      closeAt: String(formData.get("closeAt") || "").trim(),
      limit: Math.floor(Number(formData.get("limit") || 0)),
    };
    const hint = form.querySelector("[data-membership-registration-setting-hint]");
    const submitButton = form.querySelector("[data-membership-registration-setting-save]");
    if (!nextSettings.openAt || !nextSettings.closeAt || nextSettings.limit <= 0) {
      setMessageTone(hint, "請完整設定開放時間、截止時間與社員名額。", "error");
      return;
    }
    if (getDateTimeLocalMs(nextSettings.openAt) >= getDateTimeLocalMs(nextSettings.closeAt)) {
      setMessageTone(hint, "結束申請時間必須晚於開放申請時間。", "error");
      return;
    }
    submitButton.disabled = true;
    try {
      const openAtMs = getDateTimeLocalMs(nextSettings.openAt);
      const closeAtMs = getDateTimeLocalMs(nextSettings.closeAt);
      const academicYear = getConfiguredAcademicYear();
      const term = getConfiguredAcademicTerm();
      const membersSnapshot = await getDocs(collection(db, "members"));
      const existingSlotCount = membersSnapshot.docs.filter((snapshot) => {
        const member = { id: snapshot.id, ...(snapshot.data() || {}) };
        return doesMemberOccupyMembershipSlot(member, academicYear, term);
      }).length;
      const statsRef = doc(db, MEMBERSHIP_REGISTRATION_STATS_COLLECTION, `${academicYear}-${term}`);
      await runTransaction(db, async (transaction) => {
        const statsSnapshot = await transaction.get(statsRef);
        transaction.set(getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC), {
          membershipRegistration: {
            ...nextSettings,
            openAtTimestamp: new Date(openAtMs),
            closeAtTimestamp: new Date(closeAtMs),
          },
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
        }, { merge: true });
        transaction.set(statsRef, {
          academicYear,
          term,
          count: existingSlotCount,
          limit: nextSettings.limit,
          updatedAt: serverTimestamp(),
        }, { merge: statsSnapshot.exists() });
      });
      membershipRegistrationSettings = { ...membershipRegistrationSettings, ...nextSettings };
      document.querySelectorAll("[data-login-form], [data-account-membership-form]").forEach(syncMembershipPaymentForm);
      syncMembershipRegistrationSettingForm();
      setMessageTone(hint, "", "success");
      showToast("社員申請名額與期間已儲存。", { tone: "success" });
    } catch (error) {
      setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試一次。"}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });
};

const syncMaintenanceSettingForm = () => {
  const form = document.querySelector("[data-maintenance-setting-form]");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const enabled = form.elements.namedItem("enabled");
  const title = form.elements.namedItem("title");
  const message = form.elements.namedItem("message");
  const estimatedResumeAt = form.elements.namedItem("estimatedResumeAt");
  if (enabled instanceof HTMLInputElement) enabled.checked = maintenanceSettings.enabled;
  if (title instanceof HTMLInputElement) title.value = maintenanceSettings.title;
  if (message instanceof HTMLTextAreaElement) message.value = maintenanceSettings.message;
  if (estimatedResumeAt instanceof HTMLInputElement) estimatedResumeAt.value = maintenanceSettings.estimatedResumeAt;
};

const bindMaintenanceSetting = () => {
  const form = document.querySelector("[data-maintenance-setting-form]");
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") {
    return;
  }

  form.dataset.bound = "true";
  syncMaintenanceSettingForm();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUserIsAdmin) {
      return;
    }

    const formData = new FormData(form);
    const nextSettings = {
      enabled: formData.get("enabled") === "on",
      title: String(formData.get("title") || "").trim() || DEFAULT_MAINTENANCE_SETTINGS.title,
      message: String(formData.get("message") || "").trim() || DEFAULT_MAINTENANCE_SETTINGS.message,
      estimatedResumeAt: String(formData.get("estimatedResumeAt") || "").trim(),
    };
    const hint = form.querySelector("[data-maintenance-setting-hint]");
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;

    try {
      await setDoc(
        getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC),
        {
          maintenance: nextSettings,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
        },
        { merge: true },
      );
      maintenanceSettings = nextSettings;
      applyMaintenanceView();
      setMessageTone(hint, "", "success");
      showToast(nextSettings.enabled ? "維護模式已開啟，管理員不受影響。" : "維護模式已關閉，網站已恢復公開。", { tone: "success" });
    } catch (error) {
      console.error("Save maintenance setting failed:", error);
      setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試。"}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });
};

const bindMembershipPaymentSetting = () => {
  const form = document.querySelector("[data-membership-payment-setting-form]");
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") {
    return;
  }
  form.dataset.bound = "true";
  syncMembershipPaymentSettingForm();
  form.querySelector("[data-cash-payment-option-add]")?.addEventListener("click", () => {
    const list = form.querySelector("[data-cash-payment-option-list]");
    if (!list || list.querySelectorAll("[data-cash-payment-option-row]").length >= 10) {
      setMessageTone(form.querySelector("[data-membership-payment-setting-hint]"), "現金繳費方式最多可設定 10 個。", "error");
      return;
    }
    list.insertAdjacentHTML("beforeend", getCashPaymentOptionRowMarkup());
    list.lastElementChild?.querySelector("input")?.focus();
  });
  form.querySelector("[data-cash-payment-option-list]")?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-cash-payment-option-delete]");
    if (!deleteButton) return;
    deleteButton.closest("[data-cash-payment-option-row]")?.remove();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const cashPaymentOptions = Array.from(form.querySelectorAll("[data-cash-payment-option-id]"))
      .map((input) => normalizeCashPaymentOption({ id: input.dataset.cashPaymentOptionId, label: input.value }))
      .filter(Boolean);
    const nextSettings = {
      bankName: String(formData.get("bankName") || "").trim(),
      bankCode: String(formData.get("bankCode") || "").trim(),
      accountName: String(formData.get("accountName") || "").trim(),
      accountNumber: String(formData.get("accountNumber") || "").replace(/\s+/g, ""),
      cashPaymentOptions,
    };
    const hint = form.querySelector("[data-membership-payment-setting-hint]");
    const submitButton = form.querySelector("[data-membership-payment-setting-save]");
    if (!nextSettings.accountName || !nextSettings.accountNumber || !nextSettings.cashPaymentOptions.length) {
      setMessageTone(hint, "請至少填寫戶名、轉帳帳號與一個現金繳費方式。", "error");
      return;
    }
    if (new Set(nextSettings.cashPaymentOptions.map((option) => option.label)).size !== nextSettings.cashPaymentOptions.length) {
      setMessageTone(hint, "現金繳費方式不可重複。", "error");
      return;
    }
    submitButton.disabled = true;
    try {
      await setDoc(
        getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC),
        {
          membershipPayment: nextSettings,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
        },
        { merge: true },
      );
      membershipPaymentSettings = nextSettings;
      document.querySelectorAll("[data-login-form], [data-account-membership-form]").forEach(syncMembershipPaymentForm);
      setMessageTone(hint, "", "success");
      showToast("繳費資訊已儲存。", { tone: "success" });
    } catch (error) {
      console.error("Save membership payment settings failed:", error);
      setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試一次。"}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });
};

const getClassDefaultSignupRelativeMinutes = (daysBefore, time) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  return -(Number(daysBefore) * 24 * 60) + hours * 60 + minutes;
};

const getClassDefaultSignupDateTime = (item, dateKey, prefix) => {
  const date = parseDateKey(dateKey);
  const daysBefore = Number(item[`${prefix}DaysBefore`]);
  const [hours, minutes] = String(item[`${prefix}Time`] || "").split(":").map(Number);
  if (!date || !Number.isFinite(daysBefore) || !Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  date.setDate(date.getDate() - daysBefore);
  date.setHours(hours, minutes, 0, 0);
  return formatDateTimeLocalValue(date);
};

const normalizeClassScheduleDefault = (value = {}, { requireBilingualTitles = false } = {}) => {
  const weekday = DATE_WEEKDAY_ORDER.includes(String(value.weekday || "")) ? String(value.weekday) : "";
  const startTime = String(value.startTime || "").trim();
  const endTime = String(value.endTime || "").trim();
  const signupRequired = Object.prototype.hasOwnProperty.call(value, "signupRequired") ? value.signupRequired === true : true;
  const signupLimit = Number(value.signupLimit || 0);
  const titleZhSource = Object.prototype.hasOwnProperty.call(value, "titleZh") ? value.titleZh : value.title || "社課";
  const titleZh = String(titleZhSource || "").trim().slice(0, 100);
  const titleEn = String(value.titleEn || "").trim().slice(0, 100);
  if (requireBilingualTitles && (!titleZh || !titleEn)) return null;
  if (!weekday || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) return null;
  const signupDefaults = signupRequired
    ? {
        memberSignupOpenDaysBefore: Math.floor(Number(value.memberSignupOpenDaysBefore ?? 7)),
        memberSignupOpenTime: String(value.memberSignupOpenTime || "12:00").trim(),
        publicSignupOpenDaysBefore: Math.floor(Number(value.publicSignupOpenDaysBefore ?? 2)),
        publicSignupOpenTime: String(value.publicSignupOpenTime || "12:00").trim(),
        signupCloseDaysBefore: Math.floor(Number(value.signupCloseDaysBefore ?? 0)),
        signupCloseTime: String(value.signupCloseTime || "12:00").trim(),
      }
    : {};
  if (signupRequired) {
    const dayValues = [signupDefaults.memberSignupOpenDaysBefore, signupDefaults.publicSignupOpenDaysBefore, signupDefaults.signupCloseDaysBefore];
    const timeValues = [signupDefaults.memberSignupOpenTime, signupDefaults.publicSignupOpenTime, signupDefaults.signupCloseTime];
    if (dayValues.some((days) => !Number.isFinite(days) || days < 0 || days > 90) || timeValues.some((time) => !/^\d{2}:\d{2}$/.test(time))) return null;
    const sortValues = [
      getClassDefaultSignupRelativeMinutes(signupDefaults.memberSignupOpenDaysBefore, signupDefaults.memberSignupOpenTime),
      getClassDefaultSignupRelativeMinutes(signupDefaults.publicSignupOpenDaysBefore, signupDefaults.publicSignupOpenTime),
      getClassDefaultSignupRelativeMinutes(signupDefaults.signupCloseDaysBefore, signupDefaults.signupCloseTime),
    ];
    if (!(sortValues[0] < sortValues[1] && sortValues[1] < sortValues[2])) return null;
  }
  return {
    weekday,
    startTime,
    endTime,
    title: titleZh,
    titleZh,
    titleEn,
    location: String(value.location || "").trim().slice(0, 200),
    signupRequired,
    signupLimit: signupRequired && Number.isFinite(signupLimit) && signupLimit > 0 ? Math.floor(signupLimit) : null,
    ...signupDefaults,
  };
};

const getClassDefaultRowMarkup = (item = {}) => `
  <div class="class-default-row" data-class-default-row>
    <div class="class-default-basic-grid">
      <div class="form-field"><label>星期</label><select name="weekday">${DATE_WEEKDAY_ORDER.map((key) => `<option value="${key}"${item.weekday === key ? " selected" : ""}>${escapeHtml(getWeekdayLabel(key))}</option>`).join("")}</select></div>
      <div class="form-field"><label>開始</label><input name="startTime" type="time" step="300" value="${escapeHtml(item.startTime || "")}" required /></div>
      <div class="form-field"><label>結束</label><input name="endTime" type="time" step="300" value="${escapeHtml(item.endTime || "")}" required /></div>
      <div class="form-field"><label>中文標題</label><input maxlength="100" name="titleZh" type="text" value="${escapeHtml(item.titleZh || item.title || "")}" required /></div>
      <div class="form-field"><label>英文標題</label><input maxlength="100" name="titleEn" type="text" value="${escapeHtml(item.titleEn || "")}" required /></div>
      <div class="form-field"><label>地點（選填）</label><input name="location" type="text" value="${escapeHtml(item.location || "")}" /></div>
    </div>
    <label class="class-default-signup-toggle">
      <input name="signupRequired" type="checkbox"${item.signupRequired ? " checked" : ""} />
      <span><strong>需要報名</strong><small>開啟後可設定各階段報名時間與人數上限</small></span>
    </label>
    <div class="class-default-signup-fields" data-class-default-signup-fields${item.signupRequired ? "" : " hidden"}>
      <div class="class-default-signup-period">
        <strong>① 社員報名開始</strong>
        <div class="form-field"><label>社課前幾天</label><input name="memberSignupOpenDaysBefore" min="0" max="90" type="number" value="${escapeHtml(item.memberSignupOpenDaysBefore ?? 7)}" /></div>
        <div class="form-field"><label>時間</label><input name="memberSignupOpenTime" type="time" step="300" value="${escapeHtml(item.memberSignupOpenTime || "12:00")}" /></div>
      </div>
      <div class="class-default-signup-period">
        <strong>② 全面開放報名</strong>
        <div class="form-field"><label>社課前幾天</label><input name="publicSignupOpenDaysBefore" min="0" max="90" type="number" value="${escapeHtml(item.publicSignupOpenDaysBefore ?? 2)}" /></div>
        <div class="form-field"><label>時間</label><input name="publicSignupOpenTime" type="time" step="300" value="${escapeHtml(item.publicSignupOpenTime || "12:00")}" /></div>
      </div>
      <div class="class-default-signup-period">
        <strong>③ 報名截止</strong>
        <div class="form-field"><label>社課前幾天</label><input name="signupCloseDaysBefore" min="0" max="90" type="number" value="${escapeHtml(item.signupCloseDaysBefore ?? 0)}" /></div>
        <div class="form-field"><label>時間</label><input name="signupCloseTime" type="time" step="300" value="${escapeHtml(item.signupCloseTime || "12:00")}" /></div>
      </div>
      <div class="form-field"><label>人數上限（選填）</label><input name="signupLimit" min="1" placeholder="不限" type="number" value="${escapeHtml(item.signupLimit || "")}" /></div>
    </div>
    <button class="member-delete-button class-default-remove" data-class-default-remove type="button">移除</button>
  </div>
`;

const bindClassDefaultRow = (row) => {
  if (!row) return;
  const toggle = row.querySelector("[name='signupRequired']");
  const fields = row.querySelector("[data-class-default-signup-fields]");
  const sync = () => {
    if (fields) fields.hidden = !toggle?.checked;
  };
  toggle?.addEventListener("change", sync);
  row.querySelector("[data-class-default-remove]")?.addEventListener("click", () => row.remove());
  sync();
};

const renderClassDefaultSettings = () => {
  const list = document.querySelector("[data-class-default-list]");
  if (!list) return;
  list.innerHTML = (classScheduleDefaults.length ? classScheduleDefaults : [{ weekday: "fri", startTime: "", endTime: "", signupLimit: "", titleZh: "", titleEn: "", location: "" }])
    .map(getClassDefaultRowMarkup)
    .join("");
  list.querySelectorAll("[data-class-default-row]").forEach(bindClassDefaultRow);
};

const bindClassDefaultSettings = () => {
  const form = document.querySelector("[data-class-default-form]");
  const addButton = document.querySelector("[data-class-default-add]");
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  renderClassDefaultSettings();
  addButton?.addEventListener("click", () => {
    const list = form.querySelector("[data-class-default-list]");
    list?.insertAdjacentHTML("beforeend", getClassDefaultRowMarkup({ weekday: "fri", titleZh: "", titleEn: "" }));
    bindClassDefaultRow(list?.lastElementChild);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rows = [...form.querySelectorAll("[data-class-default-row]")];
    const parsed = rows.map((row) => normalizeClassScheduleDefault({
      weekday: row.querySelector("[name='weekday']")?.value,
      startTime: row.querySelector("[name='startTime']")?.value,
      endTime: row.querySelector("[name='endTime']")?.value,
      signupLimit: row.querySelector("[name='signupLimit']")?.value,
      titleZh: row.querySelector("[name='titleZh']")?.value,
      titleEn: row.querySelector("[name='titleEn']")?.value,
      location: row.querySelector("[name='location']")?.value,
      signupRequired: Boolean(row.querySelector("[name='signupRequired']")?.checked),
      memberSignupOpenDaysBefore: row.querySelector("[name='memberSignupOpenDaysBefore']")?.value,
      memberSignupOpenTime: row.querySelector("[name='memberSignupOpenTime']")?.value,
      publicSignupOpenDaysBefore: row.querySelector("[name='publicSignupOpenDaysBefore']")?.value,
      publicSignupOpenTime: row.querySelector("[name='publicSignupOpenTime']")?.value,
      signupCloseDaysBefore: row.querySelector("[name='signupCloseDaysBefore']")?.value,
      signupCloseTime: row.querySelector("[name='signupCloseTime']")?.value,
    }, { requireBilingualTitles: true }));
    if (parsed.some((item) => !item)) {
      setMessageTone(form.querySelector("[data-class-default-hint]"), "請填寫中英文標題，並確認社課與報名時間完整且順序正確。", "error");
      return;
    }
    const submitButton = form.querySelector("[data-class-default-save]");
    setButtonLoading(submitButton, true, "儲存中…");
    try {
      await setDoc(getSiteSettingsDocRef(CURRENT_TERM_SETTINGS_DOC), { classScheduleDefaults: parsed, updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || "" }, { merge: true });
      classScheduleDefaults = parsed;
      renderHomeClassSchedule();
      setMessageTone(form.querySelector("[data-class-default-hint]"), "", "success");
      showToast("行事曆新增快捷鍵已更新。", { tone: "success" });
    } catch (error) {
      setMessageTone(form.querySelector("[data-class-default-hint]"), `儲存失敗：${error?.message || "請稍後再試。"}`, "error");
      showToast(error?.message || "請稍後再試。", { tone: "error", title: "儲存失敗" });
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
};

const bindOpenButtons = () => {
  rememberLoginButtonLabels();

  getLoginButtons().forEach((button) => {
    if (button.dataset.openLoginBound === "true") {
      return;
    }
    button.dataset.openLoginBound = "true";
    button.addEventListener("click", () => openLoginModal(button));
  });

  getSignupButtons().forEach((button) => {
    if (button.dataset.openSignupBound === "true") return;
    button.dataset.openSignupBound = "true";
    button.addEventListener("click", () => {
      setAuthMode("signup");
      void openLoginModal(button);
    });
  });

  getApplicationButtons().forEach((button) => {
    if (button.dataset.openApplicationBound === "true") {
      return;
    }
    button.dataset.openApplicationBound = "true";
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

const ADMIN_PANEL_IDS = [
  "admin-semester-settings",
  "admin-maintenance-settings",
  "admin-member-management",
  "admin-officer-management",
  "admin-administrator-management",
  "admin-calendar-management",
  "admin-faq-management",
];

const activateAdminPanel = (panelId, { updateHistory = false } = {}) => {
  if (pageName !== "members") {
    return;
  }

  const requestedPanelId = ADMIN_PANEL_IDS.includes(panelId) ? panelId : ADMIN_PANEL_IDS[0];
  const tabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-admin-panel]"));

  tabs.forEach((tab) => {
    const isActive = tab.getAttribute("aria-controls") === requestedPanelId;
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== requestedPanelId;
  });

  if (updateHistory) {
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = requestedPanelId;
    if (window.location.hash !== nextUrl.hash) {
      window.history.pushState({ ...(window.history.state || {}), adminPanel: requestedPanelId }, "", nextUrl);
    }
  }
};

const bindAdminSectionTabs = () => {
  if (pageName !== "members") {
    return;
  }

  const nav = document.querySelector(".admin-section-nav");
  const tabs = Array.from(nav?.querySelectorAll("[data-admin-tab]") || []);
  if (!nav || tabs.length === 0) {
    return;
  }

  const hashPanelId = window.location.hash.replace(/^#/, "");
  activateAdminPanel(hashPanelId);

  if (nav.dataset.tabsBound === "true") {
    return;
  }
  nav.dataset.tabsBound = "true";

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      activateAdminPanel(tab.getAttribute("aria-controls"), { updateHistory: true });
    });

    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      const nextTab = tabs[nextIndex];
      activateAdminPanel(nextTab.getAttribute("aria-controls"), { updateHistory: true });
      nextTab.focus();
    });
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
    if (group.dataset.accordionBound === "true") {
      return;
    }
    group.dataset.accordionBound = "true";
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
    const { resetModal } = getPasswordResetModalElements();
    const { successModal } = getApplicationSuccessModalElements();
    const { successModal: actionSuccessModal } = getActionSuccessModalElements();
    const { calendarModal: publicCalendarModal } = getPublicCalendarModalElements();
    const { calendarModal: classSignupModal } = getClassSignupModalElements();

    if (!loginModal.hidden) {
      closeLoginModal();
    }

    if (!applicationModal.hidden) {
      closeApplicationModal();
    }

    if (!resetModal.hidden) {
      closePasswordResetModal();
    }

    if (!successModal.hidden) {
      closeApplicationSuccessModal();
    }

    if (actionSuccessModal && !actionSuccessModal.hidden) {
      closeActionSuccessModal();
    }

    if (publicCalendarModal && !publicCalendarModal.hidden) {
      closePublicCalendarModal();
    }

    if (classSignupModal && !classSignupModal.hidden) {
      closeClassSignupModal();
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

const SPA_PAGE_FILES = new Set([
  "index.html",
  "about.html",
  "club-signup.html",
  "class-signup.html",
  "notices.html",
  "faq.html",
  "members.html",
  "privacy.html",
]);
const spaPageCache = new Map();
let spaNavigationPromise = null;
let renderedSpaPath = window.location.pathname;

const getSpaPageFile = (url) => {
  const file = url.pathname.split("/").filter(Boolean).pop() || "index.html";
  return file.toLowerCase();
};

const isSpaPageUrl = (url) => url.origin === window.location.origin && SPA_PAGE_FILES.has(getSpaPageFile(url));

const loadSpaPageDocument = (url) => {
  const cacheKey = url.pathname;
  if (spaPageCache.has(cacheKey)) {
    return spaPageCache.get(cacheKey);
  }

  const request = fetch(url.pathname, {
    headers: { "X-Requested-With": "spa-navigation" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`頁面載入失敗 (${response.status})`);
      }
      return response.text();
    })
    .then((html) => new DOMParser().parseFromString(html, "text/html"))
    .catch((error) => {
      spaPageCache.delete(cacheKey);
      throw error;
    });

  spaPageCache.set(cacheKey, request);
  return request;
};

function prefetchSpaPage(href) {
  try {
    const url = new URL(href, window.location.href);
    if (isSpaPageUrl(url) && url.pathname !== window.location.pathname) {
      void loadSpaPageDocument(url).catch(() => {});
    }
  } catch {
    // Ignore malformed links and let the browser handle them normally.
  }
}

const syncSpaNavigationState = (targetUrl) => {
  document.querySelectorAll(".site-nav a[href], .mobile-nav a[href]").forEach((link) => {
    const linkUrl = new URL(link.href, window.location.href);
    if (linkUrl.pathname === targetUrl.pathname) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const activateCurrentPage = async () => {
  bindOpenButtons();
  bindAcademicYearSetting();
  bindMaintenanceSetting();
  bindMembershipRegistrationSetting();
  bindMembershipPaymentSetting();
  bindClassDefaultSettings();
  bindAdminSectionTabs();
  bindFaqQuestionForm();
  initFaqAccordion();
  initMembersAutoRefresh();
  initPublicBoardAutoRefresh();
  syncGlobalNavigationLabels();
  updateLoginButtons();
  applyLanguage(window.localStorage.getItem(STORAGE_KEYS.language) || body.dataset.language || "zh-Hant");

  if (isMaintenanceBlocking()) {
    applyMaintenanceView();
    return;
  }

  if (pageName === "members") {
    await refreshMembersDashboardSafe({ force: true });
  } else if (pageName === "class-signup") {
    await refreshClassSignupPageSafe({ force: true });
  } else if (pageName === "notices") {
    await refreshAnnouncementsPageSafe({ force: true });
  } else if (pageName === "faq") {
    await refreshFaqPageSafe({ force: true });
  }
};

const navigateSpa = async (target, { replace = false } = {}) => {
  const targetUrl = new URL(target, window.location.href);
  if (!isSpaPageUrl(targetUrl)) {
    window.location.assign(targetUrl.href);
    return;
  }

  if (targetUrl.pathname === renderedSpaPath) {
    if (targetUrl.hash) {
      activateAdminPanel(targetUrl.hash.replace(/^#/, ""));
      document.querySelector(targetUrl.hash)?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  if (spaNavigationPromise) {
    await spaNavigationPromise;
  }

  spaNavigationPromise = (async () => {
    body.classList.add("spa-navigating");
    closeMobileNav();

    try {
      const nextDocument = await loadSpaPageDocument(targetUrl);
      const nextMain = nextDocument.querySelector("main.page-main");
      const currentMain = document.querySelector("main.page-main");
      if (!nextMain || !currentMain) {
        throw new Error("找不到頁面主要內容。");
      }

      currentMain.replaceWith(document.importNode(nextMain, true));
      renderedSpaPath = targetUrl.pathname;
      pageName = nextDocument.body?.dataset.page || getSpaPageFile(targetUrl).replace(/\.html$/, "");
      body.dataset.page = pageName;
      document.title = nextDocument.title || document.title;
      const nextDescription = nextDocument.querySelector('meta[name="description"]')?.content || "";
      const description = document.querySelector('meta[name="description"]');
      if (description && nextDescription) {
        description.content = nextDescription;
      }

      if (replace) {
        window.history.replaceState({ spa: true }, "", targetUrl.href);
      } else {
        window.history.pushState({ spa: true }, "", targetUrl.href);
      }

      syncSpaNavigationState(targetUrl);
      await activateCurrentPage();

      if (targetUrl.hash) {
        document.querySelector(targetUrl.hash)?.scrollIntoView();
      } else {
        window.scrollTo({ top: 0 });
      }
    } catch (error) {
      console.warn("SPA navigation failed; falling back to a full page load.", error);
      window.location.assign(targetUrl.href);
    } finally {
      body.classList.remove("spa-navigating");
      spaNavigationPromise = null;
    }
  })();

  await spaNavigationPromise;
};

const initSpaNavigation = () => {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) {
      return;
    }

    const targetUrl = new URL(link.href, window.location.href);
    if (!isSpaPageUrl(targetUrl)) {
      return;
    }

    event.preventDefault();
    void navigateSpa(targetUrl);
  });

  document.addEventListener("pointerover", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      prefetchSpaPage(link.href);
    }
  });

  document.addEventListener("focusin", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      prefetchSpaPage(link.href);
    }
  });

  window.addEventListener("popstate", () => {
    void navigateSpa(window.location.href, { replace: true });
  });
};

const init = async () => {
  primeAuthStateFromSnapshot();
  ensureLoginModal();
  ensurePasswordResetModal();
  ensureApplicationModal();
  ensureApplicationSuccessModal();
  ensureActionSuccessModal();
  ensurePublicCalendarModal();
  ensureClassSignupModal();
  ensureNotificationModal();
  bindLoginModalEvents();
  bindPasswordResetModalEvents();
  bindApplicationModalEvents();
  bindApplicationSuccessModalEvents();
  bindActionSuccessModalEvents();
  bindPublicCalendarModalEvents();
  bindClassSignupModalEvents();
  bindNotificationCenter();
  bindOpenButtons();
  bindAcademicYearSetting();
  bindMaintenanceSetting();
  bindMembershipRegistrationSetting();
  bindMembershipPaymentSetting();
  bindClassDefaultSettings();
  bindAdminSectionTabs();
  syncGlobalNavigationLabels();
  initMenu();
  initLanguageSwitcher();
  initFaqAccordion();
  initKeybindings();
  initSpaNavigation();
  initMembersAutoRefresh();
  initPublicBoardAutoRefresh();
  setAuthMode("signin");
  updateLoginButtons();

  const needsFirebaseOnLoad = Boolean(document.querySelector("[data-open-login]"));

  if (firebaseConfigured && needsFirebaseOnLoad) {
    await ensureAuthReady();
    await loadCurrentTermSettings();
    await applyAcademicPeriodRolloverIfNeeded();
  }

  applyMaintenanceView();
  if (!maintenanceRefreshTimer && firebaseConfigured) {
    maintenanceRefreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        void loadCurrentTermSettings();
      }
    }, PUBLIC_PAGE_REFRESH_MS);
  }

  await activateCurrentPage();
};

void init();
