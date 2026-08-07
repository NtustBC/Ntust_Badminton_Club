import { bootstrapAdminEmail, firebaseConfig } from "./firebase-config.js";

let initializeApp;
let browserLocalPersistence;
let createUserWithEmailAndPassword;
let getAuth;
let onAuthStateChanged;
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
        browserLocalPersistence,
        createUserWithEmailAndPassword,
        getAuth,
        onAuthStateChanged,
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
const CLASS_SIGNUP_WINDOW_DAYS = 7;
const CLASS_SESSION_COLLECTION = "classSessions";
const CLASS_SIGNUP_COLLECTION = "classSessionSignups";
const CLASS_PUBLIC_ROSTER_COLLECTION = "classPublicRosters";
const CLASS_SESSION_STATS_COLLECTION = "classSessionStats";
const CLASS_ANNOUNCEMENT_COLLECTION = "classAnnouncements";
const FAQ_COLLECTION = "faqEntries";
const FAQ_QUESTION_COLLECTION = "faqQuestions";
const SITE_SETTINGS_COLLECTION = "siteSettings";
const CURRENT_TERM_SETTINGS_DOC = "currentTerm";
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
const bootstrapAdminEmailNormalized = bootstrapAdminEmail.trim().toLowerCase();
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

if (firebaseConfigured) {
  void ensureFirebaseModules().catch((error) => console.warn("Firebase SDK warmup failed:", error));
}

let auth = null;
let db = null;
let functions = null;
let currentUser = null;
let currentUserIsAdmin = false;
let currentMemberStatus = "non_member";
let currentMemberProfile = null;
let registrationCodeRequestedFor = "";
let configuredAcademicYear = "";
let configuredAcademicTerm = "";
let configuredAcademicPeriodKey = "";
let membershipPaymentSettings = {
  bankName: "",
  bankCode: "",
  accountName: "",
  accountNumber: "",
  cashOfficeLabel: "中午至社辦繳費",
  cashClassLabel: "社課現場繳費",
};
let authMode = "signin";
let authReadyPromise = null;
let lastLoginTrigger = null;
let lastApplicationTrigger = null;
let lastClassSignupTrigger = null;
let membersAutoRefreshTimer = null;
let publicPageAutoRefreshTimer = null;
let membersDashboardCache = {
  members: [],
  classSessions: [],
  classSessionSignups: [],
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
  query: "",
};

const authCopy = {
  signin: {
    title: "社員登入",
    subtitle: "登入後可以報名參加社團；社費一次繳清後會顯示為正式社員。",
    submitLabel: "登入",
    hint: "輸入已建立的帳號密碼即可登入。",
  },
  signup: {
    title: "建立帳號",
    subtitle: "先建立帳號，再決定本學期是否申請社員資格。",
    submitLabel: "建立帳號",
    hint: "選擇申請社員時，請一併填寫付款方式；幹部確認款項後才會成為正式社員。",
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
  "auth/user-not-found": "查不到這個帳號，請先建立帳號。",
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
          <p class="auth-status-label">社員狀態</p>
          <p class="auth-status-email" data-auth-email></p>
          <p class="login-note" data-auth-status-hint></p>
          <div class="account-membership-summary" data-account-membership-summary></div>
          <button class="button-secondary" data-edit-account-membership type="button">查看／修改本學期申請</button>
          <button class="button-secondary" data-edit-personal-profile type="button">編輯個人資料與通知設定</button>
        </div>

        <form class="form-grid account-membership-form" data-personal-profile-form hidden>
          <div class="section-kicker">個人資料</div>
          <div class="class-signup-profile">
            <div class="form-field"><label for="profile-name">姓名</label><input id="profile-name" name="name" type="text" autocomplete="name" required /></div>
            <div class="form-field"><label for="profile-student-id">學號</label><input id="profile-student-id" name="studentId" type="text" required /></div>
            <div class="form-field"><label for="profile-department">系別</label><input id="profile-department" name="department" type="text" required /></div>
            <div class="form-field"><label for="profile-phone">聯絡電話</label><input id="profile-phone" name="phone" type="tel" autocomplete="tel" required /></div>
          </div>
          <fieldset class="membership-choice-fieldset">
            <legend>通知設定</legend>
            <p class="login-note">勾選想在網站鈴鐺中收到的通知類型。</p>
            <div class="notification-preference-grid">
              <label><input name="notificationAnnouncements" type="checkbox" /> 社團公告</label>
              <label><input name="notificationClassReminders" type="checkbox" /> 社課提醒與異動</label>
              <label><input name="notificationRegistrationUpdates" type="checkbox" /> 報名與候補狀態</label>
              <label><input name="notificationEmail" type="checkbox" /> 同意接收 Email 通知</label>
            </div>
          </fieldset>
          <p class="login-note" data-personal-profile-hint></p>
          <div class="account-membership-actions">
            <button class="button-primary" type="submit">儲存個人設定</button>
            <button class="button-secondary" data-personal-profile-cancel type="button">取消</button>
          </div>
        </form>

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
          <div class="auth-signup-profile" data-auth-signup-profile hidden>
            <div class="form-field">
              <label for="signup-name">姓名</label>
              <input id="signup-name" name="name" placeholder="王小明" type="text" autocomplete="name" />
            </div>
            <div class="form-field">
              <label for="signup-student-id">學號</label>
              <input id="signup-student-id" name="studentId" placeholder="B11303044" type="text" />
            </div>
            <div class="form-field">
              <label for="signup-department">系別</label>
              <input id="signup-department" name="department" placeholder="機械系" type="text" />
            </div>
            <div class="form-field">
              <label for="signup-phone">聯絡電話</label>
              <input id="signup-phone" name="phone" placeholder="09xx-xxx-xxx" type="tel" autocomplete="tel" />
            </div>
            <div class="form-field">
              <label for="signup-verification-code">Email 驗證碼</label>
              <div class="verification-code-row">
                <input id="signup-verification-code" name="verificationCode" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="6 位數驗證碼" type="text" autocomplete="one-time-code" />
                <button class="button-secondary" data-send-registration-code type="button">產生驗證碼</button>
              </div>
              <div class="registration-code-display" data-registration-code-display hidden><span>畫面驗證碼</span><strong></strong></div>
              <small class="form-help">按下「產生驗證碼」後，將畫面顯示的 6 位數字輸入上方。驗證碼 10 分鐘內有效。</small>
            </div>
            <fieldset class="membership-choice-fieldset">
              <legend>本學期是否申請成為社員？</legend>
              <p class="login-note">建立帳號不等於取得社員資格，只有選擇申請並經幹部確認收款後才會成為社員。</p>
              <div class="membership-choice-grid">
                <label class="membership-choice-option">
                  <input name="membershipIntent" type="radio" value="join" />
                  <span><strong>是，我要申請社員</strong><small>接著選擇繳費方式</small></span>
                </label>
                <label class="membership-choice-option">
                  <input name="membershipIntent" type="radio" value="not_join" checked />
                  <span><strong>否，只建立帳號</strong><small>帳號狀態會是非社員</small></span>
                </label>
              </div>
            </fieldset>
            <div class="membership-payment-fields" data-membership-payment-fields hidden>
              <fieldset class="membership-choice-fieldset">
                <legend>選擇付款方式</legend>
                <div class="membership-choice-grid is-three-column">
                  <label class="membership-choice-option">
                    <input name="paymentMethod" type="radio" value="cash" />
                    <span><strong>現金</strong><small>社辦或社課繳費</small></span>
                  </label>
                  <label class="membership-choice-option">
                    <input name="paymentMethod" type="radio" value="transfer" />
                    <span><strong>轉帳</strong><small>轉帳後提供核對資料</small></span>
                  </label>
                  <label class="membership-choice-option">
                    <input name="paymentMethod" type="radio" value="later" />
                    <span><strong>稍後付款</strong><small>可在帳號資訊中補填</small></span>
                  </label>
                </div>
              </fieldset>
              <div class="membership-payment-panel" data-cash-payment-panel hidden>
                <div class="form-field">
                  <label for="signup-cash-slot">預計現金繳費場合</label>
                  <select id="signup-cash-slot" name="cashPaymentSlot">
                    <option value="">請選擇</option>
                    <option data-cash-office-option value="office_lunch">中午至社辦繳費</option>
                    <option data-cash-class-option value="class">社課現場繳費</option>
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
              <span>我已閱讀並同意<a href="./privacy.html" target="_blank" rel="noreferrer">隱私權政策與個人資料蒐集、處理及利用說明</a>，並同意社團基於帳號、社員資格、活動報名及通知目的使用上述資料。</span>
            </label>
          </div>
          <p class="login-note" data-login-hint>${authCopy.signin.hint}</p>
        </form>

        <form class="form-grid account-membership-form" data-account-membership-form hidden>
          <div class="section-kicker">本學期社員申請</div>
          <fieldset class="membership-choice-fieldset">
            <legend>本學期是否申請成為社員？</legend>
            <div class="membership-choice-grid">
              <label class="membership-choice-option"><input name="membershipIntent" type="radio" value="join" /><span><strong>是</strong><small>申請社員資格</small></span></label>
              <label class="membership-choice-option"><input name="membershipIntent" type="radio" value="not_join" /><span><strong>否</strong><small>維持非社員</small></span></label>
            </div>
          </fieldset>
          <div class="membership-payment-fields" data-membership-payment-fields hidden>
            <fieldset class="membership-choice-fieldset">
              <legend>付款方式</legend>
              <div class="membership-choice-grid is-three-column">
                <label class="membership-choice-option"><input name="paymentMethod" type="radio" value="cash" /><span><strong>現金</strong></span></label>
                <label class="membership-choice-option"><input name="paymentMethod" type="radio" value="transfer" /><span><strong>轉帳</strong></span></label>
                <label class="membership-choice-option"><input name="paymentMethod" type="radio" value="later" /><span><strong>稍後付款</strong></span></label>
              </div>
            </fieldset>
            <div class="membership-payment-panel" data-cash-payment-panel hidden>
              <div class="form-field"><label>預計現金繳費場合</label><select name="cashPaymentSlot"><option value="">請選擇</option><option data-cash-office-option value="office_lunch">中午至社辦繳費</option><option data-cash-class-option value="class">社課現場繳費</option></select></div>
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
        <form class="form-grid admin-calendar-event-form" data-admin-calendar-event-form>
          <input name="eventId" type="hidden" value="" />
          <p class="admin-calendar-form-state" data-admin-calendar-form-state>這一天還沒有內容，直接填寫下方欄位即可新增。</p>
          <div class="form-field">
            <label for="admin-calendar-event-type">類型</label>
            <select id="admin-calendar-event-type" name="eventType">
              <option value="class">社課</option>
              <option value="announcement">公告</option>
            </select>
          </div>
          <div class="form-field">
            <label for="admin-calendar-event-title">標題</label>
            <input id="admin-calendar-event-title" name="title" type="text" placeholder="例如：雙打練習 / 場地異動" />
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
          <div class="form-field">
            <label for="admin-calendar-event-location">地點</label>
            <input id="admin-calendar-event-location" name="location" type="text" placeholder="例如：臺科大體育館 2F" required />
          </div>
          <div class="form-field">
            <label for="admin-calendar-event-note">備註</label>
            <textarea id="admin-calendar-event-note" name="note" rows="4" placeholder="可以填無"></textarea>
          </div>
          <label class="admin-calendar-signup-toggle">
            <input name="signupRequired" type="checkbox" checked />
            社課需要報名
          </label>
          <div class="admin-calendar-signup-settings" data-admin-calendar-signup-settings>
            <label class="admin-calendar-signup-toggle">
              <input name="allowNonMembers" type="checkbox" />
              開放非社員報名參加
            </label>
            <div class="form-field">
              <label for="admin-calendar-signup-open">報名開始</label>
              <input id="admin-calendar-signup-open" name="signupOpenAt" step="900" type="datetime-local" />
            </div>
            <div class="form-field">
              <label for="admin-calendar-signup-close">報名截止</label>
              <input id="admin-calendar-signup-close" name="signupCloseAt" step="900" type="datetime-local" />
            </div>
            <div class="admin-signup-window-presets" aria-label="快速設定報名時間">
              <button class="button-secondary" data-signup-window-preset="previous-week" type="button">前一週週三至週五</button>
              <button class="button-secondary" data-signup-window-preset="now" type="button">現在開始</button>
              <button class="button-secondary" data-signup-window-preset="clear" type="button">清除時間</button>
            </div>
            <div class="form-field">
              <label for="admin-calendar-signup-limit">人數上限</label>
              <input id="admin-calendar-signup-limit" name="signupLimit" min="1" placeholder="不填則不限" type="number" />
            </div>
          </div>
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
      <div class="modal-body"><div class="notification-list" data-notification-list></div></div>
      <div class="modal-footer"><button class="button-secondary" data-open-notification-settings type="button">通知設定</button></div>
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
      link.textContent = "加入社團";
    }
  });

  document.querySelectorAll('a[href="./notices.html"]').forEach((link) => {
    if (link.closest(".site-nav") || link.closest(".mobile-nav")) {
      link.textContent = "訊息公告";
    }
  });
};

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
const getApprovedMemberDocId = (applicationId) => `application-${applicationId}`;
const getApprovedMemberDocRef = (applicationId) => doc(db, "members", getApprovedMemberDocId(applicationId));
const getClassAnnouncementDocRef = (announcementId) => doc(db, CLASS_ANNOUNCEMENT_COLLECTION, announcementId);
const getFaqDocRef = (faqId) => doc(db, FAQ_COLLECTION, faqId);
const getFaqQuestionDocRef = (questionId) => doc(db, FAQ_QUESTION_COLLECTION, questionId);
const getSiteSettingsDocRef = (settingId) => doc(db, SITE_SETTINGS_COLLECTION, settingId);
const getClassSessionSortMs = (session) => getDateKeyMs(session.date || session.sessionDate);
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
    button.textContent = currentUser ? getMembershipStatusCopy(getCurrentMembershipStatus()).label : button.dataset.defaultLabel;
  });
  document.querySelectorAll("[data-notification-bell]").forEach((button) => { button.hidden = !currentUser; });
};

const installNotificationBells = () => {
  document.querySelectorAll(".header-actions").forEach((actions) => {
    if (actions.querySelector("[data-notification-bell]")) return;
    const login = actions.querySelector(".header-login");
    if (!login) return;
    const button = document.createElement("button");
    button.className = "notification-bell";
    button.type = "button";
    button.hidden = !currentUser;
    button.dataset.notificationBell = "true";
    button.setAttribute("aria-label", "開啟通知中心");
    button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span class="notification-dot" aria-hidden="true"></span>`;
    actions.insertBefore(button, login);
  });
};

const openNotificationCenter = async () => {
  if (!currentUser) { openLoginModal(); return; }
  const modal = ensureNotificationModal();
  const list = modal.querySelector("[data-notification-list]");
  modal.hidden = false;
  body.classList.add("modal-open");
  list.innerHTML = `<p class="content-copy">載入通知中…</p>`;
  try {
    const preferences = currentMemberProfile?.notificationPreferences || { announcements: true, classReminders: true, registrationUpdates: true };
    const items = [];
    if (preferences.announcements !== false || preferences.classReminders !== false) {
      const announcements = await getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION);
      announcements.sort((a, b) => getAnnouncementSortMs(b) - getAnnouncementSortMs(a)).slice(0, 12).forEach((entry) => {
        items.push({ title: entry.title || "社團公告", copy: entry.note || entry.description || "請查看最新公告內容。", date: formatDateKey(entry.date || entry.startDate || "") });
      });
    }
    if (preferences.registrationUpdates !== false && currentMemberProfile?.membershipStatus === "pending_payment") {
      items.unshift({ title: "社員申請處理中", copy: "幹部確認款項後，系統會更新社員資格。", date: "" });
    }
    list.innerHTML = items.length ? items.map((item) => `<article class="notification-item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.copy)}</p>${item.date ? `<small>${escapeHtml(item.date)}</small>` : ""}</article>`).join("") : `<article class="notification-empty"><h3>目前沒有通知</h3><p>新公告與報名狀態會顯示在這裡。</p></article>`;
  } catch (error) {
    list.innerHTML = `<p class="content-copy">通知載入失敗，請稍後再試。</p>`;
  }
};

const bindNotificationCenter = () => {
  installNotificationBells();
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-notification-bell]")) void openNotificationCenter();
  });
  const modal = ensureNotificationModal();
  const close = () => { modal.hidden = true; body.classList.remove("modal-open"); };
  modal.querySelectorAll("[data-close-notifications]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => { if (event.target === modal || event.target.hasAttribute("data-modal-backdrop")) close(); });
  modal.querySelector("[data-open-notification-settings]")?.addEventListener("click", () => {
    close();
    openLoginModal();
    const { personalProfileForm } = getLoginModalElements();
    populatePersonalProfileForm(personalProfileForm);
    personalProfileForm.hidden = false;
  });
};

const membershipStatusCopy = {
  admin: {
    label: "管理員",
    meaning: "目前具有管理員權限。",
    action: "",
  },  non_member: {
    label: "非社員",
    meaning: "目前不是正式社員。",
    action: "查看加入方式",
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

  if (["formal_member", "formal", "approved", "member"].includes(explicitStatus)) {
    return "formal_member";
  }

  if (["former_member", "former", "expired", "qualification_expired"].includes(explicitStatus)) {
    return "former_member";
  }

  return "non_member";
};

const getMembershipStatusCopy = (status) => membershipStatusCopy[getManagedMembershipStatus(status)];
const getCurrentMembershipStatus = () => (currentUserIsAdmin ? "admin" : getManagedMembershipStatus(currentMemberStatus));
const isOfficialMemberStatus = () => currentUserIsAdmin || getManagedMembershipStatus(currentMemberStatus) === "formal_member";

const getPaymentMethodLabel = (value) =>
  ({ cash: "現金", transfer: "轉帳", later: "稍後付款", none: "未申請" })[String(value || "")] || "尚未選擇";

const getCashPaymentSlotLabel = (value) =>
  value === "office_lunch"
    ? membershipPaymentSettings.cashOfficeLabel
    : value === "class"
      ? membershipPaymentSettings.cashClassLabel
      : "尚未選擇";

const getMembershipIntentFromProfile = (profile = {}) =>
  profile.membershipIntent === "join" || ["pending_payment", "formal_member"].includes(String(profile.membershipStatus || profile.status || ""))
    ? "join"
    : "not_join";

const buildTransferAccountMarkup = () => {
  const hasAccount = membershipPaymentSettings.accountName && membershipPaymentSettings.accountNumber;
  if (!hasAccount) {
    return `<p class="content-copy">管理員尚未設定轉帳帳戶，請先選擇「稍後付款」或向幹部確認。</p>`;
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
  const method = form.querySelector("[name='paymentMethod']:checked")?.value || "";
  const paymentFields = form.querySelector("[data-membership-payment-fields]");
  const cashPanel = form.querySelector("[data-cash-payment-panel]");
  const transferPanel = form.querySelector("[data-transfer-payment-panel]");
  if (paymentFields) {
    paymentFields.hidden = intent !== "join";
  }
  if (cashPanel) {
    cashPanel.hidden = intent !== "join" || method !== "cash";
  }
  if (transferPanel) {
    transferPanel.hidden = intent !== "join" || method !== "transfer";
  }
  form.querySelectorAll("[data-transfer-account-card]").forEach((card) => {
    card.innerHTML = buildTransferAccountMarkup();
  });
  form.querySelectorAll("[data-cash-office-option]").forEach((option) => {
    option.textContent = membershipPaymentSettings.cashOfficeLabel;
  });
  form.querySelectorAll("[data-cash-class-option]").forEach((option) => {
    option.textContent = membershipPaymentSettings.cashClassLabel;
  });
};

const readMembershipPaymentForm = (form) => {
  const membershipIntent = String(form.querySelector("[name='membershipIntent']:checked")?.value || "not_join");
  const paymentMethod = membershipIntent === "join" ? String(form.querySelector("[name='paymentMethod']:checked")?.value || "") : "none";
  return {
    membershipIntent,
    paymentMethod,
    cashPaymentSlot: paymentMethod === "cash" ? String(form.querySelector("[name='cashPaymentSlot']")?.value || "") : "",
    transferAt: paymentMethod === "transfer" ? String(form.querySelector("[name='transferAt']")?.value || "") : "",
    transferLastFive: paymentMethod === "transfer" ? String(form.querySelector("[name='transferLastFive']")?.value || "").trim() : "",
  };
};

const validateMembershipPaymentData = (data) => {
  if (data.membershipIntent !== "join") {
    return "";
  }
  if (!data.paymentMethod) {
    return "請選擇付款方式。";
  }
  if (data.paymentMethod === "cash" && !data.cashPaymentSlot) {
    return "請選擇預計現金繳費場合。";
  }
  if (data.paymentMethod === "transfer" && (!membershipPaymentSettings.accountName || !membershipPaymentSettings.accountNumber)) {
    return "管理員尚未設定轉帳帳戶，請先選擇其他付款方式。";
  }
  if (data.paymentMethod === "transfer" && (!data.transferAt || !/^\d{5}$/.test(data.transferLastFive))) {
    return "請填寫轉帳日期、時間與轉出帳號末五碼。";
  }
  return "";
};

const normalizeMembershipStatus = (memberData = null) => {
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

  const memberDoc = await getDoc(getMemberDocRef(user.uid));
  const memberData = memberDoc.exists() ? memberDoc.data() : null;

  currentMemberProfile = memberData ? { ...memberData } : null;
  currentMemberStatus = normalizeMembershipStatus(memberData);
  return currentMemberStatus;
};

const getFriendlyAuthError = (error) => {
  const code = error?.code;
  return authErrorMessages[code] || "登入發生問題，請稍後再試一次。" + (code ? "（" + code + "）" : "");
};
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
    signupDepartmentInput: loginModal.querySelector("#signup-department"),
    signupPhoneInput: loginModal.querySelector("#signup-phone"),
    signupCodeInput: loginModal.querySelector("#signup-verification-code"),
    privacyConsentInput: loginModal.querySelector("[name='privacyConsent']"),
    sendRegistrationCodeButton: loginModal.querySelector("[data-send-registration-code]"),
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
  const method = profile.paymentMethod || (intent === "join" ? "later" : "none");
  const details = [
    `<span>申請：${intent === "join" ? "本學期申請社員" : "本學期不申請社員"}</span>`,
    intent === "join" ? `<span>付款方式：${escapeHtml(getPaymentMethodLabel(method))}</span>` : "",
    method === "cash" ? `<span>預計場合：${escapeHtml(getCashPaymentSlotLabel(profile.cashPaymentSlot))}</span>` : "",
    method === "transfer" && profile.transferLastFive ? `<span>轉出帳號末五碼：${escapeHtml(profile.transferLastFive)}</span>` : "",
    intent === "join" ? `<span>款項狀態：${profile.paymentStatus === "paid" ? "已確認" : "待幹部確認"}</span>` : "",
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
    statusHint.textContent = currentUserIsAdmin ? "你目前有管理員權限。" : `${statusCopy.meaning}｜${statusCopy.action}`;
    renderAccountMembershipSummary(accountMembershipSummary);
    editAccountMembershipButton.hidden = currentUserIsAdmin || getCurrentMembershipStatus() === "formal_member";
    authSubmit.textContent = signedInCopy.buttonLabel;
    authSubmit.dataset.authAction = "signout";
    authSubmit.removeAttribute("form");
    authSubmit.type = "button";
    return;
  }

  loginModal.querySelector(".modal-title").textContent = authCopy[authMode].title;
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
    try {
      await ensureFirebaseModules();
      const app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      if (setPersistence && browserLocalPersistence) {
        await setPersistence(auth, browserLocalPersistence);
      }
      db = getFirestore(app);
      functions = getFunctions(app, "asia-east1");
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
          !currentMemberProfile &&
          !isBootstrapAdminEmail(user.email || "")
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

      if (!initialAuthStateResolved) {
        initialAuthStateResolved = true;
        resolveInitialAuthState(auth);
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
  setApplicationHint("送出後請留意社費繳費通知，正式社員資格以幹部確認款項為準。");
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
      title: session.title || "未命名社課",
      timeLabel: getClassSessionTimeLabel(session),
      location: session.location || "",
      note: session.reminder || session.description || "",
      source: session,
    }));

  const announcementEvents = membersDashboardCache.announcements
    .filter((announcement) => isDateWithinAnnouncement(dateKey, announcement))
    .map((announcement) => ({
      type: "announcement",
      id: getAdminCalendarAnnouncementId(announcement),
      title: announcement.title || "未命名公告",
      timeLabel: getAnnouncementTimeLabel(announcement),
      location: announcement.location || "",
      note: getAnnouncementNote(announcement),
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
  const isFormalMember = currentUserIsAdmin || currentMemberStatus === "formal_member";
  const canSignup = Boolean(currentUser) && (isFormalMember || Boolean(session.allowNonMembers));
  const isSignupSession = Boolean(session.signupRequired);
  const signupOpen = isSignupSession && isClassSignupWindowOpen(session);
  const statusLabel = isSignupSession ? (signupOpen ? "開放報名" : "尚未開放") : "固定社課";

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
  const signupCount = getSessionSignupCount(sessionId);
  const formMarkup = isSignupSession
    ? buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, signupOpen)
    : `
        <div class="class-session-note">
          <p class="content-copy">此場次不需要報名，請直接依照行事曆出席即可。</p>
        </div>
      `;

  if (title) {
    title.textContent = session.title || "社課報名";
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
            <h3 class="admin-calendar-modal-session-title">${escapeHtml(session.title || "社課")}</h3>
          </div>
          <span class="member-row-status">${escapeHtml(statusLabel)}</span>
        </div>
        ${session.location ? `<p class="admin-calendar-modal-session-copy"><strong>地點：</strong>${escapeHtml(session.location)}</p>` : ""}
        <p class="admin-calendar-modal-session-copy">${escapeHtml(session.description || session.reminder || "這一天有社課安排，請依照時間參與。")}</p>
        ${session.reminder ? `<p class="class-session-reminder">提醒：${escapeHtml(session.reminder)}</p>` : ""}
      </article>
      <div class="class-capacity-summary"><strong>${escapeHtml(getRemainingCapacityMarkup(session))}</strong><span>${escapeHtml(`${signupCount} 人已報名`)}</span></div>
      <section class="class-signup-modal-form-shell">
        ${formMarkup}
      </section>
    </div>
  `;

  bindClassSignupBoardEvents();
};

const bindClassSignupModalTabs = (calendarModal) => {
  calendarModal.querySelectorAll("[data-class-signup-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.classSignupTab === "roster" ? "roster" : "signup";
      calendarModal.dataset.activeTab = nextTab;
      calendarModal.querySelectorAll("[data-class-signup-tab]").forEach((tabButton) => {
        const isActive = tabButton.dataset.classSignupTab === nextTab;
        tabButton.classList.toggle("is-active", isActive);
        tabButton.setAttribute("aria-selected", String(isActive));
      });
      calendarModal.querySelectorAll("[data-class-signup-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.classSignupPanel !== nextTab;
      });
    });
  });
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
  const typeLabel = event.type === "class" ? "社課" : "公告";
  const note = event.note || "無";
  const sessionId = event.type === "class" ? getClassSessionId(event.source || {}) : "";
  const canOpenSignup = includeSignupAction && sessionId && Boolean(event.source?.signupRequired);
  const signupButton =
    canOpenSignup
      ? `<button class="button-primary" data-public-calendar-session-jump type="button" data-session-id="${escapeHtml(sessionId)}">前往報名</button>`
      : "";

  return `
    <article class="admin-calendar-modal-session">
      <div class="admin-calendar-modal-session-head">
        <div>
          <p class="admin-calendar-modal-session-weekday">${escapeHtml(typeLabel)}</p>
          <h3 class="admin-calendar-modal-session-title">${escapeHtml(event.title || `${typeLabel}內容`)}</h3>
        </div>
        ${event.timeLabel ? `<span class="member-row-status">${escapeHtml(event.timeLabel)}</span>` : ""}
      </div>
      ${event.location ? `<p class="admin-calendar-modal-session-copy"><strong>地點：</strong>${escapeHtml(event.location)}</p>` : ""}
      <p class="admin-calendar-modal-session-copy">${escapeHtml(note)}</p>
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

  form.reset();
  const eventId = event?.id || "";
  form.querySelector("[name='eventId']").value = eventId;
  const sourceDate = event?.source?.date || event?.source?.sessionDate || dateKey;
  form.querySelector("[name='date']").value = sourceDate;
  form.querySelector("[name='eventType']").value = event?.type || "class";
  form.querySelector("[name='title']").value = event?.title || "";
  const legacyTimeParts = getLegacyTimeParts(event?.timeLabel || "");
  form.querySelector("[name='endDate']").value = event?.type === "announcement" ? event.source?.endDate || sourceDate : "";
  form.querySelector("[name='startTime']").value = event?.source?.startTime || legacyTimeParts.startTime;
  form.querySelector("[name='endTime']").value = event?.source?.endTime || legacyTimeParts.endTime;
  form.querySelector("[name='location']").value = event?.location || event?.source?.location || "";
  form.querySelector("[name='note']").value = event?.note || "";
  form.querySelector("[name='signupOpenAt']").value = event?.type === "class" ? formatDateTimeLocalValue(event.source?.signupOpenAt) : "";
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
    eventTypeSelect.disabled = Boolean(eventId);
  }
  const signupToggle = form.querySelector(".admin-calendar-signup-toggle");
  const signupSettings = form.querySelector("[data-admin-calendar-signup-settings]");
  const signupFieldsHidden = (event?.type || "class") !== "class";
  const announcementEndDateField = form.querySelector("[data-announcement-end-date-field]");
  if (signupToggle) {
    signupToggle.hidden = signupFieldsHidden;
  }
  if (signupSettings) {
    signupSettings.hidden = signupFieldsHidden;
  }
  if (announcementEndDateField) {
    announcementEndDateField.hidden = !signupFieldsHidden;
  }

  if (deleteButton) {
    deleteButton.disabled = !eventId;
  }

  const stateNode = form.querySelector("[data-admin-calendar-form-state]");
  if (stateNode) {
    stateNode.textContent = eventId
      ? `目前正在編輯「${event?.title || "未命名內容"}」，儲存後會直接覆蓋原本資料。`
      : "目前為新增模式，可建立社課或公告；同一天可以儲存多筆內容。";
  }
  if (saveButton) {
    saveButton.textContent = eventId ? "更新內容" : "儲存";
  }

  form.dataset.editingType = event?.type || "";
  form.dataset.editingId = eventId;
};

const applySignupWindowPreset = (form, preset) => {
  const openInput = form.querySelector("[name='signupOpenAt']");
  const closeInput = form.querySelector("[name='signupCloseAt']");
  if (!(openInput instanceof HTMLInputElement) || !(closeInput instanceof HTMLInputElement)) {
    return;
  }

  if (preset === "clear") {
    openInput.value = "";
    closeInput.value = "";
    return;
  }

  if (preset === "now") {
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    openInput.value = formatDateTimeLocalValue(now);
    return;
  }

  const sessionDate = parseDateKey(form.querySelector("[name='date']")?.value || "");
  if (!sessionDate) {
    window.alert("請先選擇社課日期。");
    return;
  }

  const daysSinceMonday = (sessionDate.getDay() + 6) % 7;
  const currentWeekMonday = new Date(sessionDate);
  currentWeekMonday.setDate(currentWeekMonday.getDate() - daysSinceMonday);

  const signupOpen = new Date(currentWeekMonday);
  signupOpen.setDate(signupOpen.getDate() - 5);
  signupOpen.setHours(0, 0, 0, 0);
  const signupClose = new Date(currentWeekMonday);
  signupClose.setDate(signupClose.getDate() - 3);
  signupClose.setHours(23, 45, 0, 0);
  openInput.value = formatDateTimeLocalValue(signupOpen);
  closeInput.value = formatDateTimeLocalValue(signupClose);
};

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

  if (events.length === 0) {
    list.innerHTML = `
      <p class="admin-calendar-modal-empty">這一天還沒有社課或公告，可以直接在下方新增。</p>
    `;
  } else {
    list.innerHTML = `
      <div class="admin-calendar-modal-list-header">
        <p class="content-copy">選擇既有內容進行編輯，或新增同一天的另一筆內容。</p>
        <button class="button-secondary" data-admin-calendar-event-add type="button">新增同日內容</button>
      </div>
      ${events
        .map((event) => {
          const typeLabel = event.type === "class" ? "社課" : "公告";
          return `
            <button class="admin-calendar-event-chip is-${escapeHtml(event.type)}" data-admin-calendar-event-edit type="button" data-event-type="${escapeHtml(event.type)}" data-event-id="${escapeHtml(event.id)}">
              <span>${escapeHtml(typeLabel)}</span>
              <strong>${escapeHtml(event.title)}</strong>
              <small>${event.timeLabel ? escapeHtml(event.timeLabel) : "不指定時間"}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</small>
            </button>
          `;
        })
        .join("")}
    `;
  }

  if (form) {
    setAdminCalendarEventForm(null, dateKey);
  }

  calendarModal.hidden = false;
  body.classList.add("modal-open");
  bindAdminClassCalendarActions();

  window.setTimeout(() => {
    form?.querySelector("[name='title']")?.focus();
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

const syncMemberProfile = async (user, source, profile = {}) => {
  if (!db || !user?.uid || isBootstrapAdminEmail(user.email || "")) {
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

  const memberRef = getApprovedMemberDocRef(applicationId);
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
      uid: getApprovedMemberDocId(applicationId),
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
    membershipPaymentSettings = {
      ...membershipPaymentSettings,
      bankName: String(settingsData?.membershipPayment?.bankName || "").trim(),
      bankCode: String(settingsData?.membershipPayment?.bankCode || "").trim(),
      accountName: String(settingsData?.membershipPayment?.accountName || "").trim(),
      accountNumber: String(settingsData?.membershipPayment?.accountNumber || "").trim(),
      cashOfficeLabel:
        String(settingsData?.membershipPayment?.cashOfficeLabel || "").trim() || membershipPaymentSettings.cashOfficeLabel,
      cashClassLabel:
        String(settingsData?.membershipPayment?.cashClassLabel || "").trim() || membershipPaymentSettings.cashClassLabel,
    };
    document.querySelectorAll("[data-login-form], [data-account-membership-form]").forEach(syncMembershipPaymentForm);
    syncMembershipPaymentSettingForm();
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

const matchesMemberFilter = (entry) => {
  const yearValue = entry.academicYear || "未設定";
  const termValue = entry.term || "未設定";

  const yearMatch = memberFilters.year === "all" || yearValue === memberFilters.year;
  const termMatch = memberFilters.term === "all" || termValue === memberFilters.term;
  const queryValue = memberFilters.query.trim().toLocaleLowerCase("zh-TW");
  const queryMatch =
    !queryValue ||
    [entry.name, entry.studentId, entry.department, entry.school, entry.email, entry.gmail, entry.phone]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-TW")
      .includes(queryValue);
  return yearMatch && termMatch && queryMatch;
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

  queryInput?.addEventListener("input", () => {
    memberFilters.query = queryInput.value;
    renderFilteredMemberViews();
  });

  yearSelect.dataset.initialized = "true";
};

const patchMembersFilterUI = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");
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

        button.disabled = true;
        try {
          await setDoc(
            getMemberDocRef(memberId),
            {
              paymentStatus: nextPaymentStatus,
              membershipStatus: isPaid ? "formal_member" : "pending_payment",
              status: isPaid ? "formal_member" : "pending_payment",
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

const mergeMembersWithApprovedApplications = (members = []) =>
  members
    .map((member) => ({ ...member, origin: "members" }))
    .filter((member) => !isBootstrapAdminEmail(String(member.email || "")))
    .sort(
      (a, b) =>
        getTimestampMs(a.submittedAt || a.createdAt || a.approvedAt) -
        getTimestampMs(b.submittedAt || b.createdAt || b.approvedAt),
    );

const getFilteredMembersForExport = (members = []) => members.filter(matchesMemberFilter);

const buildMembersExportWorkbook = (members = []) => {
  const columns = [
    "姓名",
    "學號",
    "系別",
    "電話",
    "信箱",
    "學年度",
    "學期",
    "狀態",
    "資料來源",
    "建立時間",
    "最近登入",
  ];
  const rows = members.map((member) => [
    member.name || "",
    member.studentId || "",
    member.department || member.school || "",
    member.phone || "",
    member.email || "",
    getAcademicYearLabel(member.academicYear || "未設定"),
    getAcademicTermLabel(member.term || "未設定"),
    getMembershipStatusCopy(member).label,
    member.origin === "applications" ? "申請通過" : "社員資料",
    formatTimestamp(member.createdAt),
    formatTimestamp(member.lastLoginAt),
  ]);
  const filterLabel = `${memberFilters.year === "all" ? "全部學年度" : getAcademicYearLabel(memberFilters.year)} / ${
    memberFilters.term === "all" ? "全部學期" : getAcademicTermLabel(memberFilters.term)
  }`;
  const allRows = [
    ["社員名單匯出"],
    ["匯出時間", new Date().toLocaleString("zh-TW")],
    ["目前篩選", filterLabel],
    [""],
    columns,
    ...rows,
  ];
  const rowMarkup = allRows
    .map((row) => {
      const cellMarkup = row
        .map((cell) => `<Cell><Data ss:Type="String">${escapeSpreadsheetXml(cell)}</Data></Cell>`)
        .join("");
      return `<Row>${cellMarkup}</Row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="社員名單">
  <Table>${rowMarkup}</Table>
 </Worksheet>
</Workbook>`;
};

const downloadMembersExcel = (members = []) => {
  const workbook = buildMembersExportWorkbook(members);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const yearLabel = memberFilters.year === "all" ? "all-years" : `year-${memberFilters.year}`;
  const termLabel =
    memberFilters.term === "all"
      ? "all-terms"
      : memberFilters.term === "上學期"
        ? "term-1"
        : memberFilters.term === "下學期"
          ? "term-2"
          : "term-unset";

  link.href = url;
  link.download = `ntust-members-${yearLabel}-${termLabel}-${formatExportTimestamp()}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const getMemberStatusOptionsMarkup = (status) => {
  const selectedStatus = getManagedMembershipStatus(status);
  return [
    { value: "non_member", label: "非社員" },
    { value: "former_member", label: "前社員" },
    { value: "formal_member", label: "社員" },
    { value: "admin", label: "管理員" },
  ]
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
      const isFormalMember = nextStatus === "formal_member";
      const isFormerMember = nextStatus === "former_member";
      const memberUpdate = {
        membershipStatus: nextStatus,
        status: nextStatus,
        paymentStatus: isAdmin ? "not_required" : isFormalMember ? "paid" : "unpaid",
        paidAt: isFormalMember ? serverTimestamp() : null,
        paymentConfirmedAt: isFormalMember ? serverTimestamp() : null,
        paymentConfirmedBy: isFormalMember ? currentUser?.uid || "" : "",
        formerMemberAt: isFormerMember ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      };
      select.disabled = true;

      try {
        const batch = writeBatch(db);
        batch.set(getMemberDocRef(memberId), memberUpdate, { merge: true });
        if (isAdmin) {
          batch.set(
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
          batch.delete(getAdminDocRef(memberId));
        }
        if (email) {
          if (isFormalMember) {
            batch.set(
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
            batch.delete(getApprovalDocRef(email));
          }
        }
        await batch.commit();

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
        openActionSuccessModal({
          title: "社員狀態已更新",
          copy: `${email || "這筆帳號"} 已設定為「${getMembershipStatusCopy(nextStatus).label}」。`,
        });
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

const renderMembersExportToolbar = (members = []) => {
  const content = document.querySelector("[data-members-content]");
  const filterCard = content?.querySelector(".member-filter-card");
  if (!content || !filterCard) {
    return;
  }

  const filteredMembers = getFilteredMembersForExport(members);
  const filterLabel = `${memberFilters.year === "all" ? "全部學年度" : getAcademicYearLabel(memberFilters.year)} / ${
    memberFilters.term === "all" ? "全部學期" : getAcademicTermLabel(memberFilters.term)
  }`;
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
      const paymentConfirmed = member.paymentStatus === "paid" || managedStatus === "formal_member" || managedStatus === "admin";
      const paymentMeta = [
        paymentMethod === "cash" ? getCashPaymentSlotLabel(member.cashPaymentSlot) : "",
        paymentMethod === "transfer" && member.transferLastFive ? `末五碼 ${member.transferLastFive}` : "",
        paymentMethod === "transfer" && member.transferAt ? member.transferAt.replace("T", " ") : "",
      ].filter(Boolean);
      const paymentTitle = paymentConfirmed
        ? "已確認收款"
        : membershipIntent === "join"
          ? getPaymentMethodLabel(paymentMethod)
          : "未申請社員";
      const paymentStateClass = paymentConfirmed ? "is-confirmed" : membershipIntent === "join" ? "is-pending" : "is-neutral";
      const paymentMetaCopy = paymentConfirmed
        ? `${getPaymentMethodLabel(paymentMethod)}${paymentMeta.length ? `・${paymentMeta.join("・")}` : ""}`
        : paymentMeta.join("・") || (membershipIntent === "join" ? "等待社員完成付款" : "本學期未提出申請");
      const confirmPaymentButton =
        membershipIntent === "join" && managedStatus !== "formal_member" && managedStatus !== "admin"
          ? `<button class="member-payment-confirm" data-member-action="toggle-membership-payment" data-member-id="${escapeHtml(member.id)}" data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}" data-payment-status="paid" type="button"><span aria-hidden="true">✓</span>確認已收款</button>`
          : "";
      return `
        <tr>
          <td>${String(index + 1).padStart(2, "0")}</td>
          <td>${escapeHtml(member.name || "未填姓名")}</td>
          <td>${escapeHtml(member.studentId || "未填學號")}</td>
          <td>${escapeHtml(member.department || member.school || "未填寫")}</td>
          <td>${escapeHtml(member.email || "未填寫")}</td>
          <td>${escapeHtml(member.phone || "未填寫")}</td>
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
    </div>
    <div class="member-table-wrap">
      <table class="member-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">姓名</th>
            <th scope="col">學號</th>
            <th scope="col">系級</th>
            <th scope="col">Gmail</th>
            <th scope="col">聯絡電話</th>
            <th scope="col">付款資訊</th>
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
};
const renderMembersList = (members = []) => {
  const list = document.querySelector("[data-members-list]");
  if (!list) {
    return;
  }

  const filteredMembers = members.filter((member) => matchesMemberFilter(member) && isFormalMemberRecord(member));

  if (filteredMembers.length === 0) {
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">目前沒有符合條件的社員資料</h3>
        <p class="content-copy">只有已繳費並設定為「社員」的正式社員會顯示在這裡。</p>
      </article>
    `;
    return;
  }

  list.innerHTML = filteredMembers
    .map((member, index) => {
      const memberStatusLabel = "社員";
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
                <span class="member-row-status">${escapeHtml(memberStatusLabel)}</span>
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
              <button class="button-secondary application-save" data-member-action="delete" data-member-origin="${escapeHtml(member.origin || "members")}" data-member-id="${escapeHtml(member.origin === "applications" ? member.applicationId : member.id)}" data-member-email="${escapeHtml((member.email || "").trim().toLowerCase())}" data-member-application-id="${escapeHtml(member.applicationId || "")}" type="button">
                刪除社員資料
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  bindMemberToggleButtons(list);
  bindMemberActionButtons(list);
};

const renderMembersSummary = (members = []) => {
  const summary = document.querySelector("[data-members-summary]");
  if (!summary) {
    return;
  }

  const filteredMembers = members.filter(matchesMemberFilter);
  const formalMembers = filteredMembers.filter(isFormalMemberRecord);

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">正式社員數</p>
      <p class="member-stat-value">${formalMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">符合篩選帳號數</p>
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

  syncMembersPageHero();

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

  try {
    if (force || !membersDashboardCache.loaded) {
      if (!membersDashboardLoadPromise) {
        membersDashboardLoadPromise = (async () => {
          const dashboardWarnings = [];
          const supportingDataPromise = Promise.all([
            loadWithFallback("社課日期", dashboardWarnings, () => getCollectionEntries(CLASS_SESSION_COLLECTION), []),
            loadWithFallback("社課報名", dashboardWarnings, () => getCollectionEntries(CLASS_SIGNUP_COLLECTION), []),
            loadWithFallback("公告", dashboardWarnings, () => getCollectionEntries(CLASS_ANNOUNCEMENT_COLLECTION), []),
            loadWithFallback("FAQ", dashboardWarnings, () => getCollectionEntries(FAQ_COLLECTION), []),
            loadWithFallback("待回答問題", dashboardWarnings, () => getCollectionEntries(FAQ_QUESTION_COLLECTION), []),
          ]);
          const members = await loadWithFallback("社員名單", dashboardWarnings, () => getCollectionEntries("members"), []);

          membersDashboardCache = {
            ...membersDashboardCache,
            members,
            loadWarnings: dashboardWarnings,
            loaded: false,
          };

          const earlyDisplayMembers = mergeMembersWithApprovedApplications(members);
          renderMembersSummary(earlyDisplayMembers);
          renderMembersExportToolbar(earlyDisplayMembers);
          renderMembersList(earlyDisplayMembers);

          const [classSessions, classSessionSignups, announcements, faqs, faqQuestions] = await supportingDataPromise;
          membersDashboardCache = {
            members,
            classSessions,
            classSessionSignups,
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

function isClassSignupWindowOpen(session) {
  const now = Date.now();
  const openMs = getDateTimeLocalMs(session.signupOpenAt);
  const closeMs = getDateTimeLocalMs(session.signupCloseAt);

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

  const diffMs = sessionDateMs - now;
  return diffMs >= 0 && diffMs <= CLASS_SIGNUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function getSessionSignupLimit(session = {}) {
  const limit = Number(session.signupLimit || 0);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
}

function isFormalMemberRecord(member = {}) {
  return getManagedMembershipStatus(member) === "formal_member";
}

function isFormalMemberSignup(signup = {}, member = null) {
  return isFormalMemberRecord(member || {}) || signup.isFormalMemberAtSignup === true || signup.membershipStatusAtSignup === "formal_member";
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
    return "候補";
  }
  return "待確認";
}

function getSessionSignups(sessionId) {
  return classSignupPageState.sessionSignups.filter((signup) => String(signup.sessionId || "") === String(sessionId || ""));
}
function getSessionSignupCount(sessionId) {
  const stats = classSignupPageState.sessionSignups.find((entry) => String(entry.sessionId || entry.id || "") === String(sessionId || ""));
  return Math.max(0, Number(stats?.signupCount || 0));
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

function buildPublicSignupListMarkup(session, signups = []) {
  const sessionId = getClassSessionId(session);
  const sortedSignups = [...signups].sort((a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt));
  const limit = getSessionSignupLimit(session);
  const limitCopy = limit ? `人數上限：${limit} 人` : "人數上限：不限";

  if (sortedSignups.length === 0) {
    return `<div class="class-roster-list"><p class="content-copy">目前尚無報名資料。${escapeHtml(limitCopy)}</p></div>`;
  }

  return `
    <div class="class-roster-list" aria-label="${escapeHtml(sessionId)} 報名名單">
      <p class="content-copy">${escapeHtml(limitCopy)}，目前 ${sortedSignups.length} 人報名。</p>
      ${sortedSignups
        .map(
          (signup, index) => `
            <div class="class-roster-item">
              <span class="class-roster-index">#${String(index + 1).padStart(2, "0")}</span>
              <div>
                <p class="class-roster-name">${escapeHtml(getPublicRosterDisplayName(signup))} / ${escapeHtml(signup.studentId || "未填學號")}</p>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}


function renderClassCalendarBoard(sessions = []) {
  const container = document.querySelector("[data-class-calendar]");
  if (!container) {
    return;
  }

  const openSignupSessions = [...sessions]
    .filter((session) => {
      const isSignupSession = Boolean(session.signupRequired);
      return isSignupSession && isClassSignupWindowOpen(session);
    })
    .sort((a, b) => getClassSessionSortMs(a.session) - getClassSessionSortMs(b.session));

  const sessionMarkup = openSignupSessions
    .map((session) => {
      const sessionId = getClassSessionId(session);
      const signupCount = getSessionSignupCount(sessionId);
      const signupLimit = getSessionSignupLimit(session);
      const signupCountLabel = signupLimit ? `${signupCount} / ${signupLimit} 人` : `${signupCount} 人已報名`;

      return `
        <button class="content-card is-tight class-signup-date-card" data-open-class-signup-session data-session-id="${escapeHtml(sessionId)}" type="button">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "可報名社課")}</p>
              <h3 class="content-title">${escapeHtml(getClassSessionDateLabel(session))}</h3>
              <p class="content-copy">${escapeHtml([getClassSessionTimeLabel(session), session.title || "社課"].filter(Boolean).join(" ・ "))}</p>
              ${session.location ? `<p class="content-copy">地點：${escapeHtml(session.location)}</p>` : ""}
            </div>
            <span class="member-row-status">開放報名</span>
          </div>
          <p class="content-copy">${escapeHtml(signupCountLabel)}，${session.allowNonMembers ? "社員與非社員皆可報名" : "僅限正式社員報名"}。</p>
        </button>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="calendar-shell class-signup-availability">
      <div class="calendar-header">
        <div>
          <p class="section-kicker">Open for Signup</p>
          <h3 class="content-title">目前可報名的社課日期</h3>
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
    ? `<button class="button-secondary" data-class-signup-delete type="button" data-session-id="${escapeHtml(sessionId)}">刪除報名</button>`
    : "";

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
  const canSignup = Boolean(currentUser);

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
      const isSignupSession = Boolean(session.signupRequired);
      const openForSignup = isSignupSession && isClassSignupWindowOpen(session);
      const statusLabel = isSignupSession ? (openForSignup ? "報名中" : "尚未開放") : "固定社課";
      const liveSignupMarkup = isSignupSession ? `<div class="class-capacity-summary"><strong>${escapeHtml(getRemainingCapacityMarkup(session))}</strong></div>` : "";

      return `
        <article class="content-card class-session-card" id="session-${escapeHtml(sessionId)}">
          <div class="class-session-header">
            <div>
              <p class="section-kicker">${escapeHtml(getWeekdayLabel(session.weekday) || "社課")}</p>
              <h3 class="content-title">${escapeHtml(session.title || "社課")}</h3>
              <p class="content-copy">${escapeHtml([getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" ・ "))}</p>
            </div>
            <span class="member-row-status">${escapeHtml(statusLabel)}</span>
          </div>
          <p class="content-copy">${escapeHtml(session.description || session.reminder || "請依照行事曆確認社課日期。")}</p>
          ${session.reminder ? `<p class="class-session-reminder">提醒：${escapeHtml(session.reminder)}</p>` : ""}
          ${
            isSignupSession
              ? buildClassSignupFormMarkup(session, approvalData, ownSignup, canSignup, openForSignup)
              : `<div class="class-session-note"><p class="content-copy">此場次不需要報名，請直接依行事曆出席即可。</p></div>`
          }
          ${liveSignupMarkup}
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
              <h3 class="content-title">${escapeHtml(session.title || "社課名單")}</h3>
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

      const confirmed = window.confirm("要刪除這筆社課報名嗎？");
      if (!confirmed) {
        return;
      }

      try {
        await ensureAuthReady();
        await callBackend("deleteClassSessionSignup", { sessionId });
        await refreshClassSignupPageSafe({ force: true });
      } catch (error) {
        console.error("Delete class signup failed:", error);
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

  const ownExistingSignup = classSignupPageState.ownSignups.find((signup) => signup.sessionId === sessionId) || null;
  const currentMembershipStatus = currentMemberProfile?.membershipStatus || currentMemberProfile?.status || "pending_payment";
  const isFormalMember = currentUserIsAdmin || currentMembershipStatus === "formal_member";

  if (!isFormalMember && !session.allowNonMembers) {
    window.alert("本場社課僅開放正式社員報名。");
    return;
  }

  submitButton.disabled = true;

  try {
    await callBackend("upsertClassSessionSignup", { sessionId, note });

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
    if (rosterBoard) rosterBoard.innerHTML = message;
    return;
  }

  try {
    const loadWarnings = [];
    if (force || !classSignupPageState.loaded) {
      const [sessions, allSignups, ownSignups, approvalDoc] = await Promise.all([
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
      ]);

      classSignupPageState.sessions = sessions;
      classSignupPageState.sessionSignups = allSignups;
      classSignupPageState.ownSignups = ownSignups.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      classSignupPageState.approval =
        approvalDoc && typeof approvalDoc.exists === "function" && approvalDoc.exists() ? approvalDoc.data() : null;
      classSignupPageState.loadWarnings = loadWarnings;
      classSignupPageState.loaded = true;
    }

    renderClassCalendarBoard(classSignupPageState.sessions);
    if (rosterBoard) renderClassRosterBoard(classSignupPageState.sessions);
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
    const isToday = dateKey === todayKey;

    const dayTag = hasAnnouncement ? "button" : "article";
    const dayAttrs = hasAnnouncement ? ` type="button" data-public-announcement-day data-date-key="${escapeHtml(dateKey)}"` : "";
    cells.push(`
      <${dayTag} class="admin-calendar-day${hasAnnouncement ? " is-session has-announcement is-clickable" : ""}${isToday ? " is-today" : ""}"${dayAttrs}>
        <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
        <span class="admin-calendar-day-events">
          ${dayAnnouncements
            .map(
              (announcement) => `
                <span class="admin-calendar-day-badge is-announcement">
                  ${escapeHtml(getAnnouncementTimeLabel(announcement) || "公告")}
                </span>
                <strong class="announcement-calendar-title">${escapeHtml(announcement.title || "公告")}</strong>
                <small class="announcement-calendar-note">${escapeHtml(announcement.body || announcement.message || announcement.reminder || "")}</small>
              `,
            )
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
          <p class="section-description">公告會依照日期顯示在行事曆上，有異動時可以直接看當天內容。</p>
        </div>
        <div class="admin-calendar-nav">
          <button class="button-secondary" data-announcement-calendar-prev type="button">上個月</button>
          <button class="button-secondary" data-announcement-calendar-next type="button">下個月</button>
        </div>
      </div>
      ${monthAnnouncementCount === 0 ? `<p class="admin-calendar-empty-board">這個月份目前沒有公告。</p>` : ""}
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
          type: "announcement",
          id: getAdminCalendarAnnouncementId(announcement),
          title: announcement.title || "公告",
          timeLabel: getAnnouncementTimeLabel(announcement),
          location: announcement.location || "",
          note: getAnnouncementNote(announcement),
          source: announcement,
        }));
      const parsedDate = parseDateKey(dateKey);
      openPublicCalendarModal({
        title: parsedDate
          ? parsedDate.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
          : dateKey,
        subtitle: `${getWeekdayLabel(DATE_WEEKDAY_ORDER[parsedDate?.getDay?.() ?? 0] || "")} · ${events.length} 則公告`,
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

    submitButton.disabled = true;
    if (status) {
      status.textContent = "問題送出中…";
    }

    try {
      await ensureAuthReady();
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

function renderAdminFaqQuestions(questionEntries = []) {
  const container = document.querySelector("[data-faq-question-admin-list]");
  if (!container) {
    return;
  }

  const sortedQuestions = [...questionEntries].sort((a, b) => {
    const statusOrder = { pending: 0, answered: 1 };
    const statusDifference = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
    return statusDifference || getFaqSortMs(b) - getFaqSortMs(a);
  });

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
      const answered = entry.status === "answered" && String(entry.answer || "").trim();
      return `
        <article class="content-card is-tight faq-question-admin-card">
          <div class="faq-question-admin-header">
            <span class="timeline-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="member-status-badge">${answered ? "已回答" : "待回答"}</span>
          </div>
          <h4 class="content-title">${escapeHtml(entry.question || "未填寫問題")}</h4>
          <form class="form-grid faq-form" data-faq-question-answer-form data-question-id="${escapeHtml(entry.id)}">
            <div class="form-field">
              <label for="faq-question-answer-${escapeHtml(entry.id)}">回答</label>
              <textarea id="faq-question-answer-${escapeHtml(entry.id)}" name="answer" rows="4" placeholder="輸入回答後會發布到 FAQ">${escapeHtml(entry.answer || "")}</textarea>
            </div>
            <div class="application-actions class-admin-actions">
              <button class="button-primary" type="submit">${answered ? "更新回答" : "發布回答"}</button>
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
        batch.set(
          getFaqQuestionDocRef(questionId),
          {
            answer,
            status: "answered",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        await batch.commit();
        await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
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
        <h3 class="content-title">報名名單與零打費狀態</h3>
        <p class="section-description">依場次顯示所有報名者。正式社員不需要單場零打費；非社員可在這裡標記該場零打費，社費請到社員名單標記。</p>
      </div>
      <div class="member-list">
        ${sessionsWithSignups
          .map(({ session, sessionId, signups: sessionSignups }) => {
            const limit = getSessionSignupLimit(session);
            const sortedSignups = [...sessionSignups].sort((a, b) => getTimestampMs(a.submittedAt || a.createdAt) - getTimestampMs(b.submittedAt || b.createdAt));
            return `
              <article class="member-row">
                <div class="member-row-top">
                  <p class="member-row-index">${escapeHtml(session.title || "社團報名")}</p>
                  <p class="member-row-status">${limit ? `上限 ${limit} 人` : "不限人數"}</p>
                </div>
                <p class="member-row-email">${escapeHtml([getClassSessionDateLabel(session), getClassSessionTimeLabel(session)].filter(Boolean).join(" / "))}</p>
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
                        <article class="member-row is-nested">
                          <div class="member-row-top">
                            <p class="member-row-index">#${String(index + 1).padStart(2, "0")} ${escapeHtml(signup.name || "未填姓名")}</p>
                            <p class="member-row-status">${escapeHtml(getSignupStatusLabel({ ...signup, signupStatus: computedStatus }))} / ${escapeHtml(paymentLabel)}</p>
                          </div>
                          <p class="member-row-email">${escapeHtml(signup.email || "未填信箱")}</p>
                          <div class="member-row-meta">
                            <span>學號：${escapeHtml(signup.studentId || "未填寫")}</span>
                            <span>身分：${escapeHtml(isFormalMember ? "正式社員" : "非社員零打")}</span>
                            <span>備註：${escapeHtml(signup.note || "無")}</span>
                          </div>
                          ${paymentAction ? `<div class="application-actions">${paymentAction}</div>` : ""}
                        </article>
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
    const sessionCount = daySessions.length;
    const announcementCount = dayAnnouncements.length;
    const eventCount = sessionCount + announcementCount;
    const isToday = dateKey === todayKey;

    cells.push(`
      <button
        class="admin-calendar-day${eventCount > 0 ? " is-session" : ""}${announcementCount > 0 ? " has-announcement" : ""}${isToday ? " is-today" : ""}"
        type="button"
        data-admin-calendar-day
        data-date-key="${escapeHtml(dateKey)}"
      >
        <span class="admin-calendar-day-number">${escapeHtml(String(day))}</span>
        ${eventCount > 0 ? `<span class="admin-calendar-day-marker" aria-hidden="true"></span>` : ""}
        <span class="admin-calendar-day-events">
          ${sessionCount > 0 ? `<span class="admin-calendar-day-badge">${escapeHtml(`${sessionCount} 社課`)}</span>` : ""}
          ${announcementCount > 0 ? `<span class="admin-calendar-day-badge is-announcement">${escapeHtml(`${announcementCount} 公告`)}</span>` : ""}
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

  container.querySelector("[data-admin-calendar-date-jump]")?.addEventListener("change", (event) => {
    const dateKey = String(event.target.value || "");
    const date = parseDateKey(dateKey);
    if (!date) {
      return;
    }
    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(date);
    renderAdminClassCalendarCompact(sessions, signups);
    window.setTimeout(() => openAdminClassCalendarModal(dateKey), 0);
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
      const announcementEndDateField = form.querySelector("[data-announcement-end-date-field]");
      const signupFieldsHidden = event.target.value !== "class";
      if (signupToggle) {
        signupToggle.hidden = signupFieldsHidden;
      }
      if (signupSettings) {
        signupSettings.hidden = signupFieldsHidden;
      }
      if (announcementEndDateField) {
        announcementEndDateField.hidden = !signupFieldsHidden;
      }
      if (signupFieldsHidden) {
        const startDate = form.querySelector("[name='date']")?.value || "";
        const endDateInput = form.querySelector("[name='endDate']");
        if (endDateInput instanceof HTMLInputElement && !endDateInput.value) {
          endDateInput.value = startDate;
        }
      }
    });
    form.querySelector("[name='date']")?.addEventListener("change", (event) => {
      const endDateInput = form.querySelector("[name='endDate']");
      if (endDateInput instanceof HTMLInputElement && (!endDateInput.value || endDateInput.value < event.target.value)) {
        endDateInput.value = event.target.value;
      }
    });
    form.querySelectorAll("[data-signup-window-preset]").forEach((button) => {
      button.addEventListener("click", () => applySignupWindowPreset(form, button.dataset.signupWindowPreset || "previous-week"));
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
        const relatedSignups = membersDashboardCache.classSessionSignups.filter((signup) => String(signup.sessionId || "") === sessionId);
        await Promise.all(
          relatedSignups.flatMap((signup) => [
            deleteDoc(doc(db, CLASS_SIGNUP_COLLECTION, signup.id)),
            deleteDoc(doc(db, CLASS_PUBLIC_ROSTER_COLLECTION, signup.id)),
          ]),
        );
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

async function handleAdminCalendarEventSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("[data-admin-calendar-save]");
  const eventId = String(form.dataset.editingId || form.querySelector("[name='eventId']")?.value || "").trim();
  const date = String(form.querySelector("[name='date']")?.value || "").trim();
  const eventType = String(form.querySelector("[name='eventType']")?.value || form.dataset.editingType || "class").trim();
  const title = String(form.querySelector("[name='title']")?.value || "").trim();
  const endDate = eventType === "announcement" ? String(form.querySelector("[name='endDate']")?.value || date).trim() : date;
  const startTime = String(form.querySelector("[name='startTime']")?.value || "").trim();
  const endTime = String(form.querySelector("[name='endTime']")?.value || "").trim();
  const timeLabel = buildEventTimeLabel(startTime, endTime);
  const location = String(form.querySelector("[name='location']")?.value || "").trim();
  const note = String(form.querySelector("[name='note']")?.value || "").trim() || "無";
  const signupRequired = Boolean(form.querySelector("[name='signupRequired']")?.checked);
  const allowNonMembers = Boolean(form.querySelector("[name='allowNonMembers']")?.checked);
  const signupOpenAt = String(form.querySelector("[name='signupOpenAt']")?.value || "").trim();
  const signupCloseAt = String(form.querySelector("[name='signupCloseAt']")?.value || "").trim();
  const signupLimit = Number(form.querySelector("[name='signupLimit']")?.value || 0);
  const weekday = getWeekdayKeyFromDateValue(date);

  if (!date || !title || !location) {
    window.alert("請先填寫標題、日期與地點。");
    return;
  }

  if ((startTime && !endTime) || (!startTime && endTime)) {
    window.alert("開始時間與結束時間請一起填寫，或兩者都留空。");
    return;
  }

  if (eventType === "announcement" && endDate < date) {
    window.alert("公告結束日期不能早於開始日期。");
    form.querySelector("[name='endDate']")?.focus();
    return;
  }

  if (startTime && endTime && date === endDate && startTime >= endTime) {
    window.alert("結束時間必須晚於開始時間。");
    return;
  }

  if (signupRequired && signupOpenAt && signupCloseAt && getDateTimeLocalMs(signupOpenAt) >= getDateTimeLocalMs(signupCloseAt)) {
    window.alert("報名截止時間必須晚於報名開始時間。");
    form.querySelector("[name='signupCloseAt']")?.focus();
    return;
  }

  submitButton.disabled = true;

  try {
    if (eventType === "announcement") {
      const announcementRef = eventId ? getClassAnnouncementDocRef(eventId) : doc(collection(db, CLASS_ANNOUNCEMENT_COLLECTION));
      const existing = eventId ? await getDoc(announcementRef) : null;
      await setDoc(
        announcementRef,
        {
          date,
          endDate,
          title,
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
          startTime,
          endTime,
          timeLabel,
          location,
          description: note,
          reminder: note,
          signupRequired,
          allowNonMembers: signupRequired && allowNonMembers,
          signupOpenAt,
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
    }

    adminClassCalendarMonthOffset = getAdminCalendarMonthOffset(parseDateKey(date) || new Date());
    await refreshMembersDashboardSafe({ force: true, preserveExpandedRows: true });
    closeAdminClassCalendarModal();
    openActionSuccessModal({
      title: "儲存完畢",
      copy: eventId ? "內容已更新，原本的資料已同步覆蓋。" : "新內容已建立完成。",
    });
  } catch (error) {
    console.error("Save calendar event failed:", error);
    window.alert(`儲存失敗：${error?.message || "請稍後再試一次。"}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleAdminCalendarEventDelete() {
  const { form, deleteButton } = getAdminClassCalendarModalElements();
  const eventId = String(form?.querySelector("[name='eventId']")?.value || "").trim();
  const eventType = String(form?.querySelector("[name='eventType']")?.value || "").trim();
  const date = String(form?.querySelector("[name='date']")?.value || "").trim();

  if (!eventId || !eventType) {
    return;
  }

  const confirmed = window.confirm(`確定要刪除這筆${eventType === "announcement" ? "公告" : "社課"}嗎？`);
  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;

  try {
    if (eventType === "announcement") {
      await deleteDoc(getClassAnnouncementDocRef(eventId));
    } else {
      const relatedSignups = membersDashboardCache.classSessionSignups.filter((signup) => String(signup.sessionId || "") === eventId);
      await Promise.all(
        relatedSignups.flatMap((signup) => [
          deleteDoc(doc(db, CLASS_SIGNUP_COLLECTION, signup.id)),
          deleteDoc(doc(db, CLASS_PUBLIC_ROSTER_COLLECTION, signup.id)),
        ]),
      );
      await deleteDoc(getClassSessionDocRef(eventId));
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

const callBackend = async (name, data = {}) => {
  const readyAuth = await ensureAuthReady();
  if (!readyAuth || !functions || !httpsCallable) {
    throw new Error("後端服務目前無法使用，請稍後再試。");
  }
  const result = await httpsCallable(functions, name)(data);
  return result.data;
};

const handleSendRegistrationCode = async () => {
  const { emailInput, sendRegistrationCodeButton, loginModal } = getLoginModalElements();
  const email = String(emailInput?.value || "").trim().toLowerCase();
  if (!email.includes("@")) {
    setHint("請先輸入有效的電子郵件信箱。", "error");
    emailInput?.focus();
    return;
  }
  sendRegistrationCodeButton.disabled = true;
  try {
    const result = await callBackend("requestRegistrationCode", { email });
    registrationCodeRequestedFor = email;
    const display = loginModal.querySelector("[data-registration-code-display]");
    display.hidden = false;
    display.querySelector("strong").textContent = result.code;
    setHint("驗證碼已顯示在畫面上，請在 10 分鐘內輸入。", "success");
  } catch (error) {
    setHint(error?.message || "驗證碼產生失敗，請稍後再試。", "error");
  } finally {
    sendRegistrationCodeButton.disabled = false;
  }
};

const populatePersonalProfileForm = (form) => {
  if (!(form instanceof HTMLFormElement)) return;
  const profile = currentMemberProfile || {};
  ["name", "studentId", "department", "phone"].forEach((key) => {
    const input = form.elements.namedItem(key);
    if (input instanceof HTMLInputElement) input.value = profile[key] || (key === "department" ? profile.school || "" : "");
  });
  const preferences = profile.notificationPreferences || {};
  const defaults = { notificationAnnouncements: true, notificationClassReminders: true, notificationRegistrationUpdates: true, notificationEmail: false };
  Object.entries(defaults).forEach(([name, fallback]) => {
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.checked = preferences[name.replace("notification", "").replace(/^./, (c) => c.toLowerCase())] ?? fallback;
  });
};

const handlePersonalProfileSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const hint = form.querySelector("[data-personal-profile-hint]");
  if (!currentUser?.uid) return;
  const values = Object.fromEntries(new FormData(form));
  const name = String(values.name || "").trim();
  const studentId = String(values.studentId || "").trim();
  const department = String(values.department || "").trim();
  const phone = String(values.phone || "").trim();
  if (!name || !studentId || !department || !phone) {
    setMessageTone(hint, "請完整填寫姓名、學號、系別與聯絡電話。", "error");
    return;
  }
  try {
    await setDoc(getMemberDocRef(currentUser.uid), {
      name, studentId, department, school: department, phone,
      notificationPreferences: {
        announcements: Boolean(form.elements.namedItem("notificationAnnouncements")?.checked),
        classReminders: Boolean(form.elements.namedItem("notificationClassReminders")?.checked),
        registrationUpdates: Boolean(form.elements.namedItem("notificationRegistrationUpdates")?.checked),
        email: Boolean(form.elements.namedItem("notificationEmail")?.checked),
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await loadCurrentMemberStatus(currentUser);
    setMessageTone(hint, "個人資料與通知設定已儲存。", "success");
  } catch (error) {
    setMessageTone(hint, error?.message || "儲存失敗，請稍後再試。", "error");
  }
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();

  const { emailInput, passwordInput, confirmInput, authSubmit, signupNameInput, signupStudentIdInput, signupDepartmentInput, signupPhoneInput, signupCodeInput, privacyConsentInput } = getLoginModalElements();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;
  const signupProfile = {
    name: String(signupNameInput?.value || "").trim(),
    studentId: String(signupStudentIdInput?.value || "").trim(),
    department: String(signupDepartmentInput?.value || "").trim(),
    phone: String(signupPhoneInput?.value || "").trim(),
    verificationCode: String(signupCodeInput?.value || "").trim(),
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

  if (authMode === "signup" && (!signupProfile.name || !signupProfile.studentId || !signupProfile.department || !signupProfile.phone)) {
    setHint("請完整填寫姓名、學號、系別與聯絡電話。", "error");
    return;
  }

  if (authMode === "signup" && (!/^\d{6}$/.test(signupProfile.verificationCode) || registrationCodeRequestedFor !== email)) {
    setHint("請先產生並輸入畫面顯示的 6 位數驗證碼。", "error");
    return;
  }

  if (authMode === "signup" && !privacyConsentInput?.checked) {
    setHint("必須閱讀並同意個人資料蒐集說明後才能建立帳號。", "error");
    return;
  }

  if (authMode === "signup") {
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

    if (authMode === "signup") {
      await callBackend("completeVerifiedRegistration", { email, password, profile: signupProfile, verificationCode: signupProfile.verificationCode, privacyConsent: true });
    }
    const credential = await signInWithEmailAndPassword(readyAuth, email, password);

    currentUser = credential.user;
    let profileSyncFailed = false;

    try {
      await ensureBootstrapAdminDoc(credential.user);
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
      profileSyncFailed
        ? "登入成功，但社員資料暫時無法同步；你仍可保持登入並稍後再試。"
        : authMode === "signup"
          ? signupProfile.membershipIntent === "join"
            ? "帳號建立完成，社員申請已送出；幹部確認款項後才會取得社員資格。"
            : "帳號建立完成，已自動登入；目前狀態為非社員。"
          : "登入成功，已更新社員狀態。",
      profileSyncFailed ? "error" : "success",
    );
    event.target.reset();
    registrationCodeRequestedFor = "";
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
      academicYear: getConfiguredAcademicYear(),
      term: getConfiguredAcademicTerm(),
      approved: false,
      reviewStatus: "pending",
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (currentUser?.uid && currentUser.email?.trim().toLowerCase() === email) {
      await setDoc(
        getMemberDocRef(currentUser.uid),
        {
          uid: currentUser.uid,
          email,
          name,
          studentId,
          department,
          phone,
          applicationType,
          status: "pending_payment",
          membershipStatus: "pending_payment",
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
    openApplicationSuccessModal();
    setApplicationHint("申請已送出。請依通知完成一次性社費繳納，幹部確認後才會成為正式社員。", "success");
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
    setMessageTone(hint, "款項已確認，若需變更請聯絡幹部。", "error");
    return;
  }

  submitButton.disabled = true;
  try {
    const nextMembershipStatus = paymentData.membershipIntent === "join" ? "pending_payment" : "not_applied";
    await setDoc(
      getMemberDocRef(currentUser.uid),
      {
        membershipIntent: paymentData.membershipIntent,
        membershipStatus: nextMembershipStatus,
        status: nextMembershipStatus,
        paymentStatus: "unpaid",
        paymentMethod: paymentData.paymentMethod,
        cashPaymentSlot: paymentData.cashPaymentSlot,
        transferAt: paymentData.transferAt,
        transferLastFive: paymentData.transferLastFive,
        academicYear: getConfiguredAcademicYear(),
        term: getConfiguredAcademicTerm(),
        paymentSubmittedAt: paymentData.membershipIntent === "join" ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await loadCurrentMemberStatus(currentUser);
    updateLoginButtons();
    updateAuthView();
    setMessageTone(hint, "社員申請資料已更新。", "success");
  } catch (error) {
    console.error("Update membership application failed:", error);
    setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試一次。"}`, "error");
  } finally {
    submitButton.disabled = false;
  }
};

const bindLoginModalEvents = () => {
  const { loginModal, loginForm, authTabs, authSubmit, closeButtons, accountMembershipForm, editAccountMembershipButton, personalProfileForm, editPersonalProfileButton, sendRegistrationCodeButton, emailInput } = getLoginModalElements();

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", handleAuthSubmit);
  sendRegistrationCodeButton.addEventListener("click", handleSendRegistrationCode);
  emailInput.addEventListener("input", () => {
    if (registrationCodeRequestedFor && registrationCodeRequestedFor !== emailInput.value.trim().toLowerCase()) {
      registrationCodeRequestedFor = "";
      const display = loginModal.querySelector("[data-registration-code-display]");
      if (display) display.hidden = true;
    }
  });
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
  editPersonalProfileButton.addEventListener("click", () => {
    accountMembershipForm.hidden = true;
    populatePersonalProfileForm(personalProfileForm);
    personalProfileForm.hidden = false;
    personalProfileForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  personalProfileForm.querySelector("[data-personal-profile-cancel]")?.addEventListener("click", () => { personalProfileForm.hidden = true; });
  accountMembershipForm.querySelector("[data-account-membership-cancel]")?.addEventListener("click", () => {
    accountMembershipForm.hidden = true;
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
      memberFilters.year = value;
      memberFilters.term = term;
      patchMembersFilterUI();
      void refreshMembersDashboardSafe();
      if (hint) {
        hint.textContent = `已設定目前學期為 ${value} 學年度 ${getAcademicTermLabel(term)}。`;
      }
      openActionSuccessModal({
        title: "儲存成功",
        copy: `目前學期已設定為 ${value} 學年度 ${getAcademicTermLabel(term)}。`,
      });
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
};

const bindMembershipPaymentSetting = () => {
  const form = document.querySelector("[data-membership-payment-setting-form]");
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") {
    return;
  }
  form.dataset.bound = "true";
  syncMembershipPaymentSettingForm();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const nextSettings = {
      bankName: String(formData.get("bankName") || "").trim(),
      bankCode: String(formData.get("bankCode") || "").trim(),
      accountName: String(formData.get("accountName") || "").trim(),
      accountNumber: String(formData.get("accountNumber") || "").replace(/\s+/g, ""),
      cashOfficeLabel: String(formData.get("cashOfficeLabel") || "").trim(),
      cashClassLabel: String(formData.get("cashClassLabel") || "").trim(),
    };
    const hint = form.querySelector("[data-membership-payment-setting-hint]");
    const submitButton = form.querySelector("[data-membership-payment-setting-save]");
    if (!nextSettings.accountName || !nextSettings.accountNumber || !nextSettings.cashOfficeLabel || !nextSettings.cashClassLabel) {
      setMessageTone(hint, "請至少填寫戶名、轉帳帳號與兩個現金繳費說明。", "error");
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
      setMessageTone(hint, "繳費資訊已儲存。", "success");
      openActionSuccessModal({ title: "儲存成功", copy: "註冊與帳號資訊頁已套用最新繳費資訊。" });
    } catch (error) {
      console.error("Save membership payment settings failed:", error);
      setMessageTone(hint, `儲存失敗：${error?.message || "請稍後再試一次。"}`, "error");
    } finally {
      submitButton.disabled = false;
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
  bindMembershipPaymentSetting();
  bindFaqQuestionForm();
  initFaqAccordion();
  initMembersAutoRefresh();
  initPublicBoardAutoRefresh();
  syncGlobalNavigationLabels();
  updateLoginButtons();

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

const navigateSpa = async (target, { replace = false } = {}) => {
  const targetUrl = new URL(target, window.location.href);
  if (!isSpaPageUrl(targetUrl)) {
    window.location.assign(targetUrl.href);
    return;
  }

  if (targetUrl.pathname === renderedSpaPath) {
    if (targetUrl.hash) {
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
  bindMembershipPaymentSetting();
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

  await activateCurrentPage();
};

void init();
