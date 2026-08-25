# 12_SOURCE_CODE_MAP.md — Mix Studio 與 MCWW 原始碼定位

> 狀態：已實際 clone 並閱讀原始碼（非憑印象）。所有行號以下列 commit 為準。
> Codex 開工前必須先 `git rev-parse HEAD` 核對；若 commit 不同，改以本文件的「函式／常數名稱」grep 定位，不要信任行號。

| 專案 | Repo | Commit（審查基準） | 版本 | 授權 |
|---|---|---|---|---|
| Mix Studio | https://github.com/BlackMixture/Mix-Studio | `bec329225456846d8143f82f199d79f28ec0a04c`（2026-08-21） | release.json `1.2.4` | **GPL-3.0** |
| MCWW | https://github.com/light-and-ray/Minimalistic-Comfy-Wrapper-WebUI | `1f65c75b96a1eccec906ac3b613906752bc569a6`（2026-08-23） | pyproject `2.4.4` | **AGPL-3.0** |
| Gradio（MCWW 依賴） | pinned by MCWW `requirements.txt` | — | `5.49.1` | Apache-2.0 |

---

## A. Mix Studio 總覽（先看這段）

- **零依賴 Node.js（≥22）**：沒有 `package.json`、沒有 npm、沒有 build step、沒有框架。`server.js` 用原生 `http` 模組。
- **單一超大檔案**：`server.js` 12,178 行（路由 + ComfyUI graph builders + job 追蹤 + SSE）；`public/app.js` 38,437 行；`public/index.html` 3,815 行；`public/style.css` 16,578 行。
- **沒有任何 i18n 系統**（grep `i18n|locale|data-i18n|translations` 為零命中）。所有 UI 字串直接寫死在 `index.html` 與 `app.js`。→ WP-02 繁中必須自建 locale 層。
- **模型是「引擎」而非任意 checkpoint**：Create 固定用 Krea 2、Edit 用 Klein / Qwen / Krea 2、Video 用 LTX 2.3 / 2.5 / MiniMax H3 / Wan 2.2 / SCAIL 2 / 10Eros。不是「選一個 safetensors」的通用 UI。→ WP-09 與 SuperGrok 模型矩陣必須對照 `lib/dependency-installer.js` 的 `COMPONENTS`。
- 測試：`node --test`（`test/*.test.js`，node:test），`AGENTS.md` 明言必須保持綠燈。
- 使用者資料在 `data/`（gitignored）：`db.json`、`settings.json`、`auth_secret.txt`、`images/`、`videos/`、`inputs/`、`backups/`、`trash/`。

### A1. 前端入口

| 項目 | 檔案 | 定位 |
|---|---|---|
| HTML 殼 | `public/index.html` | 抽屜導航 `<nav class="app-drawer-nav">` L68；Create 三子模式 `data-drawer-create-mode="image|region|video"` L74–L86；`data-drawer-view="edit"`、`"gallery"` L88–L95 |
| 主程式 | `public/app.js` | 全域 `const state =` L36；`async function api(` L497（非 2xx 拋錯，401 `code:'auth'` 自動開 profile gate）；`function formKey` L3128（每 profile 表單狀態存 localStorage）；`function setView` L5650（view 值：`create` / `edit` / `video` / `gallery`）；`connectEvents()` L22405（`new EventSource('/api/events')`）；文生圖送出 `generationApi('/api/generate', …)` L21645；影片送出 `api('/api/animate', …)` L28890；`renderQueue` L21776；`renderVideo` L14511 |
| 開機順序 | `public/app.js` 檔尾 | 最後 25 行：`markEngineRow → computeDims → renderAspects → renderDims → renderLoras → renderRefs → setView(state.view, …)` |
| PWA | `public/manifest.webmanifest`、`public/pwa.js`（`serviceWorker.register('/service-worker.js', { scope: '/' })` L27）、`public/service-worker.js`（只攔截 `mode === 'navigate'` 的 GET，離線回 `/offline.html`，L28–L31）、`public/offline.html` | 注意：SW scope 是整個 origin `/` |
| 其他前端模組 | `public/analytics.js`（PostHog 載入）、`public/progress-eta.js`、`public/job-reconciliation.js`、`public/qrcodegen.js`（手機 QR）、`public/h3-prompt-guide.js`、`public/mask-boxes.js`、`public/release-notes.js` | |

### A2. Server 入口與 Router

| 項目 | 檔案:行 | 內容 |
|---|---|---|
| 進入點 | `server.js` L1–L10 | `#!/usr/bin/env node`，`http.createServer` |
| Port | `server.js` L431 | `const PORT = Number(process.env.PORT || 3300)` |
| 綁定位址 | `server.js` L12162 | `server.listen(PORT, '0.0.0.0', …)` ← **寫死 0.0.0.0，所有介面** |
| 主分派器 | `server.js` L12027–L12111 | 順序：`/mcp/` → `handleSparkMcp`；`/api/` → `handleApi`；`/images/`、`/video-previews/`、`/videos/`、`/faces/`（需 profile）；`/avatars/`、`/lorathumbs/`（不需登入）；其餘 → `public/` 靜態檔（`safeMediaPath(PUBLIC, …)`，不需登入） |
| API 分派器 | `server.js` L6987 `async function handleApi(req, res, url)` | 用一長串 `if (route === '/api/xxx' && req.method === …)`，共 92 條精確路由 + 約 20 條 regex 路由（`profLogin` L7046、`profMan` L7094、`itemRoute` L11647 …） |
| 全域登入閘門 | `server.js` L7171 | `return json(res, 401, { error: 'Sign in to continue', code: 'auth' })` — 在 profile 相關路由之後、其他 API 之前 |
| 工具函式 | `server.js` | `json()` L6437、`readJsonBody()` L6465、`serveFile()` L6479、`safeMediaPath()` L6564（路徑穿越防護） |
| 資料目錄常數 | `server.js` L417–L471 | `PUBLIC` L417、`RUNTIME` L422、`DATA` L424、`IMAGES` L425、`VIDEOS` L426、`INPUTS` L428、`SETTINGS_FILE` L471、`DB_FILE` L745、`AUTH_SECRET_FILE` L853 |
| 重啟機制 | `server.js` L12112–L12160 | `launchDetachedReplacement()`、`scheduleServerRestart()`，exit code 75 → `start.bat` 重啟 |
| 沒有的東西 | — | **沒有 `server.on('upgrade')`**（Mix Studio 本身不接受瀏覽器 WebSocket，只用 SSE）；**沒有 CSP / X-Frame-Options / Referrer-Policy**（只有 L10308 一處 `X-Content-Type-Options`）；**沒有 Origin/CSRF 檢查**（只有 `/mcp/` L11975 檢查 Origin） |

### A3. Auth / Profiles / Session

| 項目 | 檔案:行 | 內容 |
|---|---|---|
| PIN 雜湊 | `lib/profiles.js` `hashPin()` L8–L18 | scrypt N=2^14, r=8, p=1，`scrypt$` 前綴；舊資料 sha256 legacy 自動升級（`server.js` L7063–L7068） |
| PIN 驗證 | `lib/profiles.js` `verifyPin()` L19–L34 | `timingSafeEqual`；**沒有 pinHash 的 profile 任何 PIN 都回 true**（open profile） |
| Cookie 簽章 | `lib/profiles.js` `signProfileId()` L35、`parseProfileToken()` L39 | token = `profileId.HMAC-SHA256(id).slice(0,24)`，**無時效、無亂數 session id、無法個別撤銷** |
| Cookie 屬性 | `server.js` `profileCookie()` L930 | `ks_profile=…; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` — **沒有 `Secure`** |
| 私密資料夾 cookie | `server.js` `privateCookie()` L770，`/api/private/unlock` L11150 | 12 小時 |
| AUTH_SECRET | `server.js` L853–L865 | 讀 `data/auth_secret.txt`，不存在則 `randomBytes(24)` |
| 目前 profile 判定 | `server.js` `currentProfile()` L916–L928 | 先解 cookie；**沒有 cookie 且請求來自 loopback 時，自動落到唯一的無 PIN profile**（`defaultOpenProfile` + `isLoopbackRequest`） |
| loopback 判定 | `server.js` `requestAddress()` L908、`isLoopbackRequest()` L912；`lib/profiles.js` `isLoopbackAddress()` L48 | 只看 `socket.remoteAddress`；**完全不看 `X-Forwarded-For` / `Tailscale-User-Login`** |
| 登入路由 | `server.js` L7046–L7071 | `POST /api/profiles/:id/login`；節流 key = `${remoteAddress}:${profileId}` |
| 暴力嘗試節流 | `lib/profiles.js` `createLoginThrottle()` L55–L100 | 預設 5 次 / 5 分鐘窗口，鎖 10 分鐘，回 429 + `Retry-After` |
| 登出 | `server.js` L7072 | 只清 cookie（token 本身仍永久有效） |
| Owner 判定 | `server.js` L7078 | `const isAdmin = () => profile && db.profiles[0] && profile.id === db.profiles[0].id;`（**db.profiles[0] 就是 owner**） |
| 建立 profile | `server.js` L7024–L7045 | 非 loopback 且非 owner → 403；PIN 為可選，**沒有最低長度／強度檢查** |
| 前端 gate | `public/app.js` `api()` L497 | 401 `code:'auth'` → 開 profile gate |
| 敏感路由 owner 限制 | `server.js` | 以下皆有 `if (!isAdmin()) return 403`：`/api/settings` POST L7936、`/api/update` L7626、`/api/app/restart` L7687、`/api/mobile-access/enable-https` L7773、`/api/setup/*` L7802–L7879、`/api/comfy/start` L8282、`/api/comfy/restart` L8367、`/api/addons/install` L7495、`/api/models/cleanup` L7742、`/api/spark-access/*` L7402–L7429、`/api/dependencies/*`；**`/api/queue/reset` L11117 沒有 isAdmin** |

### A4. Queue / Jobs / 進度

| 項目 | 檔案:行 |
|---|---|
| Job 表 | `server.js` L1000 `const jobs = new Map(); // promptId -> job` |
| 追蹤 | `server.js` `trackJob()` L1371 |
| 送 ComfyUI | `server.js` `queuePrompt()` L2121（POST ComfyUI `/prompt`） |
| ComfyUI WebSocket（server → ComfyUI） | `server.js` L2140–L2210 `/* WebSocket */`、`ensureWs()` L2169（`typeof WebSocket === 'undefined'` → Node<22 polling）、`scheduleWsRetry()` L2205；輪詢備援 L3107 |
| 完成處理 | `server.js` `completeJob()` L2619（抓 `/history` + `/view`，寫 `data/images|videos`，更新 `db.json`，SSE 廣播） |
| SSE（server → 瀏覽器） | `server.js` `broadcast()` L982；`/api/events` L7580（`text/event-stream`） |
| 進度標籤 | `lib/progress-labels.js`（人類可讀階段名）、`public/progress-eta.js`（ETA） |
| 佇列 API | `/api/queue` L10904、`/api/queue/reorder` L11055、`/api/queue/cancel` L11097、`/api/queue/reset` L11117、`/api/interrupt` L10899、`/api/queue/history/clear`、`/api/queue/reviews/clear` |
| 佇列健康 | `lib/queue-health.js` |
| 前端 | `public/app.js` `renderQueue` L21776、`submitQueueReorder` L22039、`connectEvents` L22405、`public/job-reconciliation.js` |

### A5. Library（素材庫）

| 項目 | 檔案:行 |
|---|---|
| 清單 | `server.js` `/api/gallery` L11159 |
| 單項 | regex `itemRoute` L11647（`/api/item/:id[/move]`）、`itemGroupRoute` L11648、`likeRoute` L11649、`vidRoute` L11611 |
| 下載 / 匯出 | `/api/items/download` L11223、`/api/export` L11261、`/api/export-file`、`lib/zip-stream.js`、`lib/export-location.js` |
| 資料夾 | `/api/folders` + regex L11560–L11598；私密資料夾 `lib/private-gallery.js` |
| 垃圾桶 | `/api/trash` L7604、`lib/deleted-media.js`（`data/trash/`，不直接 unlink） |
| 分組 | `lib/gallery-grouping.js`、`lib/gallery-group-names.js`、`/api/items/group|ungroup` |
| 媒體檔案路由 | `server.js` L12032–L12076（`/images/`、`/videos/`、`/video-previews/`、`/faces/`；`canAccessProfileMedia`） |
| 備份 | `server.js` `backupDb()` L897–L906（開機 + 每 30 分，保留 40 份） |

### A6. Settings

| 項目 | 檔案:行 |
|---|---|
| 檔案 | `data/settings.json`（`SETTINGS_FILE` L471） |
| 載入／正規化 | `server.js` L654–L656（`migrateStoredSettings`、`normalizeSettings`、`DEFAULT_SETTINGS`） |
| ComfyUI URL | `server.js` L499 `comfyUrl: RUNTIME.comfy.url || 'http://127.0.0.1:8188'` |
| API | `GET /api/settings` L7707、`POST /api/settings` L7936（owner）、`/api/preferences`（`lib/user-preferences.js`） |
| 安裝設定 | `install.json`（`installer/install-config.example.json`）→ `lib/runtime-config.js` `resolveRuntimeConfig()` L31–L99（env：`MIXBOX_DATA_DIR`、`MIXBOX_COMFY_URL`、`COMFYUI_PATH`、`COMFYUI_MODELS_DIR`、`MIXBOX_UPDATE_CHANNEL`…） |
| 設定頁 UI | `public/index.html` `<nav class="settings-tabs">` L2601 |

### A7. Analytics（PostHog）

| 項目 | 檔案:行 | 事實 |
|---|---|---|
| 預設 key/host | `lib/runtime-config.js` L5–L6 | `DEFAULT_POSTHOG_KEY = 'phc_qzCL…'`、`https://us.i.posthog.com` — **內建預設開啟** |
| 解析 | `resolveRuntimeConfig()` L92–L96 | `env.MIXBOX_POSTHOG_KEY || analytics.key || DEFAULT_POSTHOG_KEY` — **設空字串也會落回預設 key**，無法用 env 關閉 |
| 對外設定 | `publicAnalyticsConfig()` L101–L110；`GET /api/analytics-config` `server.js` L6990 | `enabled: Boolean(key && host)` → 預設 true |
| 前端 | `public/analytics.js` | L93 從 `${host}/static/array.js` 載入第三方 SDK；opt-**out** 模式（localStorage `ks-anonymous-analytics-opt-out` L8）；首次啟動顯示 toast 讓使用者「Disable」；`disable_session_recording: true`、`autocapture: false`（`test/analytics.test.js` L20–L60） |
| UI 開關 | `public/index.html` L2670 `#analyticsToggle` |

### A8. Model Installer / Dependencies

| 項目 | 檔案:行 |
|---|---|
| 元件清單 | `lib/dependency-installer.js` `COMPONENTS`（30 個：smartmask、regional、krea2ref、krea2remix、krea2outpaint、editoutpaint、upscale、ultimateupscale、video(LTX 2.3)、ltx25、ltx25quality、h3、h3r2v、h3turbo…、wan、wananimate2、eros、rife、scail、scailinfinity、faceid） |
| Custom node 清單（**pinned commit**） | 同檔 `NODE_PACKS` L84–L130（gguf、sam3、kjnodes、vhs、ltxvideo、rife、seedvr2、ultimate、rtx、eros、bfs、scailInfinity、krea2Control、depthAnything3、krea2Style、krea2edit、h3turbo…） |
| 模型檔案 | 同檔 `MODEL_ASSETS`（10 個 huggingface.co 來源） |
| 安裝執行 | 同檔 `installComponents()`；`installer/install-dependencies.js`、`installer/bootstrap.js`、`installer/install-comfy.ps1`、`installer/hardware-profile.ps1`、`installer/feature-manifest.json` |
| HF 下載 | `lib/huggingface-download.js` `parseHuggingFaceResolveUrl()` L15（**只允許 https + hostname === huggingface.co**）、`acceleratedHuggingFaceDownload()` L68 |
| 既有模型掃描 | `installer/model-discovery.js`：`parseExtraModelPaths()` L84（**已會解析 `extra_model_paths.yaml`**）、`candidateConfigFiles()` L142、`desktopDeclaredModelRoots()` L161、`discoverModels`（`server.js` L79 引入） |
| 模型清理 | `lib/model-cleanup.js`、`/api/models/cleanup` L7742 |
| 模型載入 / VRAM | `lib/model-loader.js`、`lib/vram-profile.js`、`/api/setup/vram-profile` |
| SAM3 | `lib/sam3-installer.js` |
| API | `/api/dependencies/status|install|cancel|sam3/install`、`/api/setup/status` L7770、`/api/setup/comfy/discover` L7825、`/api/setup/comfy/install` L7879、`/api/hardware` L7898 |

### A9. ComfyUI Client

| 項目 | 檔案:行 |
|---|---|
| HTTP | `server.js` `comfyFetch()` L1461（相對 `settings.comfyUrl`） |
| 上傳到 ComfyUI input | `uploadToComfy(buffer, filename)` L2051、`uploadFileToComfy(file, filename)` L2095 |
| 讀回 input 檔 | `GET /api/input?name=` L8176（先讀 `data/inputs/`，找不到則轉 ComfyUI `/view?type=input`） |
| WebSocket | 見 A4 |
| 探索 / 啟動 / 重啟 | `lib/comfy-discovery.js`（`discoverComfyEndpoints`、`probeComfyUrl`）、`lib/comfy-restart.js`（`startComfy`、`restartComfy`）、`lib/comfy-reset.js` |
| object_info 相容 | `lib/comfy-compatibility.js`、`lib/comfy-widget-spec.js`；`nodeFromOrdered()` / `filterInputs()`（`AGENTS.md` 說明） |

### A10. Workflow Builders（**四模式對應表**）

| 本專案模式 | Mix Studio view | API | 後端 builder | 備註 |
|---|---|---|---|---|
| 文生圖 | `create`（createMode `image`） | `POST /api/generate` L8671，`p.mode='t2i'` | `buildGenerationGraph()` L4906 → `buildT2I()` L4335（Krea 2）；有 regions → `buildRegionalT2I()` L4389 | LoRA：`buildLoraChain()` L4305；圖片引導：`lib/krea2-workflows.js` |
| 圖生圖 | `edit` | `POST /api/generate`，`p.mode='edit'` + `refNames` | `buildGenerationGraph()` 依 `editEngine` 分派：`buildEdit()` L4824（Klein）、`buildEditQwen()` L4716、`buildKrea2Inpaint()` L4393、`buildEditKrea2Identity()` L4634、`buildEditKrea2Remix()` L4661、outpaint 系列 L4515–L4596 | 遮罩：`lib/edit-mask.js`（SAM3）、`/api/edit-mask/sam3`；外擴：`lib/edit-outpaint-workflows.js`、`lib/krea2-outpaint.js` |
| 文生影 | `video`（無首幀） | `POST /api/animate` L9274，不帶 `imageName` | L9616–L9626：純 t2v 用 `BLANK_PNG` + `bypass=true`；**只有 `ltx`、`ltx25`、`h3` 支援**，其他引擎回 400 | `buildAnimate()` L5195（LTX 2.3）、`lib/ltx25-workflow.js`、`lib/video-workflows.js`（H3） |
| 圖生影 | `video`（有首幀） | `POST /api/animate`，帶 `imageName`（先 `/api/upload`）或 `id`（素材庫項目） | `buildAnimate()` L5195、`buildAnimateWan()` L5993、`buildAnimateEros()` L5760、`buildAnimateScail()` L6113、`buildAnimateFaceId()` L5557 | 尾幀：`body.endImageName`（L9639、L9850）；參考影片：`driveVideoName`；音訊：`opts.audioName` |
| 放大 / 插幀（進階） | — | `/api/upscale` L8957、`/api/video/upscale`、`/api/video/interpolate` | `buildUpscale()` L4975、`lib/upscale-workflows.js`、`buildExistingVideoUpscale()` L6364、`buildExistingVideoInterpolate()` L6408 | |
| 提示詞增強 | — | `/api/prompt/revise`、`/api/imageprompt`、`/api/motionprompt` | `lib/prompt-enhance.js`、`lib/local-prompt-ai.js`、`lib/external-llm.js` | **`external-llm.js` 是雲端 LLM 選項 → 安全規格必須預設關閉** |

### A11. Update System

| 項目 | 檔案:行 | 事實 |
|---|---|---|
| 核心 | `lib/app-update.js` `updateFromGit()` L126 | 順序：dirty 檢查（有本地變更 → 拒絕）→ 分支必須 == channel（預設 `main`）→ **origin 必須是官方 repo（`isOfficialOrigin()` L73，否則 `update_origin` 錯誤）** → `git pull --ff-only origin <branch>` L162 |
| 觸發 | `server.js` `POST /api/update` L7626（owner；佇列忙碌時拒絕） | 只改 `public/` → 前端 reload；改 server/lib → exit 75 重啟 |
| 版本檢查 | `lib/github-releases.js`、`/api/releases/latest`、`docs/beta-update-channels.md` | |
| 結論 | — | **一旦 origin 改成使用者 Fork，內建更新會直接失效**（設計如此）。WP-13 必須用外部腳本走 `upstream` 合併，或最小修改 `isOfficialOrigin()` 接受 Fork。 |

### A12. Phone Access / Tailscale / Spark Funnel

| 項目 | 檔案:行 | 事實 |
|---|---|---|
| 區網位址列舉 | `lib/mobile-access.js` `mobileAccessAddresses()` L13、`mobileAccessSummary()` L24、`isTailscaleAddress()` L7 | 開機 log 印出 Phone / Tailscale URL（`server.js` L12162–L12178） |
| Tailscale 執行 | `tailscaleExecutables()` L43、`runTailscale()` L79（`execFile`，無 shell） | |
| **Tailscale Serve HTTPS（已內建）** | `tailscaleHttpsStatus()` L156、`enableTailscaleHttps()` L191 | 執行 `tailscale serve --bg --yes http://127.0.0.1:3300`；API `POST /api/mobile-access/enable-https` L7773（owner） |
| **Gemini Spark = Tailscale Funnel（公網！）** | `lib/spark-access.js` `enableSparkFunnel()` L133（`tailscale funnel --bg --yes --https=8443 --set-path=/mcp/<token> …`）、`lib/spark-mcp.js`、`server.js` `handleSparkMcp()` L11963、`/api/spark-access/enable|disable` L7406/L7429 | 預設關閉（`normalizeSparkAccess` `enabled === true && token`），但 owner 一鍵可開 → **安全規格必須強制停用** |
| 手機 QR | `public/qrcodegen.js` | |

### A13. Upload

| 項目 | 檔案:行 | 事實 |
|---|---|---|
| 路由 | `server.js` `POST /api/upload` L8215–L8266 | 檔名取自 header `x-filename`，清成 `[\w.\-]`，加 `ks_<ts>_<rand>_` 前綴；先寫 `data/inputs/.upload-*.tmp` 再 `uploadFileToComfy` |
| 大小限制 | `MAX_INPUT_BYTES`（2 GB） | |
| **沒有的** | — | **沒有副檔名白名單、沒有 MIME / magic-bytes 驗證**（任何檔案都會進 ComfyUI input 目錄）；`uploadedAssetKind()` 只是分類標籤 |
| 媒體檢查 | `lib/media-inspection.js`（ISO BMFF / PNG 解析）、`detectAudioStreamFile` | 可作為驗證的基礎 |
| Prompt pack ZIP | `/api/addons/install` L7495、`lib/prompt-packs.js` | ZIP 解壓 → WP-08 需審 zip-slip |

---

## B. MCWW 總覽（先看這段）

- **Python + Gradio 5.49.1**（`requirements.txt`：gradio==5.49.1、websocket-client、requests、python-dotenv、wrapt）。
- 兩種模式：
  1. **Extension 模式**（本專案採用）：放在 `ComfyUI/custom_nodes/` 下，`__init__.py` 被 ComfyUI 載入後，在 **ComfyUI 的 Python 程序內開一條 thread 跑獨立的 Gradio 伺服器**（`mcww/comfy/comfyExtension.py` `launchInThread()` L29）。**它不是掛在 8188 底下**，只在 8188 註冊兩條輔助路由：`GET /mcww/available_at`、`GET /mcww/get_logo`（`__init__.py` L14–L26）。
  2. Standalone 模式：`mcww/standalone.py`，用 `COMFY_ADDRESS` 連 ComfyUI。
- **Gradio 綁定**（`comfyExtension.py` `_initOpts()` L10–L26）：`GRADIO_SERVER_NAME` 預設 `127.0.0.1`（除非 ComfyUI 用 `--listen 0.0.0.0` 才變 `0.0.0.0`）；`GRADIO_SERVER_PORT` 預設 `7860`（與 ComfyUI 同 port 時改 7861）；`GRADIO_NUM_PORTS` 預設 100（會往後試 port → **必須設 1 固定 port**）。
- 檔案模式：extension 模式固定 `same_server`，Gradio `allowed_paths` 直接包含 **ComfyUI 的 input 與 output 目錄**（`mcww/ui/mainUI.py` L113–L116）。
- **子路徑反向代理官方標示為不支援**：`.env.example` 對 `GRADIO_ROOT_PATH` 註解：「UNTESTED, I'm sure this doesn't work because mcwwAPI.py and progressAPI.py files don't account for it」。實際原因見 B2。

### B1. 進入點與啟動

| 項目 | 檔案:行 |
|---|---|
| ComfyUI 載入點 | `__init__.py`（`try: import server`；`WEB_DIRECTORY = "./comfy_web_dir"`） |
| Extension 啟動 | `mcww/comfy/comfyExtension.py`：`_initOpts()` L10、`launchInThread()` L29、`availableAt()` L40（回傳 Gradio port 給 ComfyUI 前端按鈕）、`getLogo()` |
| ComfyUI 前端按鈕 | `comfy_web_dir/mcww.js`（在 ComfyUI 介面加「Open MCWW」按鈕；`COMFY_MCWW_BUTTON_URL_OVERRIDE` 可覆蓋 URL） |
| 主 UI | `mcww/ui/mainUI.py` `MinimalisticComfyWrapperWebUI.launch()` L108：`shared.webUI.launch(allowed_paths=…, auth=opts.MCWW_AUTH, pwa=True, prevent_thread_lock=True, share_server_*…)` L120–L128；之後進入 `queueing.queue.iterateQueueProcessingLoop()` 迴圈 L144–L154 |
| 參數 / env | `mcww/arguments.py`（`--files-mode`、`--comfy-base-directory`…；`COMMAND_LINE_FLAGS` env）、`mcww/opts.py`（`MCWW_AUTH`、`MCWW_WORKFLOWS_SUBDIR`、`WEBUI_TITLE`、`STORAGE_DIRECTORY`…）、`.env.example` |
| 環境變數注入方式 | `python-dotenv` 讀 custom node 目錄下的 `.env` → **本專案設定就放 `custom_nodes/Minimalistic-Comfy-Wrapper-WebUI/.env`**（不在 git 追蹤） |

### B2. 路由（Codex 代理白名單依據）

**MCWW 自己加的 FastAPI 路由（全部是根路徑絕對路徑）：**

| 路由 | 檔案:行 | 用途 |
|---|---|---|
| `GET /mcww_api/queue_version` | `mcww/ui/mcwwAPI.py` L16 | 佇列版本輪詢 |
| `GET /mcww_api/outputs_version/{outputs_key}` | L19 | 輸出版本輪詢 |
| `GET /mcww_api/queue_indicator` | L22 | 佇列指示 |
| 其他 `add_api_route` | L65、L133 | （同檔） |
| `GET /mcww_api/progress_sse` | `mcww/ui/progressAPI.py` L36 | **SSE**（進度） |

**MCWW 前端 JS 寫死的絕對路徑（子路徑代理會壞的根本原因）：**

| 檔案:行 | 路徑 |
|---|---|
| `mcww_web/js/queue.js` L209 | `fetch('/mcww_api/queue_indicator')` |
| `mcww_web/js/pull.js` L38、L59 | `/mcww_api/queue_version`、`/mcww_api/outputs_version/` |
| `mcww_web/js/progress.js` L28 | `new EventSource('/mcww_api/progress_sse')` |
| `mcww_web/js/misc/backendChecks.js` L30、L46 | `originalFetch('/config')` |
| `mcww_web/js/misc/layout.js` L25 | `'/pwa/serviceWorker.js'` |
| `mcww_web/js/misc/title.js` L17 | `'/pwa/icon.png'` |
| `mcww_web/pwa/serviceWorker.js` L6 | `CHECK_URL = '/config'` |

**Gradio 5.49.1 本身掛在根路徑的路由（節錄，來源 `gradio/routes.py`）：**
`/`、`/config`、`/theme.css`、`/assets/*`、`/static/*`、`/svelte/*`、`/manifest.json`、`/pwa_icon`、`/favicon.ico`、`/login`、`/logout`、`/login_check`、`/custom_component/*`、`/file/*`、`/file=*`、`/proxy=*`、`/monitoring*`、`/dev/reload`、`/vibe-*`，以及 **`/gradio_api/*`**（`API_PREFIX = "/gradio_api"`，含 `queue/join`、`queue/data`（SSE）、`upload`、`upload_progress`、`file=`、`heartbeat/*`、`stream/*`、`cancel`、`info`、`mcp`）。

→ 結論：MCWW **完整依賴根路徑**。不改 MCWW 原始碼就無法穩定放在 `/custom-workflows/` 子路徑下。方案決定見 `09_REVIEW_FINDINGS.md` 第 2 點。

### B3. 靜態檔案

| 項目 | 位置 |
|---|---|
| MCWW 自有前端 | `mcww_web/`：`js/`、`css/`、`fonts/`、`assets/`、`pwa/`（`serviceWorker.js`、icon）、`callbacks.js`、`logo.svg`；透過 Gradio `allowed_paths` 中的 `MCWW_WEB_DIR` 提供 |
| Gradio 靜態 | `/assets/*`、`/static/*`、`/svelte/*`、`/theme.css` |
| ComfyUI 端 | `comfy_web_dir/mcww.js`（只在 8188 的 ComfyUI 前端使用） |

### B4. WebSocket / SSE

| 方向 | 檔案:行 | 協定 |
|---|---|---|
| MCWW → ComfyUI | `mcww/comfy/messages.py` L12–L22：`websocket.WebSocket().connect(ws://localhost:8188/ws?clientId=…)` | WebSocket（server 內部，**不經過手機**） |
| 瀏覽器 → MCWW 進度 | `mcww/ui/progressAPI.py` `/mcww_api/progress_sse` L36；`mcww_web/js/progress.js` L28 | **SSE** |
| 瀏覽器 → Gradio 佇列 | Gradio `/gradio_api/queue/join`（POST）+ `/gradio_api/queue/data`（SSE）+ `/gradio_api/heartbeat/{session}` | **SSE**（Gradio 5 不用 WebSocket） |
| 結論 | — | **代理不需要 WebSocket upgrade**，但**必須支援長連線 SSE（不緩衝、不逾時）** |

### B5. Workflow 掃描

| 項目 | 檔案:行 |
|---|---|
| 來源 | `mcww/comfy/comfyAPI.py` `getWorkflows()` L117：呼叫 ComfyUI `GET /userdata?dir=workflows&recurse=true`，只取 `path.startswith(opts.MCWW_WORKFLOWS_SUBDIR)` 且 `.json` 的檔案，再逐一 `GET /userdata/workflows/<path>` |
| 實際目錄 | `ComfyUI/user/default/workflows/<MCWW_WORKFLOWS_SUBDIR>/`（`MCWW_WORKFLOWS_SUBDIR` 由 `.env` 設定；未設時為整個 workflows 目錄） |
| 重新掃描 | `mcww/ui/projectUI.py` `refreshWorkflows()` L29 |
| 轉換 | `mcww/comfy/workflowConverting.py`（UI 格式 → API 格式，359 行）、`graphToApi.sh` |

### B6. Node Title Mapping

| 項目 | 檔案 |
|---|---|
| 語法規格 | `docs/titles.md`：`<Label:category[/tab]:sortRow[/sortCol]> other args`；category = `prompt`（必要）/ `output`（必要）/ `important` / `advanced` / 自訂；other args：`min, max, step`、`json`、`md`、`show_default` |
| 解析 | `mcww/comfy/workflow.py`（166 行；`parseMinMaxStep()` L37）、`mcww/comfy/nodeUtils.py`（225 行） |
| 支援節點 | Clip Text Encode、Load/Save Image、Load/Save Video、Load/Save Audio、String (Multiline)、Preview as Text、Int/Float/String/Boolean/Primitive、Note/MarkdownNote |
| 範例 | `example_workflows/*.json`（MiniMax H3 T2V / FL2V / Ref、extract audio） |

### B7. Queue

| 項目 | 檔案:行 |
|---|---|
| 佇列邏輯 | `mcww/queueing.py`（513 行；`initQueue()`、`iterateQueueProcessingLoop()`、`saveQueue()`、`AUTOSAVE_INTERVAL`）— MCWW 自己維護一個佇列，再逐一送 ComfyUI |
| 處理 | `mcww/processing.py`（264 行） |
| 送 ComfyUI | `mcww/comfy/comfyAPI.py`：`enqueueComfy()` L108（POST `/prompt`）、`_getHistory()` L45、`_getQueue()` L52、`interruptComfy()` L161、`unQueueComfy()` L171、`restartComfy()` L196、`getStats()` L232、`freeCacheAndMemory()` L241 |
| UI | `mcww/ui/queueUI.py`（463 行） |
| 狀態保存 | `mcww/ui/webUIState.py`（243 行；`baseStatesKey`） |

### B8. Output Viewer / 檔案存取

| 項目 | 檔案:行 |
|---|---|
| 檔案設定 | `mcww/opts.py` `_FileConfig` / `FilesMode`（`same_server` / `mirror` / `direct_links`） |
| 檔案取得 | `mcww/comfy/comfyFile.py`（208 行） |
| 圖片編輯器 / 比較 | `mcww/ui/imageEditorUI.py`、`mcww/ui/compareUI.py` |
| 縮圖 | `opts.STORAGE_DIRECTORY/thumbnails`（在 `allowed_paths`） |
| 提供方式 | Gradio `/gradio_api/file=<絕對路徑>`（受 `allowed_paths` 限制：`MCWW_WEB_DIR`、thumbnails、ComfyUI input、ComfyUI output） |

### B9. Auth

| 項目 | 檔案:行 |
|---|---|
| Gradio 內建帳密 | `mcww/ui/mainUI.py` L124 `auth=opts.MCWW_AUTH`；env `MCWW_AUTH='[["user","pass"]]'`；Gradio 自己的 `/login` 路由與 cookie |
| ComfyUI-Login 相容 | `COMFY_UI_LOGIN_EXTENSION_TOKEN`（`.env.example`） |
| 公網分享 | `GRADIO_SHARE`、`FRP_*`（**本專案禁止**；程式在無 `MCWW_AUTH` 時會拒絕 share L129–L133） |

---

## C. 影響設計決策的原始碼事實（摘要）

1. **Mix Studio 監聽 `0.0.0.0`**（L12162）且「無 PIN 的唯一 profile = 開放工作區」— 手機在區網可用 `POST /api/profiles/:id/login` 空 PIN 直接登入。
2. **loopback 判定只看 socket 位址**：Tailscale Serve 是把流量轉到 `127.0.0.1:3300`，所以**外出手機的請求在 Mix Studio 眼中全是 loopback** → 會被當成「主機本人」（自動落到開放 profile、允許建立 profile）。
3. Session token 無時效、無法撤銷；cookie 無 `Secure`。
4. **PostHog 預設開啟**、第三方 SDK 從 posthog.com 載入、env 無法關閉。
5. Gemini Spark 功能會開 **Tailscale Funnel（公網）**。
6. `external-llm.js` 提供雲端 LLM 提示詞增強選項。
7. 上傳無格式白名單／MIME 驗證。
8. 沒有 CSP、X-Frame-Options、Origin 檢查。
9. **沒有 i18n 系統**。
10. **內建更新只接受官方 origin**。
11. MCWW 是**獨立 Gradio 伺服器（預設 127.0.0.1:7860）**，依賴根路徑；進度用 SSE；不需 WebSocket 代理。
12. MCWW 的 `allowed_paths` 含 ComfyUI input/output 全目錄 → 只能透過已登入的代理存取，絕不可直接暴露 7860。
13. Mix Studio 的 `/api/animate` 純文生影只支援 LTX 2.3 / LTX 2.5 / MiniMax H3。

## D. 尚未取得、需使用者或 Codex 提供

- SuperGrok 產出的 `00_EXECUTIVE_DECISION.md` ～ `05_CLAUDE_HANDOFF.md`（**本次未附**，無法驗證其研究）。
- 目標主機上的 `data/settings.json`、`install.json`（若有）、ComfyUI 版本、`custom_nodes/` 清單、`extra_model_paths.yaml`、現有 `models/` 清單。
- 目標主機的 Tailscale 狀態（`tailscale status --json`、MagicDNS 名稱、HTTPS 憑證是否已核准）。
