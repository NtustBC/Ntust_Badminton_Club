# 自動寄信設定

這個專案已經補上 `Firebase Cloud Functions + Resend` 的自動寄信骨架。

## 目前行為

### 1. 申請人送出申請時

當 `applications/{applicationId}` 新增一筆申請時，Cloud Function 會自動寄出：

- 收件者：申請人的 `email`
- 主旨：`【臺科大羽球社】社員申請已收到！後續繳費與審核步驟說明`
- 內容：社費繳交與審核流程說明

寄信結果會寫回該申請文件的 `notificationEmail` 欄位。

### 2. 管理員審核通過時

當管理員把申請更新為 `approved` 後，Cloud Function 會再自動寄出：

- 收件者：申請人的 `email`
- 主旨：`【臺科大羽球社】恭喜！您的入社申請已審核通過，請前往網站登入`
- 內容：通知對方已通過審核，並前往網站註冊／登入

寄信結果會寫回該申請文件的 `approvalEmail` 欄位。

## 你要做的事

### 1. 安裝 Functions 依賴

```powershell
cd functions
npm install
```

### 2. 建立 Resend API Key

到 [Resend](https://resend.com/) 建立 API Key。

### 3. 把 API Key 存進 Firebase Secret

```powershell
firebase functions:secrets:set RESEND_API_KEY
```

### 4. 設定寄件資訊

編輯 [functions/index.js](/D:/Github/Ntust_Badminton_Club/functions/index.js) 裡的 `MAIL_SETTINGS` 預設值，至少確認：

- `from`
- `clubContactEmail`
- `memberFeeNtd`
- `bankCode`
- `bankAccount`
- `bankAccountName`
- `websiteUrl`
- `lineContact`

## 重要提醒

`from` 不能亂填。  
如果你要真的寄到外部信箱，Resend 通常需要你先驗證自己的寄件網域。  
測試時可以先用 Resend 提供的測試寄件位址，但正式上線前建議改成你們社團自己的網域寄件信箱。

## 5. 部署 Functions

在專案根目錄執行：

```powershell
firebase deploy --only functions
```

## 6. 驗證

部署完成後：

1. 填一次社員申請表
2. 到 Firestore 檢查該申請文件
3. 查看 `notificationEmail.status`
4. 再由管理員核准一次
5. 查看 `approvalEmail.status`

可能值：

- `sent`
- `error`

如果是 `error`，會一起記錄 `errorMessage`
