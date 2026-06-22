# NTUST Badminton Club 操作手冊

這份文件是給社團幹部、管理員與後續維護者使用的操作手冊。
如果你只是要改內容、檢查網站、重新部署，照著下面步驟做就可以。

## 1. 這個網站可以做什麼

- 顯示社團首頁、介紹、報名、公告、FAQ 與會員後台
- 支援手機與桌機瀏覽
- 透過 Firebase 管理會員資料、公告與報名資料
- 透過 Cloud Functions 自動寄送入社申請通知與審核信
- 部署到 GitHub Pages 供對外瀏覽

## 2. 開始前要先準備

- Node.js 20 以上
- npm
- Firebase CLI
- Firebase 專案 `ntustbc-64c11`
- Resend API Key

如果你是第一次在本機跑專案，先執行：

```bash
npm install
```

如果你要改 Cloud Functions，再進到 `functions/`：

```bash
cd functions
npm install
```

## 3. 本機開啟網站

1. 先安裝主專案依賴。
2. 執行開發伺服器。
3. 用瀏覽器打開 Vite 提供的網址。

```bash
npm run dev
```

通常網址會是 `http://localhost:5173/`。

如果你要確認正式版輸出是否正常，先建置再預覽：

```bash
npm run build
npm run preview
```

## 4. 日常操作流程

### 4.1 修改頁面文字或圖片

如果你要改網站上看到的文字、段落、按鈕或圖片，通常會改這些檔案：

- `index.html`
- `about.html`
- `club-signup.html`
- `class-signup.html`
- `notices.html`
- `faq.html`
- `members.html`
- `privacy.html`
- `assets/`

樣式與版面主要在：

- `src/index.css`

互動邏輯主要在：

- `src/site.js`

### 4.2 修改公告、FAQ、社課內容

這類內容通常分散在以下頁面：

- 公告：`notices.html`
- FAQ：`faq.html`
- 社課報名：`class-signup.html`
- 入社申請：`club-signup.html`
- 會員後台：`members.html`

如果內容是從 Firestore 讀取，改完之後要一起確認資料權限與規則。

### 4.3 修改 Firebase 設定

如果你要把網站切到新的 Firebase 專案，通常要一起改：

- `src/firebase-config.js`
- `.firebaserc`

預設管理員信箱是 `admin@gmail.com`。

### 4.4 修改自動寄信內容

Cloud Functions 的寄信流程在：

- `functions/index.js`

如果你要調整信件範本、寄件人資訊或申請說明，請一起參考：

- `AUTO_EMAIL_SETUP.md`
- `member-application-email-template.md`

部署 Functions 前，先設定 secret：

```bash
firebase functions:secrets:set RESEND_API_KEY
```

## 5. 部署流程

### 5.1 部署到 GitHub Pages

這個專案會在推送到 `main` 分支後，自動透過 `.github/workflows/deploy-pages.yml` 建置並部署。

標準流程是：

1. 推送程式碼到 `main`
2. GitHub Actions 執行 `npm install`
3. GitHub Actions 執行 `npm run build`
4. 產生 `dist/`
5. 發佈到 GitHub Pages

如果你只想先確認本機建置沒問題，可以先跑：

```bash
npm run build
```

### 5.2 部署 Firebase Functions 與 Firestore

如果你有改到後端函式或規則，使用：

```bash
firebase deploy --only functions,firestore
```

如果你是在 `functions/` 目錄內操作，也可以使用該目錄的 deploy script。

## 6. 權限與資料結構

Firestore 規則在：

- `firestore.rules`

目前常用的 collection 如下：

| Collection | 用途 |
| --- | --- |
| `admins` | 管理員權限 |
| `members` | 會員資料 |
| `applications` | 入社申請 |
| `signupApprovals` | 審核記錄 |
| `classSessions` | 社課場次 |
| `classSessionSignups` | 社課報名資料 |
| `classAnnouncements` | 社課公告 |
| `faqEntries` | FAQ 內容 |

## 7. 常見問題

### 7.1 GitHub Pages 顯示 deployment failed

如果你看到 build 成功，但 Pages 部署失敗，常見原因是：

- 前一個 `github-pages` 部署還在進行中
- GitHub Actions 目前有併發的部署工作

這種情況不一定是網站程式壞掉，通常先等前一個部署完成再重試。

### 7.2 手機版版面怪怪的

先檢查：

- `src/index.css`
- 對應頁面的 HTML 結構

### 7.3 自動寄信沒送出

先檢查：

- `RESEND_API_KEY` 是否已設定
- `functions/index.js` 是否有錯誤
- Firebase Functions 日誌是否有失敗紀錄

## 8. 重要檔案快速索引

| 檔案 | 用途 |
| --- | --- |
| `src/index.css` | 全站樣式與 RWD |
| `src/site.js` | 前端互動邏輯 |
| `src/firebase-config.js` | Firebase 連線設定 |
| `functions/index.js` | Cloud Functions 自動寄信 |
| `firestore.rules` | Firestore 權限規則 |
| `.github/workflows/deploy-pages.yml` | GitHub Pages 自動部署 |
| `AUTO_EMAIL_SETUP.md` | 自動寄信設定說明 |
| `member-application-email-template.md` | 入社申請信件範本 |

## 9. 建議操作順序

如果你只是要更新內容，建議照這個順序：

1. 修改對應檔案
2. 執行 `npm run dev` 檢查畫面
3. 執行 `npm run build` 確認正式版可產生
4. 推送到 `main`
5. 等 GitHub Pages 自動部署完成

