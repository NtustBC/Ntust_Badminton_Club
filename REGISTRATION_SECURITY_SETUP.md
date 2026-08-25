# Firebase 安全功能部署

Firestore Rules 必須另外部署；只更新 GitHub Pages 靜態檔案不會套用後端權限修正。目前社員申請改用 Firestore Transaction，不依賴 Cloud Functions，可在 Firebase Spark 免費方案運作。目前所有系統寄信皆已停用。

## Spark 方案部署步驟

1. 部署 Firestore Rules（不要加上 `functions`）：

   ```powershell
   firebase deploy --only firestore:rules
   ```

2. 重新建置並發佈 GitHub Pages 靜態網站。
3. 管理員登入「社員管理」，在「社員申請名額與期間」重新按一次儲存。這會寫入 Rules 驗證開放時間所需的 Firestore Timestamp。

完成後，「儲存申請資料」會在同一筆 Firestore Transaction 中同步更新 `members`、`applications` 與 `membershipRegistrationStats`，並由 Rules 限制登入者只能修改自己、不可突破名額或自行變更為正式社員。

## 部署前設定

1. 確認 Firestore 的 `admins/{uid}` 至少已有一位真實管理員；系統不再接受任何硬編碼管理員 Email。
2. 不需要設定 Resend、SMTP 或郵件 API Key。
3. 在 Firebase App Check 為 Web App 註冊 reCAPTCHA Enterprise，將 Site Key 填入 `src/firebase-config.js` 的 `appCheckSiteKey`。
4. 先觀察 App Check metrics，確認正式站請求正常後，再於 Firebase Console 啟用 Cloud Firestore、Authentication 與 Functions enforcement。
5. 若專案升級為 Blaze 且要啟用其他 Cloud Functions，才部署 Functions 與 Firestore Rules：

   ```powershell
   firebase deploy --only functions,firestore
   ```

6. Firebase Authentication 的 Authorized domains 必須包含正式網站網域。
7. Google Cloud Console 的 Firebase Browser Key 應只允許必要 Firebase API，網站限制加入 `https://ntustbc.github.io/*`；本機開發來源僅在需要時加入。

## 上線前驗收

- 未勾選個資同意時不得建立帳號；完成註冊後，`members/{uid}.privacyConsent` 應有版本與時間。
- 一般帳號即使竄改前端狀態，也無法讀取其他人的 `members` 或建立 `admins/{uid}`。
- 非社員報名開放場次時，不得偽造 `isFormalMemberAtSignup` 或 `dropInPaymentStatus`。
- 未登入訪客不得新增 `faqQuestions`；登入後可以送出問題。
- 建立一場上限 1 人的社課，兩個帳號同時報名時只能有一筆成功。
- 未登入與一般社員都無法讀取 `classSessionSignups`、`classPublicRosters`、其他人的 `members` 資料。
- 忘記密碼畫面只提示聯絡幹部，且不會發出網路寄信請求。

## 持續維護

- 新增社員可自行修改的欄位時，必須同步更新 `members` 的 Rules 白名單與欄位驗證。
- 新增外部 Script、API、圖片或字型來源時，必須同步審查所有 HTML 的 Content Security Policy。
- 若管理員數量與權限層級增加，建議改用 Firebase Custom Claims，並僅由 Admin SDK 設定聲明。
