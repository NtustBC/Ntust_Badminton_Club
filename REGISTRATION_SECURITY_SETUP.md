# 註冊驗證與安全功能部署

本次新增的畫面驗證碼與有名額鎖定的社課報名由 Firebase Cloud Functions 執行；只更新 GitHub Pages 靜態檔案並不會啟用這些後端功能。目前所有系統寄信皆已停用。

## 部署前設定

1. 不需要設定 Resend、SMTP 或郵件 API Key。
2. 部署 Functions 與 Firestore Rules：

   ```powershell
   firebase deploy --only functions,firestore
   ```

3. Firebase Authentication 的 Authorized domains 必須包含正式網站網域。

## 上線前驗收

- 使用尚未註冊的信箱產生畫面 6 位數驗證碼，確認 10 分鐘後失效且錯誤輸入最多 5 次。
- 未勾選個資同意時不得建立帳號；完成註冊後，`members/{uid}.privacyConsent` 應有版本與時間。
- 建立一場上限 1 人的社課，兩個帳號同時報名時只能有一筆成功。
- 未登入與一般社員都無法讀取 `classSessionSignups`、`classPublicRosters`、其他人的 `members` 資料。
- 忘記密碼畫面只提示聯絡幹部，且不會發出網路寄信請求。

## 建議後續強化

- 啟用 Firebase App Check，再將公開 callable functions 設為 `enforceAppCheck: true`，降低機器人重複產生帳號與濫用。
- 將目前以 `admin@gmail.com` 判定的 bootstrap 管理員改為 Firebase Custom Claims；完成遷移前不要刪除現有 `admins` 文件，以免管理員被鎖在系統外。
- 定期清除過期的 `registrationVerifications` 與 rate-limit 文件，可使用 Firestore TTL。
