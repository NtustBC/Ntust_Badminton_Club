# 臺科大羽球社網站

臺科大羽球社官方網站，提供社團介紹、入社申請、社課報名、訊息公告與常見問題，也包含社員與社課資料的管理功能。

## 網站連結

[前往臺科大羽球社網站](https://ntustbc.github.io/Ntust_Badminton_Club/)

## 主要功能

- 首頁：社團資訊與主要功能入口
- 關於我們：社團理念、活動內容與照片
- 加入社團：入社流程、社費資訊與申請表單
- 社課報名：目前開放的週日場次、報名與名單查詢
- 訊息公告：社課異動、活動與重要通知
- FAQ：常見問題與聯絡資訊
- 管理頁：社員、入社申請、社課、公告及 FAQ 管理

## 使用技術

- HTML、CSS、JavaScript
- [Vite](https://vite.dev/)：本機開發與正式建置
- [Firebase Authentication](https://firebase.google.com/docs/auth)：帳號註冊與登入
- [Cloud Firestore](https://firebase.google.com/docs/firestore)：社員、申請、社課與公告資料
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)：後端自動化功能
- [GitHub Pages](https://pages.github.com/)：網站部署

## 本機開發

需要先安裝 Node.js 20 或相容版本。

```bash
npm ci
npm run dev
```

Vite 啟動後，依終端機顯示的本機網址開啟網站。

## 正式建置

```bash
npm run build
```

建置結果會輸出到 `dist/` 目錄。

## 專案結構

```text
.
├── assets/             # 圖片與靜態資源
├── functions/          # Firebase Cloud Functions
├── src/                # 共用樣式、前端邏輯與 Firebase 設定
├── .github/workflows/  # GitHub Pages 自動部署流程
├── index.html           # 首頁
├── about.html           # 關於我們
├── club-signup.html     # 加入社團
├── class-signup.html    # 社課報名
├── notices.html         # 訊息公告
├── faq.html             # 常見問題
└── members.html         # 管理頁
```

## 部署

推送至 `main` 分支後，GitHub Actions 會執行 Vite 建置並將 `dist/` 部署至 GitHub Pages。

Firebase Functions 與 Firestore 規則可使用以下指令部署：

```bash
cd functions
npm run deploy
```

## 社團聯絡

最新聯絡方式請以網站頁尾及公告頁資訊為準。
