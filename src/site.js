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
import { bootstrapAdminEmail, firebaseConfig } from "./firebase-config.js";

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
    title: "?餃蝷曉?亙",
    subtitle: "撌脤?撖拇銝血???甈曇??舐雿?靽∠拳??蝣潛?乓?,
    submitLabel: "Sign In",
    hint: "憒?雿?瘝遣蝡董??隢?摰??勗?撖拇??甈橘????啗酉??,
  },
  signup: {
    title: "撱箇?蝷曉撣唾?",
    subtitle: "?芣?撖拇??銝歇摰?隞狡?隢??撱箇??餃撣唾???,
    submitLabel: "Create Account",
    hint: "??勗??唾?嚗?蝞∠??∠Ⅱ隤???隞狡敺???靘酉??,
  },
};

const signedInCopy = {
  title: "?餃摰?",
  subtitle: "雿?撣唾?撌脩??餃??嚗?典隞亦匱蝥蝙?函冗?∪??賬?,
  buttonLabel: "Sign Out",
};

const authErrorMessages = {
  "auth/email-already-in-use": "?縑蝞勗歇蝬酉??鈭?隢?亦?乓?,
  "auth/invalid-credential": "靽∠拳??蝣潔?甇?Ⅱ嚗??Ⅱ隤?甈～?,
  "auth/invalid-email": "隢撓?交迤蝣箇?靽∠拳?澆???,
  "auth/missing-password": "隢撓?亙?蝣潦?,
  "auth/network-request-failed": "?桀??⊥??????Firebase嚗?瑼Ｘ蝬脰楝敺?閰艾?,
  "auth/too-many-requests": "?岫甈⊥??嚗?蝔??岫??,
  "auth/user-disabled": "?董??瘜蝙?剁?隢蝯∠恣??,
  "auth/user-not-found": "?曆??圈董??隢?撱箇?撣唾???,
  "auth/weak-password": "撖Ⅳ撘瑕漲銝雲嚗??喳?雿輻 8 蝣潦?,
};

const loginModalMarkup = `
  <div class="modal" data-login-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="login-title">?餃蝷曉?亙</h2>
          <p class="modal-subtitle" data-auth-subtitle></p>
        </div>
        <button class="modal-close" data-close-login type="button" aria-label="???餃閬?">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="auth-switch" role="tablist" aria-label="?餃璅∪???">
          <button class="auth-tab is-active" data-auth-tab="signin" type="button" role="tab" aria-selected="true">
            ?餃
          </button>
          <button class="auth-tab" data-auth-tab="signup" type="button" role="tab" aria-selected="false">
            閮餃?
          </button>
        </div>

        <div class="auth-status-card" data-auth-status hidden>
          <p class="auth-status-label">Signed In</p>
          <p class="auth-status-email" data-auth-email></p>
          <p class="login-note" data-auth-status-hint></p>
          <div class="auth-status-actions">
            <a class="button-secondary auth-admin-link" data-auth-admin-link href="./members.html" hidden>撖拇敺</a>
          </div>
        </div>

        <form class="form-grid" data-login-form id="login-form" novalidate>
          <div class="form-field">
            <label for="login-email">靽∠拳</label>
            <input id="login-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="login-password">撖Ⅳ</label>
            <input
              id="login-password"
              name="password"
              placeholder="?喳? 8 蝣?
              type="password"
              autocomplete="current-password"
            />
          </div>
          <div class="form-field" data-auth-confirm-field hidden>
            <label for="login-password-confirm">蝣箄?撖Ⅳ</label>
            <input
              id="login-password-confirm"
              name="passwordConfirm"
              placeholder="?活頛詨撖Ⅳ"
              type="password"
              autocomplete="new-password"
            />
          </div>
          <p class="login-note" data-login-hint></p>
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
          <h2 class="modal-title" id="application-title">?蝢賜?蝷曉??亦隢?/h2>
          <p class="modal-subtitle" data-application-subtitle>?‵鞈?嚗?蝞∠??∪祟?貉?蝣箄?隞狡敺?雿??賢遣蝡?亙董??/p>
        </div>
        <button class="modal-close" data-close-application type="button" aria-label="???唾?閬?">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <form class="form-grid" data-application-form id="application-form" novalidate>
          <input data-application-type name="applicationType" type="hidden" value="club" />
          <div class="form-field">
            <label for="application-name">憪?</label>
            <input id="application-name" name="name" placeholder="???? type="text" autocomplete="name" />
          </div>
          <div class="form-field">
            <label for="application-email">?舐窗靽∠拳</label>
            <input id="application-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="application-school">摮豢 / ?桐?</label>
            <input id="application-school" name="school" placeholder="?箇?憭?/ 憭 / ?嗡?" type="text" />
          </div>
          <div class="form-field">
            <label for="application-note">?酉</label>
            <textarea id="application-note" name="note" rows="4" placeholder="?臬‵撖怨澈隞賬?勗??摰寞?隞狡隤芣???></textarea>
          </div>
          <p class="login-note" data-application-hint></p>
        </form>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-application-submit form="application-form" type="submit">??唾?</button>
      </div>
    </div>
  </div>
`;

const applicationModalMarkupV2 = `
  <div class="modal" data-application-modal hidden>
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal-dialog auth-modal-dialog">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="application-title">?蝢賜?蝷曉??亦隢?/h2>
          <p class="modal-subtitle" data-application-subtitle>??箸鞈?嚗?蝞∠??∪祟?貉?蝣箄?隞狡敺?雿停?賢遣蝡?亙董??/p>
        </div>
        <button class="modal-close" data-close-application type="button" aria-label="???唾?閬?">
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div class="modal-body">
        <form class="form-grid" data-application-form id="application-form" novalidate>
          <input data-application-type name="applicationType" type="hidden" value="club" />
          <div class="form-field">
            <label for="application-name">憪?</label>
            <input id="application-name" name="name" placeholder="???? type="text" autocomplete="name" />
          </div>
          <div class="form-field">
            <label for="application-student-id">摮貉?</label>
            <input id="application-student-id" name="studentId" placeholder="B11303044" type="text" />
          </div>
          <div class="form-field">
            <label for="application-department">蝟餃</label>
            <input id="application-department" name="department" placeholder="璈１鈭" type="text" />
          </div>
          <div class="form-field">
            <label for="application-phone">??窗?餉店</label>
            <input id="application-phone" name="phone" placeholder="09xx-xxx-xxx" type="tel" autocomplete="tel" />
          </div>
          <div class="form-field">
            <label for="application-email">?舐窗靽∠拳</label>
            <input id="application-email" name="email" placeholder="your@email.com" type="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label for="application-note">?酉</label>
            <textarea id="application-note" name="note" rows="4" placeholder="?臬‵撖急鋆??澈隞賬?甈暹??勗?隤芣???></textarea>
          </div>
          <p class="login-note" data-application-hint></p>
        </form>
      </div>
      <div class="modal-footer">
        <button class="login-button modal-submit" data-application-submit form="application-form" type="submit">??唾?</button>
      </div>
    </div>
  </div>
`;

const getLoginButtons = () => document.querySelectorAll("[data-open-login]");
const getApplicationButtons = () => document.querySelectorAll("[data-open-application]");
const getApprovalDocId = (email) => email.trim().toLowerCase();
const normalizedBootstrapAdminEmail = bootstrapAdminEmail.trim().toLowerCase();
const academicTerms = ["銝飛??, "銝飛??, "??"];

const memberFilters = {
  year: "all",
  term: "all",
};

const adminAcademicTerms = ["銝飛??, "銝飛??];
const minAcademicYear = 115;
const customAcademicYearsStorageKey = "ntust-badminton-custom-academic-years";

const rememberLoginButtonLabels = () => {
  getLoginButtons().forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
  });
};

const updateAdminNavigation = () => {
  const existingAdminLinks = document.querySelectorAll("[data-admin-nav-link]");

  existingAdminLinks.forEach((link) => {
    link.remove();
  });

  if (!currentUserIsAdmin) {
    return;
  }

  const createAdminLink = () => {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = "./members.html";
    link.textContent = "?蝞∠?";
    link.dataset.adminNavLink = "true";
    return link;
  };

  const desktopNav = document.querySelector(".site-nav");
  if (desktopNav) {
    desktopNav.append(createAdminLink());
  }

  const mobileNavGrid = document.querySelector(".mobile-nav-grid");
  if (mobileNavGrid) {
    const mobileLoginButton = mobileNavGrid.querySelector(".login-button");
    const mobileAdminLink = createAdminLink();

    if (mobileLoginButton) {
      mobileNavGrid.insertBefore(mobileAdminLink, mobileLoginButton);
    } else {
      mobileNavGrid.append(mobileAdminLink);
    }
  }
};

const getFriendlyAuthError = (error) =>
  authErrorMessages[error.code] || "?餃瘚??箔?暺?憿?隢?敺?閰虫?甈～?;

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

  document.body.insertAdjacentHTML("beforeend", applicationModalMarkupV2);
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
  const { loginModal, loginForm, statusCard, statusEmail, statusHint, adminLink, authSubmit, authSwitch } =
    getLoginModalElements();

  if (currentUser) {
    loginModal.querySelector(".modal-title").textContent = signedInCopy.title;
    loginModal.querySelector("[data-auth-subtitle]").textContent = signedInCopy.subtitle;
    loginForm.hidden = true;
    statusCard.hidden = false;
    authSwitch.hidden = true;
    adminLink.hidden = !currentUserIsAdmin;
    statusEmail.textContent = currentUser.email || "";
    statusHint.textContent = currentUserIsAdmin ? "雿?蝞∠??∴??臭誑?脣撖拇敺?? : "雿歇?餃蝷曉?亙??;
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

const updateLoginButtons = () => {
  rememberLoginButtonLabels();
  updateAdminNavigation();

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
    setHint("隢???src/firebase-config.js 憛怠 Firebase 撠?閮剖???);
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
        await refreshMembersDashboardSafe();
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
  applicationSubtitle.textContent = "?蝢賜?蝷曉??亦隢?蝑恣?撖拇?Ⅱ隤?甈曉?嚗??撱箇??餃撣唾???;
  applicationModal.hidden = false;
  body.classList.add("modal-open");
  setApplicationHint("?敺?蝞∠??⊥??典??啁??唬??隢?);

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
  const approvalDoc = user.email ? await getDoc(getApprovalDocRef(user.email)) : null;
  const approvalData = approvalDoc?.exists() ? approvalDoc.data() : null;
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

  if (approvalData) {
    payload.name = approvalData.name || "";
    payload.applicationId = approvalData.applicationId || "";
    payload.applicationType = approvalData.applicationType || "club";
    payload.academicYear = approvalData.academicYear || "?芾身摰?;
    payload.term = approvalData.term || "?芾身摰?;
    payload.studentId = approvalData.studentId || "";
    payload.department = approvalData.department || approvalData.school || "";
    payload.phone = approvalData.phone || "";
    payload.school = approvalData.school || "";
    payload.approvedAt = approvalData.approvedAt || serverTimestamp();
  }

  await setDoc(memberRef, payload, { merge: true });
};

const isBootstrapAdminEmail = (email) => email.trim().toLowerCase() === normalizedBootstrapAdminEmail;

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
  const approvalRef = getApprovalDocRef(data.email || "");

  if (data.approved && data.paid) {
    await setDoc(
      approvalRef,
      {
        name: data.name || "",
        email: data.email || "",
        applicationId,
        applicationType: data.applicationType || "club",
        studentId: data.studentId || "",
        department: data.department || data.school || "",
        phone: data.phone || "",
        school: data.school || "",
        academicYear: data.academicYear || "?芾身摰?,
        term: data.term || "?芾身摰?,
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

const getRocAcademicYear = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear() - 1911;
  return month >= 8 ? year : year - 1;
};

const buildAcademicYearOptions = () => {
  const baseYear = getRocAcademicYear();
  return ["all", ...Array.from({ length: 6 }, (_, index) => String(baseYear + 1 - index)), "?芾身摰?];
};

const getAcademicYearLabel = (value) => {
  if (!value || value === "?芾身摰?) {
    return "?芾身摰?;
  }

  return `${value} 摮詨僑摨圳;
};

const getAcademicTermLabel = (value) => value || "?芾身摰?;

const matchesMemberFilter = (entry) => {
  const yearValue = entry.academicYear || "?芾身摰?;
  const termValue = entry.term || "?芾身摰?;

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

  yearSelect.innerHTML = buildAcademicYearOptions()
    .map((value) => {
      const label = value === "all" ? "?券摮詨僑摨? : getAcademicYearLabel(value);
      return `<option value="${value}">${label}</option>`;
    })
    .join("");

  yearSelect.value = memberFilters.year;
  termSelect.value = memberFilters.term;

  yearSelect.addEventListener("change", async (event) => {
    memberFilters.year = event.target.value;
    await refreshMembersDashboardSafe();
  });

  termSelect.addEventListener("change", async (event) => {
    memberFilters.term = event.target.value;
    await refreshMembersDashboardSafe();
  });

  yearSelect.dataset.initialized = "true";
};

const getStoredAdminAcademicYears = () => {
  try {
    const raw = window.localStorage.getItem(customAcademicYearsStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.from(
      new Set(
        parsed
          .map((value) => String(value).trim())
          .filter((value) => /^\d+$/.test(value) && Number(value) >= minAcademicYear),
      ),
    ).sort((left, right) => Number(right) - Number(left));
  } catch {
    return [];
  }
};

const saveAdminAcademicYears = (years) => {
  window.localStorage.setItem(customAcademicYearsStorageKey, JSON.stringify(years));
};

const buildAdminAcademicYearOptions = () => {
  const currentYear = Math.max(getRocAcademicYear(), minAcademicYear);
  const defaultYears = [];

  for (let year = currentYear; year >= minAcademicYear; year -= 1) {
    defaultYears.push(String(year));
  }

  return ["all", ...Array.from(new Set([...defaultYears, ...getStoredAdminAcademicYears()])).sort(
    (left, right) => Number(right) - Number(left),
  ), "?芾身摰?];
};

const getSafeAcademicYearLabel = (value) => {
  if (!value || value === "?芾身摰?) {
    return "?芾身摰?;
  }

  return `${value} 摮詨僑摨圳;
};

const getSafeAcademicTermLabel = (value) => value || "?芾身摰?;

const initCustomAcademicYearControls = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const customYearInput = document.querySelector("[data-custom-year-input]");
  const addAcademicYearButton = document.querySelector("[data-add-academic-year]");

  if (!yearSelect || !customYearInput || !addAcademicYearButton || addAcademicYearButton.dataset.initialized === "true") {
    return;
  }

  addAcademicYearButton.addEventListener("click", async () => {
    const value = String(customYearInput.value || "").trim();

    if (!/^\d+$/.test(value) || Number(value) < minAcademicYear) {
      customYearInput.focus();
      return;
    }

    const years = Array.from(new Set([...getStoredAdminAcademicYears(), value])).sort(
      (left, right) => Number(right) - Number(left),
    );

    saveAdminAcademicYears(years);
    yearSelect.innerHTML = buildAdminAcademicYearOptions()
      .map((optionValue) => {
        const label = optionValue === "all" ? "?券摮詨僑摨? : getSafeAcademicYearLabel(optionValue);
        const selected = optionValue === value ? " selected" : "";
        return `<option value="${optionValue}"${selected}>${label}</option>`;
      })
      .join("");
    memberFilters.year = value;
    customYearInput.value = "";
    await refreshMembersDashboardSafe();
  });

  addAcademicYearButton.dataset.initialized = "true";
};

const syncMemberRecordFromApplication = async (application) => {
  if (!db || !application?.email) {
    return;
  }

  const membersSnapshot = await getDocs(collection(db, "members"));
  const matchingMember = membersSnapshot.docs.find((entry) => {
    const memberEmail = String(entry.data().email || "").trim().toLowerCase();
    return memberEmail === String(application.email || "").trim().toLowerCase();
  });

  if (!matchingMember) {
    return;
  }

  await updateDoc(doc(db, "members", matchingMember.id), {
    academicYear: application.academicYear || "?芾身摰?,
    term: application.term || "?芾身摰?,
    studentId: application.studentId || "",
    department: application.department || application.school || "",
    phone: application.phone || "",
    school: application.school || "",
    updatedAt: serverTimestamp(),
  });
};

const formatTimestamp = (value) => {
  if (!value?.toDate) {
    return "撠閮?";
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
        <h3 class="content-title">?桀?瘝?敺??隢?/h3>
        <p class="content-copy">蝑?鈭粹蝷曉??冗隤脩隢?嚗ㄐ撠望??箇???/p>
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
            <p class="member-row-index">蝷曉??唾?</p>
            <p class="member-row-status">${approved && paid ? "ready" : "pending"}</p>
          </div>
          <p class="member-row-email">${application.name || "?芸‵憪?"} / ${application.studentId || "?芸‵摮貉?"}</p>
          <div class="member-row-meta">
            <span>蝟餃嚗?{application.department || application.school || "?芸‵撖?}</span>
            <span>??窗?餉店嚗?{application.phone || "?芸‵撖?}</span>
            <span>?舐窗靽∠拳嚗?{application.email || "?芸‵撖?}</span>
            <span>???嚗?{formatTimestamp(application.submittedAt)}</span>
            <span>?酉嚗?{application.note || "??}</span>
          </div>
          <div class="application-actions">
            <button class="button-secondary application-toggle" data-application-action="approve" data-application-id="${application.id}" data-approved="${approved}">
              ${approved ? "??撖拇??" : "撖拇??"}
            </button>
            <button class="button-secondary application-toggle" data-application-action="paid" data-application-id="${application.id}" data-paid="${paid}">
              ${paid ? "??隞狡摰?" : "隞狡摰?"}
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
      await syncMemberRecordFromApplication(updatedDoc.data());
      await refreshMembersDashboardSafe();
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
      <h2 class="content-title">撠摰? Firebase 閮剖?</h2>
      <p class="content-copy">隢???<code>src/firebase-config.js</code> 憛怠 Firebase 撠?鞈???/p>
    `;
    return;
  }

  if (!currentUser) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">隢??餃蝞∠???/h2>
      <p class="content-copy">??喃?閫?<code>Sign In</code> ?餃嚗???ㄐ?亦?敺祟?詨??柴?/p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">?董????恣????/h2>
      <p class="content-copy">隢 Firestore 撱箇? <code>admins/${currentUser.uid}</code> ?辣敺????唳???Ｕ?/p>
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
      <p class="member-stat-label">敺祟?貊隢?/p>
      <p class="member-stat-value">${pendingApplications.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">撌脣遣蝡董??/p>
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
          <p class="member-row-email">${member.email || "?芣?靘縑蝞?}</p>
          <div class="member-row-meta">
            <span>UID嚗?{member.uid || member.id}</span>
            <span>撱箇???嚗?{formatTimestamp(member.createdAt)}</span>
            <span>?餈?伐?${formatTimestamp(member.lastLoginAt)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  list.innerHTML = memberRows || `
    <article class="content-card is-tight">
      <h3 class="content-title">?桀????歇閮餃?撣唾?</h3>
      <p class="content-copy">蝑隢???甈曉???閮餃???敺??ㄐ撠望??箇撣唾????/p>
    </article>
  `;
};

const renderApplicationReviewList = async (applications = []) => {
  const applicationList = document.querySelector("[data-application-list]");
  if (!applicationList) {
    return;
  }

  const filteredApplications = applications.filter(matchesMemberFilter);

  if (filteredApplications.length === 0) {
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">?桀?瘝?蝚血?璇辣?隢?/h3>
        <p class="content-copy">雿隞亙??飛撟游漲?飛?祟?賂???敺?冗?∠隢??/p>
      </article>
    `;
    return;
  }

  const yearOptions = buildAdminAcademicYearOptions()
    .filter((value) => value !== "all")
    .map((value) => `<option value="${value}">${getSafeAcademicYearLabel(value)}</option>`)
    .join("");

  const termOptions = [...adminAcademicTerms, "未設定"]
    .map((value) => `<option value="${value}">${getSafeAcademicTermLabel(value)}</option>`)
    .join("");

  applicationList.innerHTML = filteredApplications
    .map((application) => {
      const approved = Boolean(application.approved);
      const paid = Boolean(application.paid);
      const academicYear = application.academicYear || String(getRocAcademicYear());
      const term = application.term || "未設定";
      const statusLabel = approved && paid ? "ready" : approved ? "awaiting payment" : "pending";

      return `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">??唾?</p>
            <p class="member-row-status">${statusLabel}</p>
          </div>
          <p class="member-row-email">${application.name || "未填姓名"} / ${application.studentId || "未填學號"}</p>
          <div class="member-row-meta">
            <span>系別：${application.department || application.school || "未填寫"}</span>
            <span>連絡電話：${application.phone || "未填寫"}</span>
            <span>聯絡信箱：${application.email || "未填寫"}</span>
            <span>送出時間：${formatTimestamp(application.submittedAt)}</span>
            <span>備註：${application.note || "無"}</span>
          </div>
          <div class="member-row-controls">
            <div class="form-field">
              <label for="application-year-${application.id}">摮詨僑摨?/label>
              <select id="application-year-${application.id}" data-application-year data-application-id="${application.id}">
                ${yearOptions.replace(`value="${academicYear}"`, `value="${academicYear}" selected`)}
              </select>
            </div>
            <div class="form-field">
              <label for="application-term-${application.id}">摮豢?</label>
              <select id="application-term-${application.id}" data-application-term data-application-id="${application.id}">
                ${termOptions.replace(`value="${term}"`, `value="${term}" selected`)}
              </select>
            </div>
          </div>
          <div class="application-actions">
            <button class="button-secondary application-toggle ${approved ? "is-active" : ""}" data-application-action="approve" data-application-id="${application.id}">
              ${approved ? "撌脣??? : "???唾?"}
            </button>
            <button class="button-secondary application-toggle ${paid ? "is-active" : ""}" data-application-action="paid" data-application-id="${application.id}">
              ${paid ? "撌脖?甈? : "蝣箄?隞狡"}
            </button>
            <button class="button-secondary application-save" data-application-action="save-meta" data-application-id="${application.id}">
              ?脣?摮豢?鞈?
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

      const yearSelect = applicationList.querySelector(`[data-application-year][data-application-id="${id}"]`);
      const termSelect = applicationList.querySelector(`[data-application-term][data-application-id="${id}"]`);
      const academicYear = yearSelect?.value || "未設定";
      const term = termSelect?.value || "未設定";
      const data = currentDoc.data();
      const nextData = {
        academicYear,
        term,
        updatedAt: serverTimestamp(),
      };

      if (action === "approve") {
        nextData.approved = !Boolean(data.approved);
      } else if (action === "paid") {
        nextData.paid = !Boolean(data.paid);
      }

      await updateDoc(applicationRef, nextData);
      const updatedDoc = await getDoc(applicationRef);
      await syncApprovalFromApplication(id, updatedDoc.data());
      await refreshMembersDashboardSafe();
    });
  });
};

const refreshMembersDashboard = async () => {
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
      <h2 class="content-title">隢?摰? Firebase 閮剖?</h2>
      <p class="content-copy">隢???<code>src/firebase-config.js</code> 憛怠甇?Ⅱ??Firebase 撠?鞈???/p>
    `;
    return;
  }

  if (!currentUser) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">隢??餃蝞∠??∪董??/h2>
      <p class="content-copy">???喃?閫?<code>Sign In</code>嚗?亙??隞交?祟?詨??啗?蝷曉???/p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">?董??銝蝞∠???/h2>
      <p class="content-copy">隢???Firestore 撱箇? <code>admins/${currentUser.uid}</code> ?辣嚗?雿輻撌脩???蝞∠??∪董??乓?/p>
    `;
    return;
  }

  gate.hidden = true;
  content.hidden = false;
  initMembersFilters();
  initCustomAcademicYearControls();
  patchMembersFilterUI();

  const membersQuery = query(collection(db, "members"), orderBy("createdAt", "desc"));
  const membersSnapshot = await getDocs(membersQuery);
  const members = membersSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

  const applicationsQuery = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
  const applicationsSnapshot = await getDocs(applicationsQuery);
  const applications = applicationsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

  const filteredMembers = members.filter(matchesMemberFilter);
  const pendingApplications = applications.filter((application) => !application.approved || !application.paid);

  summary.innerHTML = `
    <article class="member-stat">
      <p class="member-stat-label">敺祟?貊隢?/p>
      <p class="member-stat-value">${pendingApplications.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">?桀?蝭拚蝷曉</p>
      <p class="member-stat-value">${filteredMembers.length}</p>
    </article>
    <article class="member-stat">
      <p class="member-stat-label">?桀?摮豢?</p>
      <p class="member-stat-value member-stat-value-small">${memberFilters.year === "all" ? "?券摮詨僑摨? : getSafeAcademicYearLabel(memberFilters.year)}<br />${memberFilters.term === "all" ? "?券摮豢?" : getSafeAcademicTermLabel(memberFilters.term)}</p>
    </article>
  `;

  await renderApplicationReviewList(applications);

  const memberRows = filteredMembers
    .map(
      (member, index) => `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">#${String(index + 1).padStart(2, "0")}</p>
            <p class="member-row-status">${member.status || "active"}</p>
          </div>
          <p class="member-row-email">${member.email || "?芸‵靽∠拳"}</p>
          <div class="member-row-meta">
            <span>UID嚗?{member.uid || member.id}</span>
            <span>摮詨僑摨佗?${getSafeAcademicYearLabel(member.academicYear || "?芾身摰?)}</span>
            <span>摮豢?嚗?{getSafeAcademicTermLabel(member.term)}</span>
            <span>摮豢 / ?桐?嚗?{member.school || "?芸‵撖?}</span>
            <span>撱箇???嚗?{formatTimestamp(member.createdAt)}</span>
            <span>?餈?伐?${formatTimestamp(member.lastLoginAt)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  list.innerHTML =
    memberRows ||
    `
      <article class="content-card is-tight">
        <h3 class="content-title">?祟?訾????冗??/h3>
        <p class="content-copy">?臭誑???飛撟游漲?飛????蝷曉摰?撖拇??甈曇?閮餃?敺????亦???/p>
      </article>
    `;
};

const patchMembersFilterUI = () => {
  const yearSelect = document.querySelector("[data-filter-year]");
  const termSelect = document.querySelector("[data-filter-term]");

  if (yearSelect) {
    yearSelect.innerHTML = buildAdminAcademicYearOptions()
      .map((value) => {
        const label = value === "all" ? "?券摮詨僑摨? : getSafeAcademicYearLabel(value);
        const selected = value === memberFilters.year ? " selected" : "";
        return `<option value="${value}"${selected}>${label}</option>`;
      })
      .join("");
  }

  if (termSelect) {
    termSelect.innerHTML = ["all", ...adminAcademicTerms, "?芾身摰?]
      .map((value) => {
        const label = value === "all" ? "?券摮豢?" : getSafeAcademicTermLabel(value);
        const selected = value === memberFilters.term ? " selected" : "";
        return `<option value="${value}"${selected}>${label}</option>`;
      })
      .join("");
  }
};

const renderApplicationReviewListSafe = async (applications = []) => {
  const applicationList = document.querySelector("[data-application-list]");
  if (!applicationList) {
    return;
  }

  const filteredApplications = applications.filter(matchesMemberFilter);

  if (filteredApplications.length === 0) {
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">?桀?瘝?蝚血?璇辣?隢?/h3>
        <p class="content-copy">隢Ⅱ隤祟?豢?隞塚???瑼Ｘ Firestore ??applications ???臬撌脫??啗???/p>
      </article>
    `;
    return;
  }

  const yearOptions = buildAdminAcademicYearOptions()
    .filter((value) => value !== "all")
    .map((value) => `<option value="${value}">${getSafeAcademicYearLabel(value)}</option>`)
    .join("");

  const termOptions = [...adminAcademicTerms, "?芾身摰?]
    .map((value) => `<option value="${value}">${getSafeAcademicTermLabel(value)}</option>`)
    .join("");

  applicationList.innerHTML = filteredApplications
    .map((application) => {
      const approved = Boolean(application.approved);
      const paid = Boolean(application.paid);
      const academicYear = application.academicYear || String(Math.max(getRocAcademicYear(), minAcademicYear));
      const term = application.term || "?芾身摰?;
      const statusLabel = approved && paid ? "ready" : approved ? "awaiting payment" : "pending";

      return `
        <article class="member-row">
          <div class="member-row-top">
            <p class="member-row-index">??唾?</p>
            <p class="member-row-status">${statusLabel}</p>
          </div>
          <p class="member-row-email">${application.name || "?芸‵憪?"} / ${application.email || "?芸‵靽∠拳"}</p>
          <div class="member-row-meta">
            <span>摮豢 / ?桐?嚗?{application.school || "?芸‵撖?}</span>
            <span>???嚗?{formatTimestamp(application.submittedAt)}</span>
            <span>?酉嚗?{application.note || "??}</span>
          </div>
          <div class="member-row-controls">
            <div class="form-field">
              <label for="safe-application-year-${application.id}">學年度</label>
              <select id="safe-application-year-${application.id}" data-application-year data-application-id="${application.id}">
                ${yearOptions.replace(`value="${academicYear}"`, `value="${academicYear}" selected`)}
              </select>
            </div>
            <div class="form-field">
              <label for="safe-application-term-${application.id}">學期</label>
              <select id="safe-application-term-${application.id}" data-application-term data-application-id="${application.id}">
                ${termOptions.replace(`value="${term}"`, `value="${term}" selected`)}
              </select>
            </div>
          </div>
          <div class="application-actions">
            <button class="button-secondary application-toggle ${approved ? "is-active" : ""}" data-application-action="approve" data-application-id="${application.id}">
              ${approved ? "已同意" : "同意申請"}
            </button>
            <button class="button-secondary application-toggle ${paid ? "is-active" : ""}" data-application-action="paid" data-application-id="${application.id}">
              ${paid ? "已付款" : "確認付款"}
            </button>
            <button class="button-secondary application-save" data-application-action="save-meta" data-application-id="${application.id}">
              儲存學期資料
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

      const yearSelect = applicationList.querySelector(`[data-application-year][data-application-id="${id}"]`);
      const termSelect = applicationList.querySelector(`[data-application-term][data-application-id="${id}"]`);
      const academicYear = yearSelect?.value || "?芾身摰?;
      const term = termSelect?.value || "?芾身摰?;
      const data = currentDoc.data();
      const nextData = {
        academicYear,
        term,
        updatedAt: serverTimestamp(),
      };

      if (action === "approve") {
        nextData.approved = !Boolean(data.approved);
      } else if (action === "paid") {
        nextData.paid = !Boolean(data.paid);
      }

      await updateDoc(applicationRef, nextData);
      const updatedDoc = await getDoc(applicationRef);
      await syncApprovalFromApplication(id, updatedDoc.data());
      await syncMemberRecordFromApplication(updatedDoc.data());
      await refreshMembersDashboardSafe();
    });
  });
};

const refreshMembersDashboardSafe = async () => {
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
      <h2 class="content-title">隢?摰? Firebase 閮剖?</h2>
      <p class="content-copy">隢???<code>src/firebase-config.js</code> 憛怠甇?Ⅱ??Firebase 撠?鞈???/p>
    `;
    return;
  }

  if (!currentUser) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">隢??餃蝞∠??∪董??/h2>
      <p class="content-copy">???喃?閫?<code>Sign In</code>嚗?亙??隞交?祟?詨??啗?蝷曉???/p>
    `;
    return;
  }

  if (!currentUserIsAdmin) {
    gate.hidden = false;
    content.hidden = true;
    gate.innerHTML = `
      <h2 class="content-title">?董??銝蝞∠???/h2>
      <p class="content-copy">隢Ⅱ隤?Firestore 鋆∪???<code>admins/${currentUser.uid}</code> ?遢?辣??/p>
    `;
    return;
  }

  gate.hidden = true;
  content.hidden = false;
  initMembersFilters();
  initCustomAcademicYearControls();
  patchMembersFilterUI();

  try {
    const membersQuery = query(collection(db, "members"), orderBy("createdAt", "desc"));
    const membersSnapshot = await getDocs(membersQuery);
    const members = membersSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

    const applicationsQuery = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
    const applicationsSnapshot = await getDocs(applicationsQuery);
    const applications = applicationsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

    const filteredMembers = members.filter(matchesMemberFilter);
    const pendingApplications = applications.filter((application) => !application.approved || !application.paid);

    summary.innerHTML = `
      <article class="member-stat">
        <p class="member-stat-label">敺祟?貊隢?/p>
        <p class="member-stat-value">${pendingApplications.length}</p>
      </article>
      <article class="member-stat">
        <p class="member-stat-label">?桀?蝭拚蝷曉</p>
        <p class="member-stat-value">${filteredMembers.length}</p>
      </article>
      <article class="member-stat">
        <p class="member-stat-label">?桀?摮豢?</p>
        <p class="member-stat-value member-stat-value-small">${memberFilters.year === "all" ? "?券摮詨僑摨? : getSafeAcademicYearLabel(memberFilters.year)}<br />${memberFilters.term === "all" ? "?券摮豢?" : getSafeAcademicTermLabel(memberFilters.term)}</p>
      </article>
    `;

    await renderApplicationReviewListSafe(applications);

    const memberRows = filteredMembers
      .map(
        (member, index) => `
          <article class="member-row">
            <div class="member-row-top">
              <p class="member-row-index">#${String(index + 1).padStart(2, "0")}</p>
              <p class="member-row-status">${member.status || "active"}</p>
            </div>
            <p class="member-row-email">${member.name || "未填姓名"} / ${member.studentId || "未填學號"}</p>
            <div class="member-row-meta">
              <span>UID嚗?{member.uid || member.id}</span>
              <span>摮詨僑摨佗?${getSafeAcademicYearLabel(member.academicYear || "?芾身摰?)}</span>
              <span>摮豢?嚗?{getSafeAcademicTermLabel(member.term)}</span>
              <span>系別：${member.department || member.school || "未填寫"}</span>
              <span>連絡電話：${member.phone || "未填寫"}</span>
              <span>聯絡信箱：${member.email || "未填寫"}</span>
              <span>撱箇???嚗?{formatTimestamp(member.createdAt)}</span>
              <span>?餈?伐?${formatTimestamp(member.lastLoginAt)}</span>
            </div>
          </article>
        `,
      )
      .join("");

    list.innerHTML =
      memberRows ||
      `
        <article class="content-card is-tight">
          <h3 class="content-title">?祟?訾????冗??/h3>
          <p class="content-copy">?臭誑???飛撟游漲?飛????蝷曉摰?撖拇??甈曇?閮餃?敺????亦???/p>
        </article>
      `;
  } catch (error) {
    summary.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">敺霈?仃??/h3>
        <p class="content-copy">隢Ⅱ隤?Firestore rules 撌脩撣?銝?恣?撣唾???applications ??members ??????/p>
      </article>
    `;
    applicationList.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">?⊥?頛?唾?鞈?</h3>
        <p class="content-copy">${error?.message || "霈??applications ??隤扎?}</p>
      </article>
    `;
    list.innerHTML = `
      <article class="content-card is-tight">
        <h3 class="content-title">?⊥?頛蝷曉鞈?</h3>
        <p class="content-copy">${error?.message || "霈??members ??隤扎?}</p>
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
    setHint("Firebase 撠閮剖?摰????‵撖?src/firebase-config.js??, "error");
    return;
  }

  if (!email.includes("@")) {
    setHint("隢撓?交迤蝣箇?靽∠拳??, "error");
    return;
  }

  if (password.length < 8) {
    setHint("撖Ⅳ?喳??閬?8 蝣潦?, "error");
    return;
  }

  if (authMode === "signup" && password !== passwordConfirm) {
    setHint("?拇活頛詨??蝣潔?銝?氬?, "error");
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
        setHint("?縑蝞勗??芸??祟?豢?隞狡嚗???勗???唾???, "error");
        return;
      }

      const credential = await createUserWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signup");
      await ensureBootstrapAdminDoc(credential.user);
      await loadAdminStatus(credential.user);
      setHint("撣唾?撱箇?摰?嚗歇?芸??餃??, "success");
    } else {
      const credential = await signInWithEmailAndPassword(readyAuth, email, password);
      await syncMemberProfile(credential.user, "signin");
      await loadAdminStatus(credential.user);
      setHint("?餃????, "success");
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

  submitButton.disabled = true;

  try {
    await ensureAuthReady();

    await addDoc(collection(db, "applications"), {
      name,
      studentId,
      department,
      phone,
      email,
      school: department,
      note,
      applicationType,
      academicYear: String(Math.max(getRocAcademicYear(), minAcademicYear)),
      term: "未設定",
      approved: false,
      paid: false,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    applicationForm.reset();
    setApplicationHint("申請已送出。等管理員審核並確認付款後，你就能建立登入帳號。", "success");
  } catch (error) {
    applicationHint.textContent = "送出申請時發生問題，請稍後再試一次。";
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
    setHint("雿歇?餃??);
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
    setHint("?ㄐ撌脩??亙末 Firebase 瘚?嚗?銝甇亙閬‵?亥身摰停?賢??具?);
  }

  if (pageName === "members") {
    await refreshMembersDashboardSafe();
  }
};

init();

