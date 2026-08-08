const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const crypto = require("crypto");

admin.initializeApp();

const REGION = "asia-east1";
const CALLABLE_OPTIONS = { region: REGION, enforceAppCheck: true };
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

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
  const snapshot = await admin.firestore().collection("classSessionSignups").where("sessionId", "==", sessionId).get();
  return snapshot.size;
}

exports.upsertClassSessionSignup = onCall(CALLABLE_OPTIONS, async (request) => {
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
    const openAt = parseClubDateTime(session.signupOpenAt);
    const closeAt = parseClubDateTime(session.signupCloseAt);
    if ((Number.isFinite(openAt) && now < openAt) || (Number.isFinite(closeAt) && now > closeAt)) throw new HttpsError("failed-precondition", "目前不在報名期間內。");

    stage = "計算目前名額";
    const seedCount = statsSnapshot.exists ? Number(statsSnapshot.data().signupCount || 0) : await getSessionSignupSeedCount(sessionId);
    stage = "寫入報名資料";
    await firestore.runTransaction(async (transaction) => {
      const existingSignup = await transaction.get(signupRef);
      const currentStats = await transaction.get(statsRef);
      const existingData = existingSignup.exists ? existingSignup.data() : {};
      const count = currentStats.exists ? Number(currentStats.data().signupCount || 0) : seedCount;
      const limit = Number(session.signupLimit || 0);
      if (!existingSignup.exists && limit > 0 && count >= limit) throw new HttpsError("resource-exhausted", "這場社課已額滿。");
      transaction.set(signupRef, {
        sessionId, userId: uid, email: request.auth.token?.email || "", name: member.name || "", studentId: member.studentId || "", note,
        membershipStatusAtSignup: isFormalMember ? "formal_member" : String(member.membershipStatus || "non_member"),
        isFormalMemberAtSignup: isFormalMember, dropInPaymentStatus: isFormalMember ? "not_required" : existingData.dropInPaymentStatus || "unpaid",
        sessionDate: session.date || "", sessionWeekday: session.weekday || "", sessionTitle: session.title || "", sessionTimeLabel: session.timeLabel || "",
        createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(statsRef, { sessionId, signupCount: existingSignup.exists ? count : count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Class session signup failed.", { uid, sessionId, stage, code: error?.code || "unknown", message: error?.message || String(error) });
    throw new HttpsError("internal", `報名後端在「${stage}」時失敗，請聯絡管理員。`);
  }
});

exports.deleteClassSessionSignup = onCall(CALLABLE_OPTIONS, async (request) => {
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
