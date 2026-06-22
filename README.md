# NTUST Badminton Club

臺科大羽球社官方網站，使用 Vite、Firebase 與 GitHub Pages 建置。

這個專案提供社團介紹、社課與入社報名、公告、FAQ、會員後台，以及 Firebase Cloud Functions 的自動寄信流程。

## 特色

- 響應式版型，手機與桌機都能正常瀏覽
- 多頁式靜態網站，適合 GitHub Pages 部署
- Firebase Auth + Firestore 會員與管理員功能
- 社課報名、公告、FAQ 等動態資料頁
- Cloud Functions 自動寄送入社申請通知與審核信
- Firestore 規則與管理員權限控管

## 網站頁面

- `index.html`：首頁
- `about.html`：社團介紹
- `club-signup.html`：入社申請
- `class-signup.html`：社課報名
- `notices.html`：公告
- `faq.html`：常見問題
- `members.html`：會員後台
- `privacy.html`：隱私權政策

## 技術棧

- [Vite](https://vite.dev/)
- Vanilla JavaScript
- CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Functions
- GitHub Pages

## 專案結構

```text
.
├─ about.html
├─ class-signup.html
├─ club-signup.html
├─ faq.html
├─ index.html
├─ members.html
├─ notices.html
├─ privacy.html
├─ src/
│  ├─ index.css
│  ├─ site.js
│  ├─ firebase-config.js
│  └─ firebase-modules.js
├─ assets/
├─ functions/
│  ├─ index.js
│  └─ package.json
├─ firestore.rules
├─ firebase.json
├─ .firebaserc
└─ .github/workflows/deploy-pages.yml
```

## 開發需求

- Node.js 20 或以上
- npm
- Firebase CLI

如果你要修改 Firebase 或 Functions，另外還需要：

- Firebase 專案
- Resend API Key

如果你要本機修改 `functions/index.js` 或跑 Functions Emulator，請先進入 `functions/` 安裝依賴：

```bash
cd functions
npm install
```

常用的 Functions 本機指令：

```bash
npm run serve
```

## 本機開發

安裝依賴：

```bash
npm install
```

啟動本機開發伺服器：

```bash
npm run dev
```

Vite 會輸出本機網址，通常是 `http://localhost:5173/`。

## 建置與預覽

產生正式版建置：

```bash
npm run build
```

預覽建置結果：

```bash
npm run preview
```

## Firebase 設定

前端 Firebase 設定在 `src/firebase-config.js`。

如果你要把專案搬到新的 Firebase 專案，通常需要同步修改：

- `src/firebase-config.js`
- `.firebaserc`

Firestore 規則在 `firestore.rules`，目前包含：

- `admins`
- `members`
- `applications`
- `signupApprovals`
- `classSessions`
- `classSessionSignups`
- `classAnnouncements`
- `faqEntries`

預設管理員信箱是 `admin@gmail.com`，相關邏輯在 `src/firebase-config.js` 和會員後台流程中。

## Cloud Functions

`functions/index.js` 目前負責兩個自動寄信 trigger：

- 新增入社申請時，寄出申請受理通知
- 申請狀態變成 approved 時，寄出審核通過通知

部署前需要先設定 Resend secret：

```bash
firebase functions:secrets:set RESEND_API_KEY
```

如果你要調整信件內容、寄件人、聯絡信箱、手續費或匯款資訊，可以看：

- `AUTO_EMAIL_SETUP.md`
- `member-application-email-template.md`

## 部署

### GitHub Pages

本專案使用 `.github/workflows/deploy-pages.yml` 自動部署到 GitHub Pages。

流程大致是：

1. 安裝依賴
2. 執行 `npm run build`
3. 將 `dist/` 上傳成 Pages artifact
4. 使用 `actions/deploy-pages` 發佈

### Firebase Functions / Firestore

如果你有更新後端函式或規則，可以部署 Functions 與 Firestore：

```bash
firebase deploy --only functions,firestore
```

如果你習慣從 `functions/` 目錄操作，也可以使用 `functions/package.json` 提供的 deploy script。

## 常見修改點

- 要改網站文字或版型：看 `src/index.css` 和各個 HTML 頁面
- 要改互動邏輯：看 `src/site.js`
- 要改 Firebase 設定：看 `src/firebase-config.js`
- 要改自動寄信：看 `functions/index.js`

## 備註

- `dist/` 是建置輸出資料夾，通常不需要手動修改
- 如果你在 GitHub Pages 看到 deployment failed，但 build 成功，通常是 Pages 部署排程或 in-progress deployment 衝突，不一定是前端程式壞掉
