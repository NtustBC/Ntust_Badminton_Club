const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const crypto = require("crypto");

admin.initializeApp();

const REGION = "asia-east1";
const CALLABLE_OPTIONS = { region: REGION, enforceAppCheck: true };
const CLASS_SIGNUP_CALLABLE_OPTIONS = { region: REGION, enforceAppCheck: false };
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const LEGACY_NON_MEMBER_SIGNUP_DELAY_MS = 2 * 24 * 60 * 60 * 1000;
const CURRENT_TERM_SETTINGS_DOC = "currentTerm";

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hasFormalMembership(member = {}, approvalExists = false) {
  const status = String(member.membershipStatus || member.status || "").trim().toLowerCase();
  return approvalExists || member.paymentStatus === "paid" || ["formal_member", "formal", "approved", "member"].includes(status);
}

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

function membershipPeriodId(academicYear, term) {
  return `${String(academicYear || "").trim()}-${String(term || "").trim()}`;
}

function occupiesMembershipSlot(member = {}, academicYear = "", term = "") {
  const status = String(member.membershipStatus || member.status || "").trim().toLowerCase();
  const intent = String(member.membershipIntent || "").trim().toLowerCase();
  return String(member.academicYear || "").trim() === academicYear
    && String(member.term || "").trim() === term
    && (intent === "join" || ["pending_payment", "formal_member", "formal", "approved", "member"].includes(status));
}

function normalizeMembershipPayment(data = {}, membershipIntent = "not_join") {
  if (membershipIntent !== "join") {
    return { paymentMethod: "none", cashPaymentSlot: "", transferAt: "", transferLastFive: "" };
  }
  const paymentMethod = String(data.paymentMethod || "later").trim();
  if (!["cash", "transfer", "later"].includes(paymentMethod)) {
    throw new HttpsError("invalid-argument", "請選擇有效的社費繳費方式。");
  }
  const cashPaymentSlot = paymentMethod === "cash" ? String(data.cashPaymentSlot || "").trim().slice(0, 50) : "";
  const transferAt = paymentMethod === "transfer" ? String(data.transferAt || "").trim().slice(0, 40) : "";
  const transferLastFive = paymentMethod === "transfer" ? String(data.transferLastFive || "").trim() : "";
  if (paymentMethod === "cash" && !cashPaymentSlot) {
    throw new HttpsError("invalid-argument", "請選擇預計現金繳費場合。");
  }
  if (paymentMethod === "transfer" && (!transferAt || !/^\d{5}$/.test(transferLastFive))) {
    throw new HttpsError("invalid-argument", "請填寫轉帳時間與轉出帳號末五碼。");
  }
  return { paymentMethod, cashPaymentSlot, transferAt, transferLastFive };
}

async function releaseMembershipRegistrationSlot(firestore, member = {}) {
  const settingsSnapshot = await firestore.collection("siteSettings").doc(CURRENT_TERM_SETTINGS_DOC).get();
  const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
  const academicYear = String(settings.academicYear || "").trim();
  const term = String(settings.term || "").trim();
  if (!occupiesMembershipSlot(member, academicYear, term)) return;
  const statsRef = firestore.collection("membershipRegistrationStats").doc(membershipPeriodId(academicYear, term));
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(statsRef);
    if (!snapshot.exists) return;
    transaction.set(statsRef, {
      count: Math.max(0, Number(snapshot.data().count || 0) - 1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
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

exports.requestVerifiedPasswordReset = onCall(CALLABLE_OPTIONS, async () => {
  throw new HttpsError("failed-precondition", "目前未啟用自動密碼重設，請聯絡社團幹部協助處理。");
});
exports.deleteMemberAccount = onCall(CALLABLE_OPTIONS, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "請先登入管理員帳號。");
  }

  const callerAdminSnapshot = await admin.firestore().collection("admins").doc(callerUid).get();
  if (!callerAdminSnapshot.exists) {
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

  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      logger.error("Failed to delete Authentication account.", { uid, error: error?.message || String(error) });
      throw new HttpsError("internal", "Authentication 帳號刪除失敗。");
    }
  }

  const firestore = admin.firestore();
  const [memberSnapshot, applicationsSnapshot, signupsSnapshot] = await Promise.all([
    firestore.collection("members").doc(uid).get(),
    firestore.collection("applications").where("email", "==", targetEmail).get(),
    firestore.collection("classSessionSignups").where("userId", "==", uid).get(),
  ]);
  await releaseMembershipRegistrationSlot(firestore, memberSnapshot.exists ? memberSnapshot.data() : {});
  const writer = firestore.bulkWriter();
  writer.delete(firestore.collection("members").doc(uid));
  writer.delete(firestore.collection("admins").doc(uid));
  writer.delete(firestore.collection("signupApprovals").doc(targetEmail));
  writer.delete(
    firestore.collection("passwordResetRateLimits").doc(crypto.createHash("sha256").update(targetEmail).digest("hex")),
  );
  applicationsSnapshot.docs.forEach((snapshot) => writer.delete(snapshot.ref));
  signupsSnapshot.docs.forEach((snapshot) => {
    writer.delete(snapshot.ref);
    writer.delete(firestore.collection("classPublicRosters").doc(snapshot.id));
  });
  await writer.close();

  logger.info("Member Authentication account deleted by administrator.", {
    callerUid,
    deletedUid: uid,
    deletedEmail: targetEmail,
  });
  return { ok: true, uid, email: targetEmail };
});

exports.deleteOwnAccount = onCall(CLASS_SIGNUP_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  const email = normalizedEmail(request.auth?.token?.email);
  if (!uid || !email) {
    throw new HttpsError("unauthenticated", "請先登入後再刪除帳號。");
  }

  const firestore = admin.firestore();
  const [adminSnapshot, memberSnapshot, applicationsSnapshot, signupsSnapshot] = await Promise.all([
    firestore.collection("admins").doc(uid).get(),
    firestore.collection("members").doc(uid).get(),
    firestore.collection("applications").where("email", "==", email).get(),
    firestore.collection("classSessionSignups").where("userId", "==", uid).get(),
  ]);
  if (adminSnapshot.exists) {
    throw new HttpsError("failed-precondition", "管理員帳號不可從前台自行刪除，請先移交管理權限。");
  }

  const member = memberSnapshot.exists ? memberSnapshot.data() : {};
  const name = String(member.displayName || member.name || "未提供姓名").trim().slice(0, 100);

  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      logger.error("Failed to delete own Authentication account.", { uid, error: error?.message || String(error) });
      throw new HttpsError("internal", "Authentication 帳號刪除失敗，請稍後再試。");
    }
  }

  await releaseMembershipRegistrationSlot(firestore, member);
  const writer = firestore.bulkWriter();
  writer.delete(firestore.collection("members").doc(uid));
  writer.delete(firestore.collection("signupApprovals").doc(email));
  writer.delete(firestore.collection("passwordResetRateLimits").doc(crypto.createHash("sha256").update(email).digest("hex")));
  applicationsSnapshot.docs.forEach((snapshot) => writer.delete(snapshot.ref));
  signupsSnapshot.docs.forEach((snapshot) => writer.delete(snapshot.ref));
  writer.set(firestore.collection("adminNotifications").doc(), {
    type: "account_deleted",
    title: "使用者已刪除帳號",
    message: `${name}（${email}）已自行刪除網站帳號。`,
    userId: uid,
    email,
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await writer.close();

  logger.info("Member deleted own account.", { uid, email });
  return { ok: true };
});

exports.updateMembershipApplication = onCall(CLASS_SIGNUP_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "請先登入後再申請社員資格。");

  const membershipIntent = String(request.data?.membershipIntent || "not_join").trim();
  if (!["join", "not_join"].includes(membershipIntent)) {
    throw new HttpsError("invalid-argument", "社員申請選項不正確。");
  }
  const payment = normalizeMembershipPayment(request.data, membershipIntent);
  const firestore = admin.firestore();
  const settingsRef = firestore.collection("siteSettings").doc(CURRENT_TERM_SETTINGS_DOC);
  const memberRef = firestore.collection("members").doc(uid);
  const applicationRef = firestore.collection("applications").doc(`club-${uid}`);

  return firestore.runTransaction(async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    const memberSnapshot = await transaction.get(memberRef);
    const applicationSnapshot = await transaction.get(applicationRef);
    if (!memberSnapshot.exists) {
      throw new HttpsError("failed-precondition", "社員基本資料尚未建立，請重新登入後再試。");
    }

    const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    const academicYear = String(settings.academicYear || "").trim();
    const term = String(settings.term || "").trim();
    if (!/^\d{2,3}$/.test(academicYear) || !["上學期", "下學期"].includes(term)) {
      throw new HttpsError("failed-precondition", "管理員尚未設定目前學期。");
    }

    const registration = settings.membershipRegistration || {};
    const openAt = parseClubDateTime(registration.openAt);
    const closeAt = parseClubDateTime(registration.closeAt);
    const limit = Math.max(0, Math.floor(Number(registration.limit || 0)));
    const periodId = membershipPeriodId(academicYear, term);
    const statsRef = firestore.collection("membershipRegistrationStats").doc(periodId);
    const statsSnapshot = await transaction.get(statsRef);
    let memberSnapshots = null;
    if (!statsSnapshot.exists) {
      memberSnapshots = await transaction.get(firestore.collection("members"));
    }

    const member = memberSnapshot.data();
    const alreadyOccupiesSlot = occupiesMembershipSlot(member, academicYear, term);
    let count = statsSnapshot.exists
      ? Math.max(0, Number(statsSnapshot.data().count || 0))
      : memberSnapshots.docs.filter((snapshot) => occupiesMembershipSlot(snapshot.data(), academicYear, term)).length;

    if (membershipIntent === "join" && !alreadyOccupiesSlot) {
      const now = Date.now();
      if (!Number.isFinite(openAt) || !Number.isFinite(closeAt) || openAt >= closeAt) {
        throw new HttpsError("failed-precondition", "管理員尚未設定社員申請期間。");
      }
      if (now < openAt) {
        throw new HttpsError("failed-precondition", "社員申請尚未開放。");
      }
      if (now > closeAt) {
        throw new HttpsError("deadline-exceeded", "本學期社員申請已截止。");
      }
      if (limit <= 0) {
        throw new HttpsError("failed-precondition", "管理員尚未設定社員名額。");
      }
      if (count >= limit) {
        throw new HttpsError("resource-exhausted", "本學期社員名額已滿。");
      }
      count += 1;
    } else if (membershipIntent === "not_join" && alreadyOccupiesSlot) {
      count = Math.max(0, count - 1);
    }

    const nextStatus = membershipIntent === "join" ? "pending_payment" : "not_applied";
    transaction.set(memberRef, {
      membershipIntent,
      membershipStatus: nextStatus,
      status: nextStatus,
      paymentStatus: "unpaid",
      ...payment,
      academicYear,
      term,
      paymentSubmittedAt: membershipIntent === "join" ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (membershipIntent === "join") {
      transaction.set(applicationRef, {
        name: String(member.name || member.displayName || "").slice(0, 100),
        studentId: String(member.studentId || "").slice(0, 30),
        department: String(member.department || "").slice(0, 100),
        school: String(member.school || "").slice(0, 100),
        phone: String(member.phone || "").slice(0, 30),
        email: request.auth.token?.email || member.email || "",
        note: String(applicationSnapshot.data()?.note || "").slice(0, 1000),
        applicationType: "club",
        academicYear,
        term,
        approved: false,
        reviewStatus: "pending",
        submittedAt: applicationSnapshot.data()?.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else if (applicationSnapshot.exists) {
      transaction.delete(applicationRef);
    }
    transaction.set(statsRef, {
      academicYear,
      term,
      count,
      limit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true, membershipIntent, membershipStatus: nextStatus, count, limit };
  });
});

async function getSessionSignupSeedCount(sessionId) {
  const snapshot = await admin.firestore().collection("classSessionSignups").where("sessionId", "==", sessionId).get();
  return snapshot.docs.filter((entry) => entry.data().signupStatus !== "waitlisted").length;
}

async function getSessionSignupCounts(sessionId) {
  const snapshot = await admin.firestore().collection("classSessionSignups").where("sessionId", "==", sessionId).get();
  return snapshot.docs.reduce((counts, entry) => {
    if (entry.data().signupStatus === "waitlisted") counts.waitlistCount += 1;
    else counts.signupCount += 1;
    return counts;
  }, { signupCount: 0, waitlistCount: 0 });
}

exports.upsertClassSessionSignup = onCall(CLASS_SIGNUP_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "請先登入後再報名。");
  const sessionId = String(request.data?.sessionId || "").trim();
  const note = String(request.data?.note || "").trim().slice(0, 500);
  if (!sessionId) throw new HttpsError("invalid-argument", "缺少社課場次。");

  let stage = "讀取社課資料";
  try {
    const firestore = admin.firestore();
    const authEmail = normalizedEmail(request.auth.token?.email);
    const sessionRef = firestore.collection("classSessions").doc(sessionId);
    const memberRef = firestore.collection("members").doc(uid);
    const signupRef = firestore.collection("classSessionSignups").doc(`${sessionId}-${uid}`);
    const statsRef = firestore.collection("classSessionStats").doc(sessionId);
    const adminRef = firestore.collection("admins").doc(uid);
    const approvalRef = firestore.collection("signupApprovals").doc(authEmail);
    const [sessionSnapshot, memberSnapshot, statsSnapshot, adminSnapshot, approvalSnapshot] = await Promise.all([
      sessionRef.get(),
      memberRef.get(),
      statsRef.get(),
      adminRef.get(),
      approvalRef.get(),
    ]);
    if (!sessionSnapshot.exists) throw new HttpsError("not-found", "找不到這場社課。");
    if (!memberSnapshot.exists) throw new HttpsError("failed-precondition", "請先完成個人資料。");
    const session = sessionSnapshot.data();
    const member = memberSnapshot.data();
    const isAdmin = adminSnapshot.exists;
    const isFormalMember = hasFormalMembership(member, approvalSnapshot.exists);
    if (!isAdmin && !isFormalMember && session.allowNonMembers !== true) throw new HttpsError("permission-denied", "本場社課僅限正式社員報名。");
    if (session.signupRequired !== true) throw new HttpsError("failed-precondition", "這場社課不需要報名。");
    const now = Date.now();
    const memberOpenAt = parseClubDateTime(session.memberSignupOpenAt || session.signupOpenAt);
    const configuredPublicOpenAt = parseClubDateTime(session.publicSignupOpenAt);
    const publicOpenAt = Number.isFinite(configuredPublicOpenAt)
      ? configuredPublicOpenAt
      : Number.isFinite(memberOpenAt) && session.allowNonMembers === true
        ? memberOpenAt + LEGACY_NON_MEMBER_SIGNUP_DELAY_MS
        : Number.NaN;
    const closeAt = parseClubDateTime(session.signupCloseAt);
    const effectiveOpenAt = !isAdmin && !isFormalMember ? publicOpenAt : memberOpenAt;
    if (!isAdmin && !isFormalMember && !Number.isFinite(publicOpenAt)) {
      throw new HttpsError("failed-precondition", "這場社課尚未設定非社員報名時間。");
    }
    if ((Number.isFinite(effectiveOpenAt) && now < effectiveOpenAt) || (Number.isFinite(closeAt) && now > closeAt)) {
      throw new HttpsError("failed-precondition", !isAdmin && !isFormalMember && Number.isFinite(memberOpenAt) && now >= memberOpenAt
        ? "目前為社員優先報名期間，請於社員與非社員皆可報名的時間再試。"
        : "目前不在報名期間內。");
    }

    stage = "計算目前名額";
    const seedCount = statsSnapshot.exists ? Number(statsSnapshot.data().signupCount || 0) : await getSessionSignupSeedCount(sessionId);
    stage = "寫入報名資料";
    await firestore.runTransaction(async (transaction) => {
      const existingSignup = await transaction.get(signupRef);
      const currentStats = await transaction.get(statsRef);
      const existingData = existingSignup.exists ? existingSignup.data() : {};
      const count = currentStats.exists ? Number(currentStats.data().signupCount || 0) : seedCount;
      const limit = Number(session.signupLimit || 0);
      const signupStatus = existingSignup.exists
        ? existingData.signupStatus || "accepted"
        : limit > 0 && count >= limit ? "waitlisted" : "accepted";
      transaction.set(signupRef, {
        sessionId, userId: uid, email: request.auth.token?.email || "", name: member.name || "", studentId: member.studentId || "", note,
        membershipStatusAtSignup: isFormalMember ? "formal_member" : String(member.membershipStatus || "non_member"),
        isFormalMemberAtSignup: isFormalMember, dropInPaymentStatus: isFormalMember ? "not_required" : existingData.dropInPaymentStatus || "unpaid",
        sessionDate: session.date || "", sessionWeekday: session.weekday || "", sessionTitle: session.title || "", sessionTimeLabel: session.timeLabel || "",
        signupStatus, createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      const waitlistCount = currentStats.exists ? Number(currentStats.data().waitlistCount || 0) : 0;
      transaction.set(statsRef, {
        sessionId,
        signupCount: existingSignup.exists || signupStatus === "waitlisted" ? count : count + 1,
        waitlistCount: existingSignup.exists ? waitlistCount : waitlistCount + Number(signupStatus === "waitlisted"),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    const savedSignup = await signupRef.get();
    return { ok: true, signupStatus: savedSignup.data()?.signupStatus || "accepted" };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Class session signup failed.", { uid, sessionId, stage, code: error?.code || "unknown", message: error?.message || String(error) });
    throw new HttpsError("internal", `報名後端在「${stage}」時失敗，請聯絡管理員。`);
  }
});

exports.deleteClassSessionSignup = onCall(CLASS_SIGNUP_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "請先登入。");
  const sessionId = String(request.data?.sessionId || "").trim();
  const firestore = admin.firestore();
  const signupRef = firestore.collection("classSessionSignups").doc(`${sessionId}-${uid}`);
  const statsRef = firestore.collection("classSessionStats").doc(sessionId);
  await firestore.runTransaction(async (transaction) => {
    const signupsQuery = firestore.collection("classSessionSignups").where("sessionId", "==", sessionId);
    const [signup, stats, sessionSignups] = await Promise.all([transaction.get(signupRef), transaction.get(statsRef), transaction.get(signupsQuery)]);
    if (!signup.exists) return;
    const removedStatus = signup.data().signupStatus || "accepted";
    const nextWaitlisted = sessionSignups.docs
      .filter((entry) => entry.id !== signup.id && entry.data().signupStatus === "waitlisted")
      .sort((a, b) => Number(a.data().createdAt?.toMillis?.() || 0) - Number(b.data().createdAt?.toMillis?.() || 0))[0];
    transaction.delete(signupRef);
    let signupCount = Math.max(0, Number(stats.data()?.signupCount || 0) - Number(removedStatus !== "waitlisted"));
    let waitlistCount = Math.max(0, Number(stats.data()?.waitlistCount || 0) - Number(removedStatus === "waitlisted"));
    if (removedStatus !== "waitlisted" && nextWaitlisted) {
      transaction.set(nextWaitlisted.ref, { signupStatus: "accepted", promotedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      signupCount += 1;
      waitlistCount = Math.max(0, waitlistCount - 1);
    }
    transaction.set(statsRef, { sessionId, signupCount, waitlistCount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

exports.syncClassSessionStats = onDocumentWritten({ document: "classSessionSignups/{signupId}", region: REGION }, async (event) => {
  const sessionId = String(event.data.after.data()?.sessionId || event.data.before.data()?.sessionId || "");
  if (!sessionId) return;
  const firestore = admin.firestore();
  const counts = await getSessionSignupCounts(sessionId);
  await firestore.collection("classSessionStats").doc(sessionId).set({ sessionId, ...counts, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
});
