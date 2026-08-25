# 10_MASTER_REQUIREMENTS.md — 主需求書

> 前提：`09_REVIEW_FINDINGS.md` 的 D1～D4 已由專案擁有者核准（2026-08-25）。
> 需求編號 `R-xx` 供 11～18 號文件引用。

## 1. 固定決策（不可更改）

| 編號 | 決策 |
|---|---|
| R-01 | Mix Studio（Fork 自 `BlackMixture/Mix-Studio`，基準 commit `bec3292`）是唯一主應用與主 UI |
| R-02 | MCWW（`light-and-ray/Minimalistic-Comfy-Wrapper-WebUI`，基準 commit `1f65c75`）以 ComfyUI custom node 形式作為 Sidecar，**原始碼一行不改** |
| R-03 | ComfyUI 是唯一生成引擎，只綁 `127.0.0.1:8188` |
| R-04 | 外出連線只走 Tailscale Serve（tailnet 私有 HTTPS），永不使用 Funnel |
| R-05 | Codex 是唯一實際修改程式碼的角色；Claude 只做審查與規格 |
| R-06 | MCWW 掛載方式：Mix Studio 在**第二個 port（3301）**開認證反向代理，根路徑一對一轉到 `127.0.0.1:7860`（D1） |
| R-07 | 手機首頁是新增的**簡易殼層** `public/simple/`（`/`），原介面保留在 `/studio` 作為進階模式（D2） |
| R-08 | Git：`origin` = 使用者 Fork，`upstream` = 官方；自訂碼集中在 `public/simple/`、`lib/zh/`、`scripts/zh/`、`test/zh-*.test.js`；`server.js` 掛鉤處以 `// [ZH-TW-CUSTOM]` 標記（D3） |
| R-09 | 第一版只控制一台 Windows 11 + RTX 5090 32GB + 128GB RAM 主機 |
| R-10 | 所有生成、提示詞、媒體皆留在本機；不使用雲端生成、雲端 moderation、雲端 LLM（預設）、第三方分析 |

## 2. 功能範圍

### 2.1 第一版必做（In）

| 編號 | 功能 | 對應既有能力（見 12 號文件） |
|---|---|---|
| R-20 | 首頁四大模式：文生圖、圖生圖、文生影、圖生影 | `/api/generate`（t2i / edit）、`/api/animate`（有／無首幀） |
| R-21 | 每個模式有「一般模式」欄位與可展開的「進階設定」（欄位清單依企劃書第六章，細節在 14 號文件） | 既有 API 參數 |
| R-22 | 任務頁：排隊／執行／完成／失敗、百分比、階段名稱、ETA、取消、重試、重新排序 | `/api/queue`、`/api/queue/cancel`、`/api/queue/reorder`、`/api/events`、`lib/progress-labels.js`、`public/progress-eta.js` |
| R-23 | 素材庫：圖／影／音、搜尋、收藏、下載、再次使用、刪除到可恢復垃圾桶、顯示參數／提示詞／模型／Seed | `/api/gallery`、`/api/item/:id`、`/api/items/download`、`/api/trash`、`likeRoute` |
| R-24 | 自訂工作流頁：說明、開啟 MCWW、最近使用的 MCWW 工作流、返回 Mix Studio | 新增 `/api/custom-workflows/*`、3301 代理 |
| R-25 | 設定頁：登入／PIN、遠端連線（區網 URL、Tailscale HTTPS 狀態與一鍵啟用）、模型安裝狀態、語言、進階模式入口 | `/api/settings`、`/api/mobile-access/enable-https`、`/api/dependencies/status` |
| R-26 | 繁體中文為簡易殼層預設語言，字串集中於 `public/simple/locales/zh-TW.json` | 新增 |
| R-27 | PWA：可加入 Android 主畫面；Tailscale HTTPS 下為 Secure Context | 既有 `manifest.webmanifest`、`service-worker.js`（簡易殼層需自己的 manifest） |
| R-28 | 登入：Owner 必須有 PIN；遠端一律要 PIN；暴力嘗試節流 | `lib/profiles.js` + 修補 |
| R-29 | 模型安裝：先掃描既有模型、對照清單、只裝第一版必要模型、顯示容量、可續傳、失敗不刪既有檔案 | `installer/model-discovery.js`、`lib/dependency-installer.js`、`lib/huggingface-download.js` |
| R-30 | 更新腳本：備份 → 抓 upstream → 合併 → 衝突即停 → 測試 → 重啟 | 新增 `scripts/zh/sync-upstream.ps1` |
| R-31 | 重開機自動恢復：開機自動啟動 Mix Studio 與 ComfyUI（含 MCWW），未完成任務可對帳 | `start.bat`、`lib/comfy-restart.js`、`public/job-reconciliation.js`、Windows 工作排程器 |

### 2.2 第一版不做（Out）

| 編號 | 不做 |
|---|---|
| R-40 | 不做多台 GPU 主機、不做多使用者權限系統（沿用 Mix Studio 的 owner + 一般 profile） |
| R-41 | 不把 MCWW 的輸出匯入 Mix Studio 素材庫（第二版考慮） |
| R-42 | 不翻譯原本 `/studio` 進階介面（維持英文），除非第一版驗收後另行排程 |
| R-43 | 不做任意 checkpoint 選擇器；「模型」= Mix Studio 既有引擎（Krea 2、Klein、Qwen、LTX 2.3/2.5、MiniMax H3、Wan 2.2…）；任意模型走 MCWW |
| R-44 | 不做 iOS 特化 |
| R-45 | 不重寫 Mix Studio 的 graph builders |

## 3. 非功能需求

| 編號 | 需求 | 驗收方式 |
|---|---|---|
| R-50 | 手機（Android Chrome，360×800 起）首頁首次載入 ≤ 2 秒（區網）；簡易殼層 JS ≤ 150 KB 未壓縮 | Lighthouse Mobile 或 DevTools 量測 |
| R-51 | 所有觸控目標 ≥ 44×44 px；字級 ≥ 14 px；單手可達的生成按鈕 | 14 號文件檢查表 |
| R-52 | 任務進度延遲 ≤ 2 秒（SSE） | 觀察 `/api/events` |
| R-53 | 斷線／背景切回後自動重連 SSE 並對帳任務狀態 | 手動測試 |
| R-54 | 主機重開機後 3 分鐘內服務自動恢復 | 18 號文件測試 15 |
| R-55 | 安全：15 號文件全部 S-項目通過 | 18 號文件測試 16～18 |
| R-56 | 可維護：`node --test` 全綠；自訂碼與上游碼分離；`git merge upstream/main` 不需手動解決 `server.js` 以外的衝突 | CI／腳本 |
| R-57 | 隱私：預設零對外連線（除 huggingface.co 模型下載、github.com 更新、tailscale 控制面） | 15 號文件 Telemetry 段的封包驗證 |
| R-58 | 資料安全：`data/` 每次更新前備份；刪除只進垃圾桶 | 既有 `backupDb`、`lib/deleted-media.js` |

## 4. 禁止事項

| 編號 | 禁止 |
|---|---|
| R-60 | 禁止從零建立另一套 PWA、FastAPI 後端、原生 App、雲端生成、以其他 UI 當主體 |
| R-61 | 禁止修改 MCWW 原始碼；禁止把 MCWW 程式碼複製進 Mix Studio |
| R-62 | 禁止 ComfyUI（8188）或 MCWW（7860）綁定 `0.0.0.0`；禁止在防火牆放行 8188 / 7860 |
| R-63 | 禁止手機端出現任何 `:8188`、`:7860` 的網址 |
| R-64 | 禁止 Tailscale Funnel、Gradio share、FRP 隧道；禁止 Gemini Spark 功能可被啟用 |
| R-65 | 禁止關閉登入、關閉檔案驗證、允許任意系統命令、允許任意 URL 下載或任意 Git repo 安裝 |
| R-66 | 禁止在 UI 或 server 加入提示詞黑名單、關鍵字封鎖、雲端 moderation |
| R-67 | 禁止大規模重構、重新命名既有檔案、修改 `AGENTS.md` 所述的 builder 慣例 |
| R-68 | 禁止刪除任何 LICENSE、NOTICE、版權標頭；禁止刪除使用者既有 ComfyUI 模型 |
| R-69 | 禁止 Codex 自行決定核心設計；規格未寫明者一律回報，不猜 |

## 5. 使用者操作流程

### 5.1 首次設定（主機端，一次）
1. 執行 `scripts/zh/install.ps1`（WP-00/01）：確認 Node ≥ 22、Git、ComfyUI 路徑、Tailscale；Fork 版 Mix Studio 放在 `D:\MixStudio\`（或使用者指定）。
2. 啟動 `start.bat` → 瀏覽器開 `http://localhost:3300/` → 簡易殼層要求**建立 Owner 並設定 PIN（≥ 6 碼）**，未設 PIN 不能進下一步。
3. 設定頁 → 遠端連線 → 顯示區網網址 + QR；若偵測到 Tailscale → 一鍵「啟用 HTTPS」（呼叫既有 `/api/mobile-access/enable-https` 與新增的 MCWW 8443 設定）。
4. 設定頁 → 模型 → 顯示掃描結果（已有／缺少／容量）→ 勾選「核心」安裝。

### 5.2 手機登入
- 區網：開 `http://<主機IP>:3300/` → 選 Owner → 輸入 PIN → 首頁。
- 外出：手機 Tailscale 連上 tailnet → 開 `https://<主機名>.<tailnet>.ts.net/` → 同上。
- 加入主畫面後以 PWA 開啟；Session 30 天；改 PIN 或「登出所有裝置」立即失效。

### 5.3 文生圖
首頁 → 文生圖 → 輸入提示詞 →（可選）負面提示詞、比例、品質、數量、風格、Seed → 生成 → 自動跳到任務頁看進度 → 完成後在素材庫。
API：`POST /api/generate` `{ mode:'t2i', prompt, negativePrompt, width, height, batch, seed, loras, steps, cfg… }`。

### 5.4 圖生圖
首頁 → 圖生圖 → 上傳圖片（`POST /api/upload`，回 `name`）→ 提示詞、修改強度、比例、品質、數量 → 生成。
API：`POST /api/generate` `{ mode:'edit', editEngine, refNames:[name], prompt, … }`；進階：遮罩（`maskImageName`）、外擴（`editOutpaint`）、多張參考圖。

### 5.5 文生影
首頁 → 文生影 → 提示詞、比例、秒數、品質、動態強度、（僅支援音訊的引擎顯示）音訊開關 → 生成。
API：`POST /api/animate` 不帶 `imageName`；引擎限 `ltx` / `ltx25` / `h3`（其餘引擎在此模式不可選）。

### 5.6 圖生影
首頁 → 圖生影 → 上傳首幀 → 動作提示詞、比例、秒數、動態強度、品質、音訊開關 → 生成。
API：`POST /api/animate` 帶 `imageName`；進階：`endImageName`、`driveVideoName`、`faceImageName`、`audioName`、LoRA、FPS、插幀、放大、長影片分段。

### 5.7 任務頁
列表（排隊中／執行中／已完成／失敗）→ 點任務看階段名稱、百分比、ETA → 取消 / 重試（重試 = 以相同參數重新送出）→ 長按拖曳重新排序（`/api/queue/reorder`）。

### 5.8 素材庫
網格 → 篩選（圖／影／音、收藏）→ 搜尋 → 點開：預覽、參數、提示詞、模型、Seed → 動作：收藏、下載、再次使用（把參數帶回對應模式）、刪除（進垃圾桶）→ 垃圾桶可還原。

### 5.9 自訂工作流
底部導航 → 自訂工作流 → 說明卡（如何把 ComfyUI 工作流存到 `user/default/workflows/mcww/` 並用 `<標籤:prompt:1>` 命名節點）→ 「開啟自訂工作流」（新分頁，網址由 server 算出，永遠是 3301 或 Tailscale 8443）→ 最近工作流清單（唯讀）→ 返回。
MCWW 未啟動時顯示原因與「啟動 ComfyUI」按鈕（owner）。

### 5.10 更新
主機端執行 `scripts/zh/sync-upstream.ps1` → 自動備份 `data/` → 合併 upstream → 有衝突就停並列出檔案 → 通過測試才重啟。App 內「更新」按鈕在 Fork 上會顯示「由腳本管理」。

## 6. 完成標準

第一版「完成」= 下列全部成立：

| 編號 | 標準 | 驗證 |
|---|---|---|
| C-01 | 18 號文件 20 項驗收測試全部通過 | 逐項紀錄 |
| C-02 | `node --test` 全綠（含新增 `test/zh-*.test.js`） | CI log |
| C-03 | 15 號文件安全清單全部勾選；`netstat -ano` 顯示 8188 與 7860 只在 127.0.0.1 | 截圖 |
| C-04 | 手機（區網 + 4G）完成四模式各一次生成並在素材庫看到結果 | 影片或截圖 |
| C-05 | 手機經 3301 / 8443 成功執行一個 MCWW 範例工作流 | 截圖 |
| C-06 | 24 小時內無對外連線（除白名單網域） | 防火牆／Wireshark 紀錄 |
| C-07 | 從乾淨 Fork 依 17 號文件 WP-00～WP-11 可重現安裝 | 重跑一次 |
| C-08 | 16 號文件列出的 LICENSE / NOTICE 檔案全部存在於交付物中 | 檔案清單 |
