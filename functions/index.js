const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");

admin.initializeApp();

const REGION = "asia-east1";
const BOOTSTRAP_ADMIN_EMAIL = "admin@gmail.com";
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

function normalizeIdentityText(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeStudentId(value) {
  return String(value || "").trim().replace(/[\s-]+/g, "").toUpperCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
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

exports.requestVerifiedPasswordReset = onCall({ region: REGION }, async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  const name = String(request.data?.name || "").trim();
  const studentId = String(request.data?.studentId || "").trim();
  const department = String(request.data?.department || "").trim();
  const phone = String(request.data?.phone || "").trim();
  const newPassword = String(request.data?.newPassword || "");

  if (!email || !name || !studentId || !department || !phone || !newPassword) {
    throw new HttpsError("invalid-argument", "請完整填寫所有欄位。");
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new HttpsError("invalid-argument", "新密碼必須為 8 至 128 個字元。");
  }

  await consumePasswordResetAttempt(email);

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (error) {
    logger.warn("Password reset identity verification failed.", { reason: error?.code || "auth-user-not-found" });
    throw new HttpsError("failed-precondition", "帳號或個人資料不正確。");
  }

  const memberSnapshot = await admin.firestore().collection("members").doc(userRecord.uid).get();
  if (!memberSnapshot.exists) {
    logger.warn("Password reset member profile was missing.", { uid: userRecord.uid });
    throw new HttpsError("failed-precondition", "帳號或個人資料不正確。");
  }

  const member = memberSnapshot.data();
  const identityMatches =
    normalizeIdentityText(member.name) === normalizeIdentityText(name) &&
    normalizeStudentId(member.studentId) === normalizeStudentId(studentId) &&
    normalizeIdentityText(member.department || member.school) === normalizeIdentityText(department) &&
    normalizePhone(member.phone) === normalizePhone(phone);

  if (!identityMatches) {
    logger.warn("Password reset identity fields did not match.", { uid: userRecord.uid });
    throw new HttpsError("failed-precondition", "帳號或個人資料不正確。");
  }

  await admin.auth().updateUser(userRecord.uid, { password: newPassword });
  logger.info("Password updated after verified identity check.", { uid: userRecord.uid });
  return { ok: true };
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
