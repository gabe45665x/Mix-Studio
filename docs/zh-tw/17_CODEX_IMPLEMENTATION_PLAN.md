# 17_CODEX_IMPLEMENTATION_PLAN.md — Codex 分階段實作計畫

> 唯一的執行順序來源。每個 WP 都可單獨閱讀，但**前置依賴未完成不得開始**。
> 檔案路徑與行號以 `12_SOURCE_CODE_MAP.md`（commit `bec3292`）為準；程式規格以 13、14、15 號為準；授權以 16 號為準；驗收以 18 號為準。

## CONFLICTS_FOUND

| # | 衝突 | 來源 | 保守處理 |
|---|---|---|---|
| 1 | WP 編號不一致：原企劃書與 `10_MASTER_REQUIREMENTS.md`、`11_ARCHITECTURE.md`、`13_MCWW_INTEGRATION_SPEC.md`、`15_SECURITY_SPEC.md` 引用**舊編號**（WP-02 繁中、WP-06 Proxy、WP-07 Tailscale、WP-08 安全、WP-09 模型、WP-13 更新…）；本任務書規定**新編號**（WP-00～WP-14） | 原企劃書 §十五 vs `CLAUDE_MISSING_SPECS_TASK.md` §3 | **本文件（新編號）為準**；下表為對照，Codex 讀到 10～15 號的舊編號時以此換算，不修改那些文件 |
| 2 | 企劃書要求先讀 SuperGrok 00～05 | 文件至今未提供 | WP-00 步驟 9 檢查是否已到位；WP-10 的模型清單在其到位前以 16 號 §6 暫定，**下載前必須過 Gate** |
| 3 | 15 號 S-03 提到「HOST 可設定，預設 0.0.0.0」；企劃書希望 ComfyUI 綁 loopback 但 Mix Studio 可監聽區網 | 一致，無衝突；僅提醒 WP-09 firewall 必須與之配套 | — |

舊 → 新編號對照：

| 舊（企劃書 / 10～15 號） | 新（本文件） |
|---|---|
| WP-00 環境與備份 | WP-00 |
| WP-01 原版基準安裝 | WP-01 |
| （無） | WP-02 安全 Git 工作分支 |
| WP-02 繁體中文 | WP-03 |
| WP-03 首頁簡化 + WP-04 四模式路由 | WP-04 + WP-05 |
| WP-05 MCWW Sidecar | WP-06（安裝）+ WP-07（代理） |
| WP-06 Proxy | WP-07 |
| WP-08 安全 | WP-08 |
| WP-07 Tailscale | WP-09 |
| WP-09 模型安裝 | WP-10 |
| （11 號 §11、15 號 S-71 的更新腳本） | WP-11 |
| WP-10 測試 | WP-12 |
| （無） | WP-13 Claude 審查 + 修正 |
| WP-11 文件與交付 | WP-14 |

## 0. 強制規則（每個 WP 都適用）

1. **WP-00 完成後停止**，等使用者確認才開始 WP-01。
2. **WP-01 原版 Smoke Test 不過，不可開始任何客製**（WP-03 以後）。
3. 大模型下載前先列出**新增容量**（每檔 HEAD 取 `Content-Length`／`x-linked-size`）與磁碟剩餘，過 Gate 才下載。
4. 不重複下載既有模型：`installer/model-discovery.js` 掃描到同檔名且大小相符者跳過（15 號 S-84）。
5. 不得全域 `pip upgrade`、`pip install -U` 整個環境；只 `pip install -r <MCWW>/requirements.txt` 進 ComfyUI 的 Python，並記錄 `pip freeze` 前後差異。
6. 不得 `taskkill /F /IM python.exe`（會殺掉所有 Python）；停止 ComfyUI 只允許：Mix Studio 既有 `restartComfy()` 流程，或以 `netstat -ano | findstr :8188` 取得**該 PID** 後 `taskkill /PID <pid>`。
7. 不得公開 8188；不得開 Tailscale Funnel；不得在防火牆放行 8188/7860。
8. 不得刪除既有 ComfyUI 資料（`models/`、`input/`、`output/`、`user/`、`custom_nodes/`）。
9. 不得重新啟用 Analytics；不得把 Prompt／圖片／影片傳第三方。
10. 不得自行更換主架構；規格未寫明 → 停下來在報告中列「待確認」，不猜。
11. 每個 WP 產出 `reports/WP-XX_<name>.md`（放 `docs/zh-tw/reports/`），含：做了什麼、改了哪些檔（`git diff --stat`）、測試結果、未確認事項、下一步需要的確認。
12. 每個 WP 開始前 `git status` 必須乾淨；結束時 commit（訊息 `WP-XX: <摘要>`）並在報告附 commit hash。
13. 所有新增 JS 檔頭加 SPDX（16 號 §3）；所有新增 `spawn/execFile` 禁 `shell:true`（15 號 S-60）。

---

## WP-00 環境盤點與備份

| 項目 | 內容 |
|---|---|
| 目標 | 完整記錄目標主機現況，做可回復備份；不改任何東西 |
| 前置依賴 | 無 |
| 允許修改 | 只建立 `docs/zh-tw/reports/WP-00_inventory.md` 與備份檔 |
| 禁止修改 | 任何程式、設定、模型、防火牆、Tailscale |
| 預期檔案 | `docs/zh-tw/reports/WP-00_inventory.md`；備份至使用者指定目錄（預設 `D:\MixStudio-backups\<日期>\`） |
| 執行步驟 | 1. `node -v`（需 ≥ 22）、`git --version`、`python --version`（系統）2. 找 ComfyUI：Desktop（`%LOCALAPPDATA%\Programs\Comfy Desktop`）／portable（`ComfyUI_windows_portable`）／git；記錄根目錄、`python_embeded` 或 `.venv` 路徑、ComfyUI 版本（`git -C <ComfyUI> log -1` 或 Desktop 設定）、前端版本 3. `custom_nodes/` 列表（資料夾名 + `git log -1` 若為 git）4. 模型清單：對 `models/**` 與 `extra_model_paths.yaml` 指向的目錄列 `名稱｜大小｜修改日期`（只讀）5. 磁碟剩餘（各磁碟）6. `netstat -ano \| findstr /R ":3300 :3301 :7860 :8188"` 7. `tailscale status --json`（若安裝）、`tailscale serve status --json`、`Get-NetConnectionProfile`、現有防火牆規則含 3300/3301/7860/8188 8. 既有 Mix Studio（若有）：路徑、`release.json`、`git remote -v`、`data/` 大小 9. 檢查 `docs/zh-tw/` 是否已有 SuperGrok 00～05；沒有 → 報告標示 10. 備份：`Compress-Archive` ComfyUI `user/`、`custom_nodes/`（不含 `.git`）、既有 Mix Studio `data/`；模型只記清單不複製；輸出 SHA256 清單 |
| 測試 | 備份 zip 可解壓、清單筆數與實際一致 |
| 完成條件 | 報告含以上 10 項；備份完成且路徑記錄在報告 |
| 回退 | 無需（未改動） |
| 產出報告 | `WP-00_inventory.md`：含「疑慮清單」（例：Node < 22、ComfyUI 已 `--listen 0.0.0.0`、7860 被占用、磁碟不足、Public 網路 profile） |
| Gate | **是。停止，等使用者確認報告並回答：ComfyUI 路徑正確？可用磁碟？是否允許下一步安裝？** |

## WP-01 官方 Mix Studio 基準安裝

| 項目 | 內容 |
|---|---|
| 目標 | 以**未修改**的官方 Mix Studio（commit `bec329225456846d8143f82f199d79f28ec0a04c`）跑通 Smoke Test |
| 前置依賴 | WP-00 Gate 通過 |
| 允許修改 | 新建 `D:\MixStudio\`（或使用者指定）；`data/settings.json`（由 UI 產生）；`data/` |
| 禁止修改 | 任何原始碼；ComfyUI 任何檔案；不安裝任何 custom node／模型（除非 WP-00 已批准 `image` 元件） |
| 預期檔案 | `D:\MixStudio\`（git clone）、`data/db.json`、`data/settings.json`、`data/auth_secret.txt` |
| 執行步驟 | 1. `git clone https://github.com/BlackMixture/Mix-Studio.git D:\MixStudio && git -C D:\MixStudio checkout bec3292` 2. 若 ComfyUI 未執行：以 Mix Studio 設定頁「Start ComfyUI」或使用者既有方式啟動，確認 `curl http://127.0.0.1:8188/system_stats` 200 3. `start.bat` → 開 `http://localhost:3300/` 4. 建立 Owner profile **並設 PIN** 5. 設定 › Generation setup → ComfyUI URL `http://127.0.0.1:8188` → 連線成功 6. `curl http://127.0.0.1:3300/api/setup/status` 記錄回應（去敏）7. 若 `image` 元件已存在（WP-00 掃描到 `krea2_turbo_fp8_scaled.safetensors` 等 3 檔）→ 在原介面 Create 產一張 512×512；否則 Smoke 只到步驟 6 8. 記錄 `data/settings.json` 去敏內容（去 `hfToken`） |
| 測試 | Smoke：UI 載入、`/api/me` 200、ComfyUI 連線綠燈、（可選）一張圖進 Library；`node --test` 在 repo 內全綠 |
| 完成條件 | Smoke 通過；`git status` 乾淨（`data/` 已 gitignore） |
| 回退 | 刪除 `D:\MixStudio\`；ComfyUI 未被改動 |
| 產出報告 | `WP-01_baseline.md`：Node 版本、Smoke 結果截圖、`node --test` 摘要、`/api/setup/status` 去敏 JSON |
| Gate | **是。Smoke 不過不可進 WP-03 以後；WP-02 可與修復同時進行但不得改碼。** |

## WP-02 安全 Git 工作分支

| 項目 | 內容 |
|---|---|
| 目標 | 建立 Fork 工作流：`origin`=使用者 Fork、`upstream`=官方；`zh-tw` 分支；基準 tag；防止密鑰進 git |
| 前置依賴 | WP-01（Smoke 通過或至少 clone 完成） |
| 允許修改 | `.git/config`、新增 `.gitattributes`（可選）、`docs/zh-tw/`、`.githooks/pre-commit`、`scripts/zh/git-setup.ps1` |
| 禁止修改 | 任何功能程式碼；`.gitignore` 只允許**追加**（不可移除既有 `data/` 等行） |
| 預期檔案 | `scripts/zh/git-setup.ps1`、`.githooks/pre-commit`、`docs/zh-tw/`（放入 09～18 號文件） |
| 執行步驟 | 1. 使用者在 GitHub Fork（Codex 不能代做）並提供 URL 2. `git remote rename origin upstream && git remote add origin <fork-url>` 3. `git tag baseline-bec3292 bec3292` 4. `git checkout -b zh-tw` 5. `.gitignore` 追加：`data/`、`*.env`、`.env`、`docs/zh-tw/reports/*.zip`、`backups/` 6. pre-commit hook：拒絕含 `hf_[A-Za-z0-9]{20,}`、`pinHash`、`auth_secret`、`ks_profile=` 的變更 7. `git config core.hooksPath .githooks` 8. 複製 09～18 號文件到 `docs/zh-tw/` 並 commit 9. `git push -u origin zh-tw --tags` |
| 測試 | `git remote -v` 正確；故意加一個含 `hf_xxxxxxxxxxxxxxxxxxxxxxxx` 的檔案 → commit 被 hook 拒絕 |
| 完成條件 | 分支、tag、hook、文件都在 Fork 上 |
| 回退 | `git checkout main`；`git remote` 還原 |
| 產出報告 | `WP-02_git.md`：remotes、tag、hook 測試結果 |
| Gate | 否（自動進 WP-03） |

## WP-03 zh-TW Locale 與自訂設定基礎

| 項目 | 內容 |
|---|---|
| 目標 | 建立殼層的語言檔、錯誤碼與進度階段對照、自訂設定檔存取 |
| 前置依賴 | WP-02 |
| 允許修改 | 新增 `public/simple/locales/zh-TW.json`、`public/simple/locales/en.json`、`public/simple/i18n.js`、`lib/zh/config.js`、`test/zh-locale.test.js`、`test/zh-config.test.js` |
| 禁止修改 | `server.js`、`public/app.js`、`public/index.html`（本 WP 不掛鉤） |
| 預期檔案 | 上列；`data/zh-tw.json`（執行期產生，預設值見 13 號 §10 第 3 項 + 15 號：`analytics.enabled:false`、`session.maxAgeDays:30`、`privacy.cloudLlmAcknowledged:false`） |
| 執行步驟 | 1. 依 14 號 §13 詞彙建 `zh-TW.json` 分區：`nav`、`home`、`fields`、`help`、`tasks`、`library`、`custom`、`settings`、`login`、`errors`（以 API `code` 為鍵，14 號 §12.8）、`stages`（鍵 = `lib/progress-labels.js` 的英文字串，值 = 繁中）2. `i18n.js`：`t(key, vars)`、缺鍵 `console.warn` + 回 `en.json` 或鍵名 3. `lib/zh/config.js`：`readZhConfig()`、`writeZhConfig(patch)`（原子寫入：先寫 `.tmp` 再 rename），schema 驗證，未知鍵丟棄 |
| 測試 | `test/zh-locale.test.js`：zh-TW 與 en 鍵集合相等；`stages` 涵蓋 `progress-labels.js` 內所有字串（用 require 抓取）；`test/zh-config.test.js`：預設值、非法值拒絕、原子寫入 |
| 完成條件 | `node --test` 全綠；zh-TW 鍵 ≥ 200 且無空值 |
| 回退 | 刪除新增檔案 |
| 產出報告 | `WP-03_locale.md`：鍵數、stages 覆蓋率 |
| Gate | 否 |

## WP-04 手機首頁與四模式 UI（簡易殼層）

| 項目 | 內容 |
|---|---|
| 目標 | 依 14 號建立 `public/simple/`，掛到 `/`，原介面移到 `/studio`；登入、五個 Tab、首頁、任務、素材庫、設定（自訂工作流頁先放狀態卡與說明，按鈕在 WP-07 接上） |
| 前置依賴 | WP-03 |
| 允許修改 | 新增 `public/simple/**`、`lib/zh/simple-capabilities.js`、`test/zh-simple-*.test.js`；`server.js` 三個掛鉤（皆加 `// [ZH-TW-CUSTOM]`）：(a) 主分派器 L12089 附近 `let p = url.pathname === '/' ? '/index.html' : url.pathname;` 改為 `/` → `public/simple/index.html`、`/studio` → `public/index.html`（其餘靜態不變；`public/simple/` 亦由既有 `safeMediaPath(PUBLIC,…)` 提供）；(b) `handleApi` 新增 `GET /api/simple/capabilities`、`POST /api/simple/analytics`（owner，寫 `data/zh-tw.json`）；(c) `service-worker.js` 既有 scope `/` 的 navigate 攔截需排除 `/simple/`？→ 不需要（殼層自帶 `sw.js` 註冊在 scope `/simple/`，原 SW 只在 `/studio` 由 `pwa.js` 註冊，Codex 需確認 `pwa.js` L27 的註冊只在原 index.html 觸發） |
| 禁止修改 | `public/app.js`、`public/style.css`、`public/index.html` 內容（只改它的「掛載路徑」）；任何 builder |
| 預期檔案 | `public/simple/index.html`、`app.js`（路由、狀態、SSE）、`views/*.js`（home/tasks/library/custom/settings/login）、`payloads.js`（WP-05 填）、`style.css`、`sw.js`、`manifest.webmanifest`、`offline.html`、`icons/`；`lib/zh/simple-capabilities.js`（呼叫 `availableComponents()`、`h3*Compatibility`、`ltx25Compatibility` 等既有函式，輸出 `{engines:{image:{installed,turbo,raw}, edit:{klein4,klein9,qwen,krea2ref,krea2remix}, video:{ltx,ltx25,ltx25quality,h3,h3turbo,wan}}, features:{upscale,rife,faceid,h3context,ltxcamera,outpaint,depth,style}, limits:{ltxMaxSeconds:20, ltx25MaxSeconds:20, h3Min:5, h3Max:15}}`，不含任何路徑或 URL） |
| 執行步驟 | 1. 骨架與路由（hash）2. 登入頁（14 號 §11）3. 首頁（§3）含四模式表單（欄位依 §5，送出先接 WP-05 的 payloads.js stub）4. 任務頁（§7）含 SSE 重連 5. 素材庫（§8）含檢視器、垃圾桶 6. 設定（§10）7. 自訂工作流頁狀態卡（§9，開啟按鈕暫停用）8. PWA（manifest、sw 只快取殼層）9. 深色／純黑 token 10. 無障礙：所有互動元件 `aria-label`、焦點可見 |
| 測試 | `test/zh-simple-routes.test.js`（`/` 回 simple、`/studio` 回原 index、`/api/simple/capabilities` 不含 `8188`/`comfyUrl`/磁碟路徑）；手機實測（Android Chrome，區網）：14 號 §14 檢查表 |
| 完成條件 | 14 號 §14 全勾；`node --test` 全綠；原介面 `/studio` 功能不變（抽測 Create/Edit/Video/Library 各一項） |
| 回退 | `git revert` 本 WP commits；`/` 回到原 index |
| 產出報告 | `WP-04_ui.md`：截圖（登入、首頁四模式、任務、素材庫、設定）、Lighthouse Mobile 分數、未實作欄位清單 |
| Gate | **是。使用者在手機（區網）實際操作後確認 UI 方向，才進 WP-05。** |

## WP-05 四模式參數映射

| 項目 | 內容 |
|---|---|
| 目標 | 把 14 號 §5 的欄位→參數表實作為純函式，並以能力清單控制欄位顯示；再次使用／重試 |
| 前置依賴 | WP-04 Gate |
| 允許修改 | `public/simple/payloads.js`、`public/simple/views/home.js`、`public/simple/reuse.js`、`test/zh-simple-payload.test.js` |
| 禁止修改 | `server.js` 生成路由（`/api/generate`、`/api/animate`）、任何 builder；不得新增引擎參數 |
| 預期檔案 | 上列 |
| 執行步驟 | 1. `buildT2IPayload(form, caps)`、`buildImg2ImgPayload`、`buildT2VPayload`、`buildI2VPayload` 依 14 號 §5.1–§5.4 表 2. 比例→尺寸表（§5.1）；影片尺寸對照 `public/app.js` `renderVideo()` L14511 既有表（**只讀取對照，不引用 app.js**；若既有表與 14 號不同，以既有為準並在報告列出）3. 品質映射（含元件缺席時降級與提示）4. 動態強度 → `promptTemplate` 片語（§5.3）5. 引擎選擇與退回順序（t2v：ltx25→ltx→h3；i2v：ltx25→ltx→h3→wan）6. 「再次使用」：從 gallery item 的 `params` 還原表單（欄位不存在時略過）7. 「重試」：`localStorage simple.jobs.<pid>` 保存送出 payload 30 天 8. 待確認項寫入報告：`/api/queue` 是否含 `params`；`audioName` 對應欄位；Wan 秒數常數；`computeDims()` 差異 |
| 測試 | `test/zh-simple-payload.test.js`：每模式 × 每品質 × 有/無元件 的 payload 快照；確認沒有未定義鍵、沒有 `width/height` 超出 64–4096、t2v 不帶 `imageName`、非 ltx/ltx25/h3 引擎不出現在 t2v；手機實測四模式各一次（用 WP-01/10 已有的模型） |
| 完成條件 | 四模式在手機各成功生成一次並進素材庫；快照測試全綠 |
| 回退 | `git revert` |
| 產出報告 | `WP-05_mapping.md`：實際送出的 payload 範例（去提示詞）、與 `/studio` 送出相同參數的結果比對（同 seed 同圖） |
| Gate | 否 |

## WP-06 MCWW 安裝與驗證

| 項目 | 內容 |
|---|---|
| 目標 | 依 13 號 §1 安裝 MCWW（釘 `1f65c75`），只綁 127.0.0.1:7860，MCWW 自身可用 |
| 前置依賴 | WP-01；WP-00 報告確認 ComfyUI Python 路徑 |
| 允許修改 | 新增 `scripts/zh/setup-mcww.ps1`；ComfyUI `custom_nodes/Minimalistic-Comfy-Wrapper-WebUI/`（新 clone）與其 `.env`；`ComfyUI/user/default/workflows/mcww/`（新資料夾 + 範例複本）；`ComfyUI/temp/mcww/` |
| 禁止修改 | MCWW 任何原始碼；ComfyUI 核心；ComfyUI 既有 custom nodes；不得 `pip upgrade` 其他套件 |
| 預期檔案 | 13 號 §1.1、§1.2 |
| 執行步驟 | 1. `pip freeze > reports/WP-06_pip_before.txt`（ComfyUI 的 python）2. 執行 `setup-mcww.ps1`（clone、checkout、`pip install -r requirements.txt`、寫 `.env`、建資料夾）3. `pip freeze > WP-06_pip_after.txt`，diff 列入報告；若 diff 涉及 ComfyUI 既有套件**降版**→ 停，報告，等確認 4. 重啟 ComfyUI（規則 6）5. 驗證 13 號 §1.1 四項 6. 複製 `example_workflows/extract audio MCWW.json` 與一個 T2V 範例到 `workflows/mcww/`（只複製 json；模型不一定存在，僅供 UI 顯示）7. 主機本機開 `http://127.0.0.1:7860/`：能列出工作流、UI 標題為「自訂工作流」 |
| 測試 | `netstat` 只見 `127.0.0.1:7860`；`curl http://127.0.0.1:8188/mcww/available_at`；從另一台裝置 `curl http://<LAN>:7860/` 失敗 |
| 完成條件 | 上述測試通過；ComfyUI console 無新 error |
| 回退 | 刪 `custom_nodes/Minimalistic-Comfy-Wrapper-WebUI/`；`pip uninstall` diff 中新增的套件（只移除新增，不動既有）；重啟 ComfyUI |
| 產出報告 | `WP-06_mcww.md`：pip diff、驗證輸出、範例工作流清單 |
| Gate | 否（但 pip diff 有降版時自動變成 Gate） |

## WP-07 MCWW Sidecar / Proxy

| 項目 | 內容 |
|---|---|
| 目標 | 依 13 號 §3–§10 實作 3301 認證代理、狀態 API、自訂工作流頁接線 |
| 前置依賴 | WP-04、WP-06 |
| 允許修改 | 新增 `lib/zh/mcww-proxy.js`、`lib/zh/mcww-status.js`、`test/zh-mcww-proxy.test.js`、`scripts/zh/verify-ports.ps1`；`server.js` 掛鉤：`listen` 後建立 listener B；`handleApi` 新增 13 號 §9 五條路由；主分派器新增 `/custom-workflows/open`；`public/simple/views/custom.js` 接上按鈕與狀態 |
| 禁止修改 | MCWW；`public/app.js`；代理不得改寫路徑、不得放寬 `allowed_paths`、不得加 CORS |
| 預期檔案 | 13 號 §10 清單 |
| 執行步驟 | 1. 依 13 號 §3.3 骨架實作 `createMcwwProxy`（含 upgrade 直通、SSE 不緩衝、413、拒絕清單、cookie 剝離、X-Forwarded-*）2. `mcww-status.js`：`probeMcww`、`openUrlFor`、`listRecentWorkflows`（路徑固定 `RUNTIME.comfy.path/user/default/workflows/mcww`；`RUNTIME.comfy.path` 為空時回「未設定 ComfyUI 路徑」）、`mcwwTailscaleStatus` 3. server.js 掛鉤（`MIXBOX_MCWW_PROXY_PORT` 預設 3301，`HOST` 同 listener A）4. 錯誤回退頁（13 號 §6，zh-TW）5. 殼層自訂工作流頁接線 6. `verify-ports.ps1` |
| 測試 | `test/zh-mcww-proxy.test.js`（13 號 §10 第 9 項全部案例，以假上游）；手機區網實測 13 號 §11 第 1、2、5、6 項 |
| 完成條件 | 手機經 3301 跑完一個範例工作流（需該工作流模型存在；若無，以 `extract audio` 範例 + 一段小影片驗證）；測試全綠 |
| 回退 | `git revert`；3301 不再監聽 |
| 產出報告 | `WP-07_proxy.md`：測試輸出、手機截圖、`GET /config` 經 3301 的 `root` 值（證明 X-Forwarded-Host 生效） |
| Gate | 否 |

## WP-08 Auth / Session / Upload / Proxy 安全

| 項目 | 內容 |
|---|---|
| 目標 | 落實 15 號 §1–§11、§14 全部 S-項目 |
| 前置依賴 | WP-04（殼層）、WP-07（3301 需共用 trusted-local 與 session） |
| 允許修改 | 新增 `lib/zh/trusted-local.js`、`session-v2.js`、`pin-policy.js`、`upload-guard.js`、`security-headers.js`、對應 `test/zh-*.test.js`；`server.js` 指定行：`currentProfile` L916、`isLoopbackRequest` 使用點 L916/L7011/L7024、登入 L7046–L7071、建立 profile L7024、`profileCookie` L930、cookie 簽發 6 處（15 號 §2）、`handleApi` 開頭（CSRF、owner PIN 閘門）、主分派器 L12027（安全標頭）、`/mcp/` 分派 L12030（404）、`/api/spark-access/enable` L7406（403）、`/api/upload` L8228 前插入 upload-guard、`/api/queue/reset` L11117（isAdmin）、`/api/input` L8176（名稱規則）、`/api/settings` GET L7707（非本機過濾 `comfyUrl`/`comfy.path`）、`/api/analytics-config` L6990、`lib/runtime-config.js` L92–L110（opt-in）、`comfyFetch` 啟動斷言（L1461 附近或啟動段）、`console.error('[error]'` L12098（脫敏）、`[prompt-revise]` L3753 |
| 禁止修改 | 生成 builder；`lib/profiles.js` 既有函式簽章（只新增）；不得移除既有節流 |
| 預期檔案 | 上列 |
| 執行步驟 | 依 15 號各節順序：§1 登入 → §2 Session → §3 CSRF → §5 標頭（先 Report-Only 24h，再轉正式）→ §6 Upload → §7 Proxy 補強 → §8 命令白名單斷言 → §10 模型下載 sha256/續傳（若 WP-10 先做則在 WP-10）→ §11 Telemetry → §13 Spark 停用 → §14 日誌 |
| 測試 | 每節的「驗證」小節 + 15 號 §15 清單；`node --test` 全綠；`/studio` 在正式 CSP 下抽測 10 個功能無 console 違規 |
| 完成條件 | 15 號 §15 全勾；報告附每項證據 |
| 回退 | `git revert`（分節 commit，可逐節回退） |
| 產出報告 | `WP-08_security.md`：S-01～S-114 逐項狀態（Done / N/A / 待確認 + 原因） |
| Gate | **是。CSP 轉正式前，使用者確認 `/studio` 常用功能未受影響。** |

## WP-09 Tailscale / LAN / Windows Firewall

| 項目 | 內容 |
|---|---|
| 目標 | 區網與外出連線都可用且只開該開的門 |
| 前置依賴 | WP-07、WP-08 |
| 允許修改 | 新增 `scripts/zh/firewall.ps1`、`scripts/zh/tailscale-mcww.ps1`；`server.js` `listen` 改讀 `MIXBOX_HOST`（預設 `0.0.0.0`）；`start.bat` 加環境變數（可選） |
| 禁止修改 | 不關防火牆、不放行 8188/7860、不用 Funnel、不改路由器 |
| 預期檔案 | 15 號 §12 腳本；11 號 §6 |
| 執行步驟 | 1. 執行 `firewall.ps1`（需管理員；**先給使用者看內容**）2. 確認網路 profile 為 Private 3. 手機區網開 `http://<LAN>:3300/` 與 `:3301/` 4. Tailscale：確認主機與手機同 tailnet、MagicDNS、HTTPS 已在 admin console 啟用 5. Mix Studio 設定 › 連線 › 啟用 HTTPS（既有 `/api/mobile-access/enable-https`）6. `tailscale-mcww.ps1` 或殼層按鈕（`/api/custom-workflows/enable-https`）7. `tailscale serve status --json` 存檔 8. 手機關 Wi-Fi 用 4G：`https://<host>.<tailnet>.ts.net/` 與 `:8443/` 9. `verify-ports.ps1` |
| 測試 | 18 號 B 組全部；`curl` 從另一台裝置打 8188/7860 失敗；`serve status` 無 Funnel |
| 完成條件 | 區網 + 4G 兩種路徑都能登入、生成、開自訂工作流 |
| 回退 | `firewall.ps1 -Remove`；`tailscale serve --https=8443 off`（Mix Studio 的 443 由使用者決定是否保留） |
| 產出報告 | `WP-09_network.md`：`serve status` JSON、防火牆規則清單、手機 4G 截圖、`verify-ports` 輸出 |
| Gate | **是。執行防火牆腳本與 `tailscale serve` 前需使用者同意（需管理員權限）。** |

## WP-10 模型與工作流

| 項目 | 內容 |
|---|---|
| 目標 | 依 16 號 §5–§6 與 15 號 §10：只裝核心、先列容量、不重複、驗 hash、記錄授權；MCWW 範例工作流可跑 |
| 前置依賴 | WP-01（掃描能力）、WP-08 §10（sha256/續傳）；SuperGrok `02`/`04` 若到位則先比對 |
| 允許修改 | `lib/dependency-installer.js` **只允許**：`MODEL_ASSETS` 加 `sha256`/`bytes` 欄位（值由下載前 HEAD/LFS 指標取得）；新增 `lib/zh/model-license-capture.js`、`scripts/zh/model-report.ps1`；`docs/zh-tw/MODEL_LICENSES.md`、`THIRD_PARTY_LICENSES.md`、`licenses/`；ComfyUI `user/default/workflows/mcww/*.json` |
| 禁止修改 | 刪除或搬移任何既有模型；改 `NODE_PACKS` 的 `ref`；下載清單以外的檔案 |
| 預期檔案 | 上列 |
| 執行步驟 | 1. `discoverModels`（`installer/model-discovery.js`）掃描 + `extra_model_paths.yaml` → `reports/WP-10_existing_models.md` 2. 對照 16 號 §6 核心清單（或 SuperGrok 02）→ 列「已有／缺少」3. 對缺少檔案逐一 `HEAD https://huggingface.co/<repo>/resolve/main/<file>`（含 token 若 gated）取 `x-linked-size`/`Content-Length`，加總 → 報告「新增容量 vs 磁碟剩餘」4. **Gate**：使用者批准後才下載 5. 下載（既有 `installComponents` 或 `acceleratedHuggingFaceDownload`）→ sha256 比對（LFS 指標 `oid`）6. 每檔抓模型卡 license metadata 與 LICENSE 檔到 `docs/zh-tw/licenses/models/<repo>/` 7. 填 `MODEL_LICENSES.md`；「無 LICENSE」的兩個 node repo 加風險標示到 `THIRD_PARTY_LICENSES.md` 8. MCWW：放入一個能用核心模型跑的簡單工作流（例如 LTX 2.5 T2V 或 Krea 2 T2I，以 `<提示詞:prompt:1>` `<輸出:output:1>` 標題）到 `workflows/mcww/` 9. 驗證四模式在殼層可用 |
| 測試 | 18 號 O 組；每個下載檔 sha256 一致；`discoverModels` 再跑一次不會標記重複下載 |
| 完成條件 | 核心元件在 `/api/dependencies/status` 為 installed；授權文件齊全；磁碟剩餘 ≥ 10% |
| 回退 | 只刪除本 WP 下載的檔案（清單在報告）；既有模型不動 |
| 產出報告 | `WP-10_models.md`：已有／新增／跳過清單、容量、hash、授權摘要、與 SuperGrok 02/04 的差異（若已到位） |
| Gate | **是（兩次）：下載前列容量待批准；有「授權待確認／高風險」元件要裝時再批准。** |

## WP-11 Windows 啟停 / 修復 / 更新腳本

| 項目 | 內容 |
|---|---|
| 目標 | 重開機自動恢復、不重複開程序、安全停止、備份、同步上游、日誌輪替 |
| 前置依賴 | WP-08、WP-09 |
| 允許修改 | 新增 `scripts/zh/start.ps1`、`stop.ps1`、`status.ps1`、`repair.ps1`、`backup-data.ps1`、`sync-upstream.ps1`、`register-task.ps1`、`logrotate.ps1`；`start.bat` 可包一層呼叫（不改其重啟邏輯 exit 75） |
| 禁止修改 | `lib/app-update.js`（內建更新維持拒絕 Fork）；不得用 `taskkill /IM` |
| 預期檔案 | 上列；工作排程器任務 `MixStudio-zh`（登入時觸發，延遲 30 秒，失敗 1 分鐘後重試 3 次） |
| 執行步驟 | 1. `start.ps1`：若 3300 已有監聽且 `/api/setup/status` 200 → 不重複啟動；否則 `start.bat`；ComfyUI 由 Mix Studio 既有自動啟動或 `POST /api/comfy/start` 2. `stop.ps1`：先 `GET /api/queue` 確認閒置（或 `-Force` 參數需明確）→ 以 3300 PID 停 node → ComfyUI 以 8188 PID 停（規則 6）3. `status.ps1`：ports、版本、佇列、Tailscale、防火牆 4. `repair.ps1`：`node --check server.js`、`node --test`、`data/backups/` 最新 db 還原（互動確認）、清 `.tmp` 5. `backup-data.ps1`：zip `data/`（可排除 images/videos）+ MCWW `storage/` + `workflows/mcww/` 到第二路徑，保留 14 份 6. `sync-upstream.ps1`：15 號 S-71 七步 7. `register-task.ps1` 8. `logrotate.ps1`（15 號 S-113） |
| 測試 | 18 號 A、N 組；重開機 3 分鐘內 `/api/setup/status` 200；連按兩次 `start.ps1` 只有一個 node 程序；`sync-upstream.ps1` 在人為製造衝突（改 `server.js` 一行後 fetch 一個修改同區的假 commit）時停止並還原 |
| 完成條件 | 上述測試通過 |
| 回退 | 刪除排程任務；刪除腳本 |
| 產出報告 | `WP-11_ops.md`：各腳本輸出樣本、重開機測試時間 |
| Gate | 否 |

## WP-12 驗收測試

| 項目 | 內容 |
|---|---|
| 目標 | 依 `18_ACCEPTANCE_TESTS.md` 全部執行並留證據 |
| 前置依賴 | WP-03～WP-11 全部完成 |
| 允許修改 | 只允許 `docs/zh-tw/reports/WP-12_acceptance.md` 與 `evidence/`；發現缺陷 → 記錄，不在本 WP 修（進 WP-13） |
| 禁止修改 | 程式 |
| 執行步驟 | 依 18 號 A→P 順序；每案填 Pass/Fail/N/A + 證據路徑；P 組只記實測值 |
| 測試 | 18 號全部 |
| 完成條件 | 所有 Blocker=Yes 的案例 Pass；非 Blocker 的 Fail 列入 WP-13 |
| 回退 | 無 |
| 產出報告 | `WP-12_acceptance.md` + `evidence/`（截圖、log、netstat、serve status、Network log HAR 去敏） |
| Gate | **是。有 Blocker Fail 不得進 WP-14；先進 WP-13。** |

## WP-13 Claude 最終審查 + Codex 修正

| 項目 | 內容 |
|---|---|
| 目標 | Claude 依 10～18 號審查 diff 與報告；Codex 修正；直到無 Blocker |
| 前置依賴 | WP-12 |
| 允許修改 | 審查指出的檔案；每輪修正一個 commit |
| 禁止修改 | 架構決策；未經審查要求的重構 |
| 執行步驟 | 1. Codex 產出 `git diff baseline-bec3292..zh-tw --stat` 與完整 diff（`reports/WP-13_diff.patch`）、所有 WP 報告索引 2. 交 Claude 審查（安全 15 號逐項、授權 16 號、UI 14 號、規格偏差）3. Claude 回 `19_REVIEW_ROUND_<n>.md`（Blocker / Major / Minor）4. Codex 修 Blocker+Major，重跑受影響的 18 號案例 5. 迴圈直到 Blocker=0 |
| 測試 | 受影響案例重測；`node --test` 全綠 |
| 完成條件 | Claude 出具「可交付」結論 |
| 回退 | 每輪 commit 可單獨 revert |
| 產出報告 | `WP-13_review_round_<n>.md` |
| Gate | **是。使用者看過 Claude 結論後決定交付。** |

## WP-14 最終交付與回退

| 項目 | 內容 |
|---|---|
| 目標 | 打 tag、交付清單、回退手冊、交接文件 |
| 前置依賴 | WP-13 Gate |
| 允許修改 | `docs/zh-tw/HANDOVER.md`、`ROLLBACK.md`、`CHANGELOG-zh-tw.md`、git tag |
| 禁止修改 | 程式 |
| 執行步驟 | 1. `git tag v1.0-zh-tw && git push origin --tags` 2. `HANDOVER.md`：啟動／停止／更新／備份／還原／常見問題、所有 URL（區網、Tailscale）、擁有者 PIN 重設方法（刪 `data/db.json` 中 `pinHash`+`pinSalt` 需先備份）3. `ROLLBACK.md`：(a) 程式回退 `git checkout baseline-bec3292`（或 `main`），`data/` 相容（session v2 → v1 只需重新登入）(b) 網路回退：`firewall.ps1 -Remove`、`tailscale serve --https=8443 off`（c) MCWW 移除：刪 custom node 目錄與 `.env`、pip 只移除 WP-06 新增套件 (d) 資料還原：`backup-data.ps1 -Restore <zip>` 4. 交付清單：Fork URL、tag、報告索引、授權文件、`MODEL_LICENSES.md`、備份位置 5. 最後一次 `verify-ports.ps1` 與 18 號 B/L/M 三組快速重跑 |
| 測試 | 在乾淨資料夾 `git clone <fork> -b v1.0-zh-tw` + 依 HANDOVER 啟動 → Smoke 通過（10 號 C-07） |
| 完成條件 | 10 號 §6 C-01～C-08 全部成立 |
| 回退 | `ROLLBACK.md` 已驗證可用（實際跑一次 (a)+(d) 再還原） |
| 產出報告 | `WP-14_delivery.md` |
| Gate | 是（交付確認） |

---

## 附錄 A：`server.js` 掛鉤點總表（避免多個 WP 互相衝突）

| 位置（bec3292 行號） | 內容 | WP |
|---|---|---|
| L1–L10 require 區之後 | `const zh = require('./lib/zh/config');` 等 | 03/04 |
| L431 `PORT` 之後 | `const HOST = process.env.MIXBOX_HOST \|\| '0.0.0.0'; const MCWW_PROXY_PORT = …` | 09/07 |
| L916 `currentProfile` | `isTrustedLocalRequest`、session v2 解析 | 08 |
| L930 `profileCookie` | `secure` 參數 | 08 |
| L1461 `comfyFetch` 附近／啟動段 | comfyUrl loopback 斷言 | 08 |
| L6990 `/api/analytics-config` | opt-in | 08 |
| L6987 `handleApi` 開頭 | CSRF、owner-PIN 閘門、`/api/simple/*`、`/api/custom-workflows/*`、`/api/logout-all` | 04/07/08 |
| L7024/L7046/L7094 profile 路由 | PIN 政策、遠端需 PIN、sessionVersion | 08 |
| L7406 `/api/spark-access/enable` | 403 | 08 |
| L7707 `/api/settings` GET | 非本機過濾 | 08 |
| L8176 `/api/input` | 名稱規則 | 08 |
| L8228 `/api/upload` | upload-guard | 08 |
| L11117 `/api/queue/reset` | isAdmin | 08 |
| L12027 主分派器開頭 | 安全標頭；`/mcp/` → 404 | 08 |
| L12089 靜態路由 | `/` → simple、`/studio` → 原、`/custom-workflows/open` | 04/07 |
| L12098 `[error]` log | 脫敏 | 08 |
| L12162 `server.listen` | `HOST`；之後建立 listener B | 09/07 |

每個掛鉤都以 `// [ZH-TW-CUSTOM] WP-XX begin` / `end` 包住，方便 `sync-upstream.ps1` 衝突時定位。
