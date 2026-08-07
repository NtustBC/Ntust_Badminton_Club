const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const crypto = require("crypto");

admin.initializeApp();

const REGION = "asia-east1";
const BOOTSTRAP_ADMIN_EMAIL = "admin@gmail.com";
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTRATION_CODE_COOLDOWN_MS = 60 * 1000;
const REGISTRATION_CODE_MAX_ATTEMPTS = 5;

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashRegistrationCode(salt, code) {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function validateRegistrationProfile(profile = {}) {
  const result = {
    name: String(profile.name || "").trim(),
    studentId: String(profile.studentId || "").trim().toUpperCase(),
    department: String(profile.department || "").trim(),
    phone: String(profile.phone || "").trim(),
    membershipIntent: profile.membershipIntent === "join" ? "join" : "not_join",
    paymentMethod: String(profile.paymentMethod || "none"),
    cashPaymentSlot: String(profile.cashPaymentSlot || ""),
    transferAt: String(profile.transferAt || ""),
    transferLastFive: String(profile.transferLastFive || ""),
  };
  if (!result.name || !result.studentId || !result.department || !result.phone) {
    throw new HttpsError("invalid-argument", "請完整填寫姓名、學號、系別與聯絡電話。");
  }
  if (result.name.length > 100 || result.studentId.length > 30 || result.department.length > 100 || result.phone.length > 30) {
    throw new HttpsError("invalid-argument", "個人資料欄位長度超過限制。");
  }
  return result;
}

exports.requestRegistrationCode = onCall({ region: REGION }, async (request) => {
  const email = normalizedEmail(request.data?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpsError("invalid-argument", "請輸入有效的電子郵件信箱。");
  }
  try {
    await admin.auth().getUserByEmail(email);
    throw new HttpsError("already-exists", "這個 Email 已經註冊過了，請直接登入。");
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error?.code !== "auth/user-not-found") throw new HttpsError("internal", "暫時無法驗證信箱。");
  }

  const key = crypto.createHash("sha256").update(email).digest("hex");
  const ref = admin.firestore().collection("registrationVerifications").doc(key);
  const existing = await ref.get();
  const now = Date.now();
  if (existing.exists && now - Number(existing.data().lastSentAtMs || 0) < REGISTRATION_CODE_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "請稍候 1 分鐘再重新產生驗證碼。");
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  await ref.set({ email, salt, codeHash: hashRegistrationCode(salt, code), expiresAtMs: now + REGISTRATION_CODE_TTL_MS, lastSentAtMs: now, attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true, code, expiresInSeconds: REGISTRATION_CODE_TTL_MS / 1000 };
});

exports.completeVerifiedRegistration = onCall({ region: REGION }, async (request) => {
  const email = normalizedEmail(request.data?.email);
  const password = String(request.data?.password || "");
  const code = String(request.data?.verificationCode || "").trim();
  const privacyConsent = request.data?.privacyConsent === true;
  const profile = validateRegistrationProfile(request.data?.profile);
  if (!privacyConsent) throw new HttpsError("failed-precondition", "必須同意個人資料蒐集說明才能註冊。");
  if (password.length < 8 || password.length > 128 || !/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "密碼或驗證碼格式不正確。");

  const key = crypto.createHash("sha256").update(email).digest("hex");
  const ref = admin.firestore().collection("registrationVerifications").doc(key);
  const verification = await ref.get();
  const data = verification.exists ? verification.data() : {};
  if (!verification.exists || Date.now() > Number(data.expiresAtMs || 0) || data.email !== email) throw new HttpsError("deadline-exceeded", "驗證碼已失效，請重新產生。");
  if (Number(data.attempts || 0) >= REGISTRATION_CODE_MAX_ATTEMPTS) throw new HttpsError("resource-exhausted", "驗證次數過多，請重新產生驗證碼。");
  if (hashRegistrationCode(data.salt, code) !== data.codeHash) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("permission-denied", "驗證碼不正確。");
  }

  let user;
  try {
    user = await admin.auth().createUser({ email, password, emailVerified: true, displayName: profile.name });
    const membershipStatus = profile.membershipIntent === "join" ? "pending_payment" : "not_applied";
    await admin.firestore().collection("members").doc(user.uid).set({
      uid: user.uid, email, ...profile, school: profile.department,
      membershipStatus, status: membershipStatus, paymentStatus: "unpaid",
      notificationPreferences: { announcements: true, classReminders: true, registrationUpdates: true },
      privacyConsent: { version: "2026-08-07", accepted: true, acceptedAt: admin.firestore.FieldValue.serverTimestamp() },
      source: "verified_signup", createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await ref.delete();
    return { ok: true };
  } catch (error) {
    if (user?.uid) await admin.auth().deleteUser(user.uid).catch(() => {});
    if (error?.code === "auth/email-already-exists") throw new HttpsError("already-exists", "這個 Email 已經註冊過了。");
    logger.error("Verified registration failed.", { error: error?.message || String(error) });
    throw new HttpsError("internal", "建立帳號失敗，請稍後再試。");
  }
});

function normalizeIdentityText(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeStudentId(value) {
  return String(value || "").trim().replace(/[\s-]+/g, "").toUpperCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseClubDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return Number.NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text) ? `${text}+08:00` : text);
}

async function consumePasswordResetAttempt(email) {
  const key = crypto.createHash("sha256").update(email).digest("hex");
  const ref = admin.firestore().collection("passwordResetRateLimits").doc(key);
  const now = Date.now();

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const windowStartedAtMs = Number(data.windowStartedAtMs || 0);
    const inCurrentWindow = now - windowStartedAtMs < PASSWORD_RESET_WINDOW_MS;
    const attempts = inCurrentWindow ? Number(data.attempts || 0) : 0;

    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "嘗試次數過多，請一小時後再試。");
    }

    transaction.set(
      ref,
      {
        attempts: attempts + 1,
        windowStartedAtMs: inCurrentWindow ? windowStartedAtMs : now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

exports.requestVerifiedPasswordReset = onCall({ region: REGION }, async () => {
  throw new HttpsError("failed-precondition", "目前未啟用自動密碼重設，請聯絡社團幹部協助處理。");
});
exports.deleteMemberAccount = onCall({ region: REGION }, async (request) => {
  const callerUid = request.auth?.uid;
  const callerEmail = String(request.auth?.token?.email || "").trim().toLowerCase();
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "請先登入管理員帳號。");
  }

  const callerIsBootstrapAdmin = callerEmail === BOOTSTRAP_ADMIN_EMAIL;
  const callerAdminSnapshot = callerIsBootstrapAdmin
    ? null
    : await admin.firestore().collection("admins").doc(callerUid).get();
  if (!callerIsBootstrapAdmin && !callerAdminSnapshot?.exists) {
    throw new HttpsError("permission-denied", "只有管理員可以刪除帳號。");
  }

  const uid = String(request.data?.uid || "").trim();
  const requestedEmail = String(request.data?.email || "").trim().toLowerCase();
  if (!uid || !requestedEmail) {
    throw new HttpsError("invalid-argument", "缺少要刪除的帳號資料。");
  }
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "不能刪除目前登入中的管理員帳號。");
  }

  let targetEmail = requestedEmail;
  try {
    const targetUser = await admin.auth().getUser(uid);
    targetEmail = String(targetUser.email || "").trim().toLowerCase();
    if (!targetEmail || targetEmail !== requestedEmail) {
      throw new HttpsError("failed-precondition", "Authentication 帳號與社員資料不一致，已停止刪除。");
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error?.code !== "auth/user-not-found") {
      logger.error("Failed to load target Authentication account.", { uid, error: error?.message || String(error) });
      throw new HttpsError("internal", "無法讀取 Authentication 帳號。");
    }
  }

  if (targetEmail === BOOTSTRAP_ADMIN_EMAIL) {
    throw new HttpsError("failed-precondition", "系統管理員帳號不能刪除。");
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      logger.error("Failed to delete Authentication account.", { uid, error: error?.message || String(error) });
      throw new HttpsError("internal", "Authentication 帳號刪除失敗。");
    }
  }

  const firestore = admin.firestore();
  const [applicationsSnapshot, signupsSnapshot] = await Promise.all([
    firestore.collection("applications").where("email", "==", targetEmail).get(),
    firestore.collection("classSessionSignups").where("userId", "==", uid).get(),
  ]);
  const writer = firestore.bulkWriter();
  writer.delete(firestore.collection("members").doc(uid));
  writer.delete(firestore.collection("admins").doc(uid));
  writer.delete(firestore.collection("signupApprovals").doc(targetEmail));
  writer.delete(
    firestore.collection("passwordResetRateLimits").doc(crypto.createHash("sha256").update(targetEmail).digest("hex")),
  );
  applicationsSnapshot.docs.forEach((snapshot) => writer.delete(snapshot.ref));
  signupsSnapshot.docs.forEach((snapshot) => writer.delete(snapshot.ref));
  await writer.close();

  logger.info("Member Authentication account deleted by administrator.", {
    callerUid,
    deletedUid: uid,
    deletedEmail: targetEmail,
  });
  return { ok: true, uid, email: targetEmail };
});

async function getSessionSignupSeedCount(sessionId) {
  const snapshot = await admin.firestore().collection("classSessionSignups").where("sessionId", "==", sessionId).count().get();
  return Number(snapshot.data().count || 0);
}

exports.upsertClassSessionSignup = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "請先登入後再報名。");
  const sessionId = String(request.data?.sessionId || "").trim();
  const note = String(request.data?.note || "").trim().slice(0, 500);
  if (!sessionId) throw new HttpsError("invalid-argument", "缺少社課場次。");

  const firestore = admin.firestore();
  const sessionRef = firestore.collection("classSessions").doc(sessionId);
  const memberRef = firestore.collection("members").doc(uid);
  const signupRef = firestore.collection("classSessionSignups").doc(`${sessionId}-${uid}`);
  const statsRef = firestore.collection("classSessionStats").doc(sessionId);
  const [sessionSnapshot, memberSnapshot, statsSnapshot] = await Promise.all([sessionRef.get(), memberRef.get(), statsRef.get()]);
  if (!sessionSnapshot.exists) throw new HttpsError("not-found", "找不到這場社課。");
  if (!memberSnapshot.exists) throw new HttpsError("failed-precondition", "請先完成個人資料。");
  const session = sessionSnapshot.data();
  const member = memberSnapshot.data();
  const isAdmin = normalizedEmail(request.auth.token?.email) === BOOTSTRAP_ADMIN_EMAIL || (await firestore.collection("admins").doc(uid).get()).exists;
  const isFormalMember = member.membershipStatus === "formal_member" || member.status === "formal_member";
  if (!isAdmin && !isFormalMember && session.allowNonMembers !== true) throw new HttpsError("permission-denied", "本場社課僅限正式社員報名。");
  if (session.signupRequired !== true) throw new HttpsError("failed-precondition", "這場社課不需要報名。");
  const now = Date.now();
  const openAt = parseClubDateTime(session.signupOpenAt);
  const closeAt = parseClubDateTime(session.signupCloseAt);
  if ((Number.isFinite(openAt) && now < openAt) || (Number.isFinite(closeAt) && now > closeAt)) throw new HttpsError("failed-precondition", "目前不在報名期間內。");

  const seedCount = statsSnapshot.exists ? Number(statsSnapshot.data().signupCount || 0) : await getSessionSignupSeedCount(sessionId);
  await firestore.runTransaction(async (transaction) => {
    const [existingSignup, currentStats] = await Promise.all([transaction.get(signupRef), transaction.get(statsRef)]);
    const count = currentStats.exists ? Number(currentStats.data().signupCount || 0) : seedCount;
    const limit = Number(session.signupLimit || 0);
    if (!existingSignup.exists && limit > 0 && count >= limit) throw new HttpsError("resource-exhausted", "這場社課已額滿。");
    transaction.set(signupRef, {
      sessionId, userId: uid, email: request.auth.token?.email || "", name: member.name || "", studentId: member.studentId || "", note,
      membershipStatusAtSignup: isFormalMember ? "formal_member" : String(member.membershipStatus || "non_member"),
      isFormalMemberAtSignup: isFormalMember, dropInPaymentStatus: isFormalMember ? "not_required" : existingSignup.data()?.dropInPaymentStatus || "unpaid",
      sessionDate: session.date || "", sessionWeekday: session.weekday || "", sessionTitle: session.title || "", sessionTimeLabel: session.timeLabel || "",
      createdAt: existingSignup.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(statsRef, { sessionId, signupCount: existingSignup.exists ? count : count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

exports.deleteClassSessionSignup = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "請先登入。");
  const sessionId = String(request.data?.sessionId || "").trim();
  const firestore = admin.firestore();
  const signupRef = firestore.collection("classSessionSignups").doc(`${sessionId}-${uid}`);
  const statsRef = firestore.collection("classSessionStats").doc(sessionId);
  await firestore.runTransaction(async (transaction) => {
    const [signup, stats] = await Promise.all([transaction.get(signupRef), transaction.get(statsRef)]);
    if (!signup.exists) return;
    transaction.delete(signupRef);
    transaction.set(statsRef, { sessionId, signupCount: Math.max(0, Number(stats.data()?.signupCount || 1) - 1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

exports.syncClassSessionStats = onDocumentWritten({ document: "classSessionSignups/{signupId}", region: REGION }, async (event) => {
  const sessionId = String(event.data.after.data()?.sessionId || event.data.before.data()?.sessionId || "");
  if (!sessionId) return;
  const firestore = admin.firestore();
  const count = await getSessionSignupSeedCount(sessionId);
  await firestore.collection("classSessionStats").doc(sessionId).set({ sessionId, signupCount: count, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
});
