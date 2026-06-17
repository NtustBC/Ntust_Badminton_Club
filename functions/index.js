const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

admin.initializeApp();

const REGION = "asia-east1";
const APPLICATION_DOCUMENT = "applications/{applicationId}";

const RECEIVED_EMAIL_SUBJECT = "【臺科大羽球社】社員申請已收到！後續繳費與審核步驟說明";
const APPROVED_EMAIL_SUBJECT = "【臺科大羽球社】恭喜！您的入社申請已審核通過，請前往網站登入";

const MAIL_SETTINGS = {
  from: process.env.MAIL_FROM || "NTUST Badminton Club <onboarding@resend.dev>",
  replyTo: process.env.CLUB_CONTACT_EMAIL || "ntustbc@gmail.com",
  clubContactEmail: process.env.CLUB_CONTACT_EMAIL || "ntustbc@gmail.com",
  memberFeeNtd: process.env.MEMBER_FEE_NTD || "1000",
  bankCode: process.env.BANK_CODE || "XXX（中華郵政／某銀行）",
  bankAccount: process.env.BANK_ACCOUNT || "XXXXXXXXXXXXXXXX",
  bankAccountName: process.env.BANK_ACCOUNT_NAME || "臺科大羽球社 xxx",
  websiteUrl:
    process.env.CLUB_WEBSITE_URL || "https://ntustbc.github.io/Ntust_Badminton_Club/index.html",
  lineContact: process.env.CLUB_LINE_CONTACT || "XXXXXXXXX",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getApplicationStatus(application) {
  if (!application) {
    return "pending";
  }

  if (application.reviewStatus) {
    return application.reviewStatus;
  }

  return application.approved ? "approved" : "pending";
}

function buildReceivedEmailText(application) {
  return `哈囉～${application.name || "同學"} 你好：

我們已收到你加入臺科大羽球社的申請資料！
為了盡快幫你開通網站的「社員專區」權限，請協助我們完成以下繳費步驟：

本學期社費金額：新台幣 ${MAIL_SETTINGS.memberFeeNtd} 元整

匯款帳號資訊：
銀行代碼：${MAIL_SETTINGS.bankCode}
銀行帳號：${MAIL_SETTINGS.bankAccount}
戶名：${MAIL_SETTINGS.bankAccountName}

完成匯款後，請回覆這封信，並提供以下資訊：
1. 匯款帳號末五碼
2. 匯款時間
3. 申請人姓名

我們在確認款項無誤後，會盡快為你完成審核，並寄送後續註冊通知信給你。

若有任何問題，也歡迎直接回信詢問！

臺科大羽球社 敬上
聯絡信箱：${MAIL_SETTINGS.clubContactEmail}`;
}

function buildReceivedEmailHtml(application) {
  return `
    <div style="font-family: Arial, 'Noto Sans TC', sans-serif; color: #13263a; line-height: 1.8;">
      <p>哈囉～${escapeHtml(application.name || "同學")} 你好：</p>
      <p>我們已收到你加入臺科大羽球社的申請資料！<br />為了盡快幫你開通網站的「社員專區」權限，請協助我們完成以下繳費步驟：</p>
      <p><strong>本學期社費金額：</strong>新台幣 ${escapeHtml(MAIL_SETTINGS.memberFeeNtd)} 元整</p>
      <p>
        <strong>匯款帳號資訊：</strong><br />
        銀行代碼：${escapeHtml(MAIL_SETTINGS.bankCode)}<br />
        銀行帳號：${escapeHtml(MAIL_SETTINGS.bankAccount)}<br />
        戶名：${escapeHtml(MAIL_SETTINGS.bankAccountName)}
      </p>
      <p>
        完成匯款後，請回覆這封信，並提供以下資訊：<br />
        1. 匯款帳號末五碼<br />
        2. 匯款時間<br />
        3. 申請人姓名
      </p>
      <p>我們在確認款項無誤後，會盡快為你完成審核，並寄送後續註冊通知信給你。</p>
      <p>若有任何問題，也歡迎直接回信詢問！</p>
      <p>臺科大羽球社 敬上<br />聯絡信箱：${escapeHtml(MAIL_SETTINGS.clubContactEmail)}</p>
    </div>
  `;
}

function buildApprovedEmailText(application) {
  return `同學你好：

我是羽球社的社長。很高興通知你，你的入社申請與資料已經審核通過囉！

你的 Email 帳號目前已順利開通管理權限，現在你可以正式前往我們的網站，註冊或登入你的社員帳號了：
羽球社網站：${MAIL_SETTINGS.websiteUrl}

登入後的專屬功能：

1. 能報名每週社課（方便我們管理人數，維護大家打球權益）
2. 接收第一手的練球報名與社團公告通知。

再次歡迎你加入臺科大羽球社！如果登入過程中遇到任何問題（例如顯示權限不足），請隨時直接回覆這封信，或在社團 Line 群組中聯絡幹部，我們會立刻幫你處理。
Line：${MAIL_SETTINGS.lineContact}

祝你打球愉快、球技精進！

臺科大羽球社 敬上`;
}

function buildApprovedEmailHtml(application) {
  return `
    <div style="font-family: Arial, 'Noto Sans TC', sans-serif; color: #13263a; line-height: 1.8;">
      <p>同學你好：</p>
      <p>我是羽球社的社長。很高興通知你，你的入社申請與資料已經審核通過囉！</p>
      <p>
        你的 Email 帳號目前已順利開通管理權限，現在你可以正式前往我們的網站，註冊或登入你的社員帳號了：<br />
        羽球社網站：<a href="${escapeHtml(MAIL_SETTINGS.websiteUrl)}">${escapeHtml(MAIL_SETTINGS.websiteUrl)}</a>
      </p>
      <p>
        <strong>登入後的專屬功能：</strong><br />
        1. 能報名每週社課（方便我們管理人數，維護大家打球權益）<br />
        2. 接收第一手的練球報名與社團公告通知。
      </p>
      <p>
        再次歡迎你加入臺科大羽球社！如果登入過程中遇到任何問題（例如顯示權限不足），請隨時直接回覆這封信，或在社團 Line 群組中聯絡幹部，我們會立刻幫你處理。<br />
        Line：${escapeHtml(MAIL_SETTINGS.lineContact)}
      </p>
      <p>祝你打球愉快、球技精進！</p>
      <p>臺科大羽球社 敬上</p>
    </div>
  `;
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY secret.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_SETTINGS.from,
      to: [to],
      subject,
      text,
      html,
      reply_to: MAIL_SETTINGS.replyTo,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Resend request failed with status ${response.status}.`);
  }

  return data;
}

exports.sendApplicationReceivedEmail = onDocumentCreated(
  {
    document: APPLICATION_DOCUMENT,
    region: REGION,
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("Application snapshot was missing in Firestore trigger.");
      return;
    }

    const application = snapshot.data();
    if (!application?.email) {
      logger.warn("Application document missing email field.", { applicationId: snapshot.id });
      return;
    }

    try {
      const result = await sendWithResend({
        to: application.email,
        subject: RECEIVED_EMAIL_SUBJECT,
        text: buildReceivedEmailText(application),
        html: buildReceivedEmailHtml(application),
      });

      await snapshot.ref.set(
        {
          notificationEmail: {
            provider: "resend",
            status: "sent",
            resendId: result?.id || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      logger.info("Application received email sent successfully.", {
        applicationId: snapshot.id,
        email: application.email,
      });
    } catch (error) {
      await snapshot.ref.set(
        {
          notificationEmail: {
            provider: "resend",
            status: "error",
            errorMessage: String(error?.message || error),
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      logger.error("Failed to send application received email.", {
        applicationId: snapshot.id,
        email: application.email,
        error: error?.message || String(error),
      });
    }
  },
);

exports.sendApplicationApprovedEmail = onDocumentUpdated(
  {
    document: APPLICATION_DOCUMENT,
    region: REGION,
    secrets: ["RESEND_API_KEY"],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const afterSnapshot = event.data?.after;
    const after = afterSnapshot?.data();

    if (!afterSnapshot || !after?.email) {
      return;
    }

    const beforeStatus = getApplicationStatus(before);
    const afterStatus = getApplicationStatus(after);
    const alreadySent = after.approvalEmail?.status === "sent";

    if (beforeStatus === afterStatus || afterStatus !== "approved" || alreadySent) {
      return;
    }

    try {
      const result = await sendWithResend({
        to: after.email,
        subject: APPROVED_EMAIL_SUBJECT,
        text: buildApprovedEmailText(after),
        html: buildApprovedEmailHtml(after),
      });

      await afterSnapshot.ref.set(
        {
          approvalEmail: {
            provider: "resend",
            status: "sent",
            resendId: result?.id || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      logger.info("Application approved email sent successfully.", {
        applicationId: afterSnapshot.id,
        email: after.email,
      });
    } catch (error) {
      await afterSnapshot.ref.set(
        {
          approvalEmail: {
            provider: "resend",
            status: "error",
            errorMessage: String(error?.message || error),
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

      logger.error("Failed to send application approved email.", {
        applicationId: afterSnapshot.id,
        email: after.email,
        error: error?.message || String(error),
      });
    }
  },
);
