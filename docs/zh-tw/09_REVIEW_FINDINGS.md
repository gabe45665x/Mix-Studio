# 09_REVIEW_FINDINGS.md — 首輪審查結果與待核決策

> 這份是給老闆看的決策摘要。後續 10～18 號文件全部以此為前提。
> 證據行號見 `12_SOURCE_CODE_MAP.md`。

## 1. 驗證結果

| 項目 | 結果 |
|---|---|
| Mix Studio repo 存在且可讀 | ✅ 已 clone，commit `bec3292`（2026-08-21），v1.2.4，GPL-3.0，Node ≥22 零依賴 |
| MCWW repo 存在且可讀 | ✅ 已 clone，commit `1f65c75`（2026-08-23），v2.4.4，AGPL-3.0，Gradio 5.49.1 |
| ComfyUI | 未 clone（只需要它的 API 行為，已由兩個專案的呼叫端確認：`/prompt`、`/ws`、`/history`、`/view`、`/upload/image`、`/userdata`、`/object_info`） |
| SuperGrok 00～05 文件 | ❌ **未收到**，無法驗證其研究內容與模型矩陣 |
| 手機截圖 | 只收到一張 Claude 錯誤訊息截圖，非 UI 參考 |

## 2. 需要老闆核准的四個架構決定

### D1. MCWW 掛載方式：改用「第二個 port、根路徑」的認證代理（不是 `/custom-workflows/` 子路徑）

**原本企劃書優先順序**是同網域 `/custom-workflows/` 子路徑。**原始碼證據顯示不可行（不改 MCWW 的話）**：

1. MCWW 作者在 `.env.example` 自己寫明子路徑「UNTESTED, I'm sure this doesn't work」。
2. MCWW 前端有 8 處寫死的根路徑（`/mcww_api/*`、`/config`、`/pwa/serviceWorker.js`、`/pwa/icon.png`），子路徑下全部 404（見 12 號文件 B2）。
3. Mix Studio 自己的 Service Worker scope 是整個 origin `/`，會攔截 `/custom-workflows/` 的導航；兩個 PWA 擠在同一 origin 會互相干擾 localStorage 與 SW。
4. Gradio 根路徑有 60+ 條路由（`/config`、`/assets`、`/theme.css`、`/login`…），與 Mix Studio 根路徑必然打架。

**決定**：Mix Studio 在 `server.js` 多開一個 listener（例如 `3301`），整個 port 只做一件事：**檢查 `ks_profile` cookie 已登入 → 反向代理到 `127.0.0.1:7860`（MCWW）**，路徑一對一不改寫。

- Cookie 不分 port，所以手機在 3300 登入後，3301 自動視為已登入（同一套登入邊界 ✅）。
- 不用改 MCWW 任何一行（Sidecar 原則 ✅、AGPL 不產生修改義務 ✅）。
- 不需要 WebSocket 代理（MCWW 與 Gradio 5 全用 SSE），但代理必須支援長連線 SSE 不緩衝。
- 外出：`tailscale serve --bg --https=443 http://127.0.0.1:3300`（Mix Studio，已內建）＋ `tailscale serve --bg --https=8443 http://127.0.0.1:3301`（MCWW）。不用 Funnel。
- 區網：`http://<主機IP>:3301/`。手機看到的永遠不是 8188，也不是 7860。
- Mix Studio 的「自訂工作流」頁 = 說明 + 「開啟 MCWW」按鈕（新分頁，URL 由 server 依目前 host/協定算出）+ 最近工作流清單（Mix Studio 讀 ComfyUI `user/default/workflows/mcww/` 目錄列檔名即可）。
- 代理白名單：拒絕 `/proxy=*`、`/vibe-*`、`/monitoring*`、`/dev/reload`、`/gradio_api/mcp*`、`/login`、`/logout`（MCWW 自己的帳密不啟用，統一用 Mix Studio 登入）。

**備案 A（不建議）**：若老闆堅持同 origin 子路徑，需 (a) 設 `GRADIO_ROOT_PATH=/custom-workflows`，(b) Fork MCWW 並修補上述 8 處絕對路徑，(c) Mix Studio SW 排除該前綴，(d) 代理同時接管 `/mcww_api/*` 與 `/pwa/*`。每次 MCWW 更新都要重新修補。

### D2. 首頁四模式：新增「簡易殼層」，不深改原本 38,000 行前端

- 原 `public/app.js` 沒有 i18n、字串寫死、單一檔案；深改後上游更新幾乎無法合併。
- **決定**：新增 `public/simple/`（`index.html` + `app.js` + `zh-TW.json` + `style.css`），作為預設首頁（`/` → simple），內容就是企劃書第五、六、七章的四模式 + 任務 + 素材庫 + 自訂工作流 + 設定。它只呼叫**現有** API：`/api/generate`、`/api/animate`、`/api/upload`、`/api/queue`、`/api/gallery`、`/api/events`、`/api/settings`、`/api/me`、`/api/profiles/:id/login`。
- 原本的完整 Mix Studio 介面搬到 `/studio`（進階模式），一個按鈕互切。
- server 端只加：路由 `/` → `public/simple/index.html`、`/studio` → 原 `index.html`、新 `GET /api/simple/capabilities`（把「哪些引擎已安裝、哪些支援文生影、可用比例／秒數」整理成簡易殼層要的格式，避免手機端載入 38k 行邏輯）。
- 繁中 locale 獨立檔案，原介面維持英文（或第二階段再翻）。

### D3. 更新策略：`origin`=你的 Fork、`upstream`=官方；內建更新按鈕停用，改用腳本

- Mix Studio 內建更新只認官方 origin（`lib/app-update.js` `isOfficialOrigin()`），origin 改成 Fork 後會顯示「automatic updates are disabled」— 這是安全的，不用硬改。
- 自訂修改全部集中在：`public/simple/`、`lib/zh/`（新增模組）、`server.js` 少量掛鉤點（每個掛鉤用 `// [ZH-TW-CUSTOM]` 標記）、`data/`（設定，不進 git）。
- `scripts/sync-upstream.ps1`：備份 `data/` → `git fetch upstream` → `git merge upstream/main` → 衝突就停 → `node --check server.js && node --test` → 通過才重啟。

### D4. 遠端：用 Mix Studio 內建的 Tailscale Serve；Spark/Funnel 一律封死

- `POST /api/mobile-access/enable-https` 已經會執行 `tailscale serve --bg --yes http://127.0.0.1:3300`，直接用。
- `/api/spark-access/enable`（會開 Tailscale **Funnel** 到公網）必須在程式層永久回 403，並在設定 UI 隱藏。
- ComfyUI 維持 `127.0.0.1:8188`；MCWW 維持 `GRADIO_SERVER_NAME=127.0.0.1`、`GRADIO_SERVER_PORT=7860`、`GRADIO_NUM_PORTS=1`。

## 3. 安全審查初步發現（依嚴重度）

| # | 嚴重度 | 發現 | 位置 | 修法（進 WP-08） |
|---|---|---|---|---|
| S1 | 高 | Tailscale Serve 轉到 127.0.0.1，Mix Studio 把外出手機當成「主機本人」（自動登入開放 profile、可建 profile） | `server.js` `isLoopbackRequest()` L912、`currentProfile()` L916 | 加 `isTrustedLocalRequest()`：remoteAddress 是 loopback **且** 沒有 `X-Forwarded-For` / `Tailscale-User-Login` header 才算本機 |
| S2 | 高 | Owner profile 可以沒有 PIN；無 PIN profile 遠端可空 PIN 登入 | `lib/profiles.js` `verifyPin()` L25、`server.js` L7046 | 非本機請求一律要求 PIN；owner 必須設 PIN（最少 6 碼，拒絕 000000/123456 類）；無 PIN profile 只能本機用 |
| S3 | 高 | Mix Studio 監聽 `0.0.0.0` 全介面 | `server.js` L12162 | 改成可設定 `HOST`；預設區網介面 + 127.0.0.1；Windows 防火牆規則只放行 Private profile |
| S4 | 高 | Gemini Spark = Tailscale Funnel 公網暴露 | `lib/spark-access.js` L133 | 程式層永久停用 |
| S5 | 中 | Session token 永久有效、無法撤銷、無 `Secure` | `lib/profiles.js` L35、`server.js` L930 | token 加 `issuedAt` + 到期（例如 30 天）+ profile `sessionVersion`（登出/改 PIN 即失效）；HTTPS 請求（`X-Forwarded-Proto: https`）時加 `Secure` |
| S6 | 中 | PostHog 預設開、第三方 SDK 從外部載入、env 關不掉 | `lib/runtime-config.js` L5、L92 | 改 opt-in：`analytics.enabled` 預設 false；`/api/analytics-config` 預設回 `enabled:false`；CSP 封鎖 posthog.com |
| S7 | 中 | 上傳無副檔名／MIME／magic-bytes 白名單 | `server.js` L8215 | 白名單：png/jpg/jpeg/webp、mp4/mov/webm、wav/mp3/m4a/flac；用 `lib/media-inspection.js` 驗 magic bytes；ZIP 只在 addons 路由且檢查 zip-slip |
| S8 | 中 | 沒有 CSP、X-Frame-Options、Referrer-Policy、Origin 檢查 | `server.js` 主分派器 | 全站 header；非 GET 的 `/api/*` 檢查 `Origin`/`Sec-Fetch-Site` 為 same-origin |
| S9 | 中 | 雲端 LLM 提示詞增強選項 | `lib/external-llm.js`、`/api/prompt/provider/test` | 預設關閉，設定頁標示「會把提示詞傳到第三方」，需主動開啟 |
| S10 | 低 | `/api/queue/reset` 沒有 owner 限制；`/api/input` 可讀取 ComfyUI input 目錄任何檔名 | `server.js` L11117、L8176 | 加 `isAdmin()`；`/api/input` 只允許 `ks_` 前綴或該 profile 已登錄的 asset |
| S11 | 資訊 | 命令執行整體良好：全部 `execFile/spawn` 無 shell；custom nodes 釘死 commit；HF 下載只允許 `huggingface.co`；更新 `--ff-only` | `lib/*.js` | 維持；WP-08 只需加 PowerShell `-ExecutionPolicy Bypass -File` 白名單與 hash 檢查（模型檔） |

## 4. 授權初步結論

| 專案 | 授權 | 私人自用 | 若日後對外分發／架站 |
|---|---|---|---|
| Mix Studio | GPL-3.0 | 無義務 | 分發修改版須提供完整原始碼、保留 LICENSE 與版權聲明；純網路服務（不分發程式）GPL 不強制提供原始碼 |
| MCWW | **AGPL-3.0** | 無義務 | **AGPL §13：只要有「使用者透過網路互動」就必須提供對應原始碼** — 本方案不修改 MCWW，只需在 UI 保留「原始碼：GitHub 連結」即可 |
| ComfyUI | GPL-3.0 | 無義務 | 同 Mix Studio |
| Gradio | Apache-2.0 | 無義務 | 保留 NOTICE |
| Sidecar 是否構成「整體」 | — | Mix Studio ↔ MCWW 之間只有 HTTP 反向代理，各自獨立程序、獨立語言 — 屬於 GPL FAQ 所稱「separate programs communicating at arm's length」，**不會把 Mix Studio 感染成 AGPL** |
| 模型 | 各異 | 待 SuperGrok 矩陣（Krea 2 / Flux Klein / Qwen / LTX / Wan / MiniMax H3 授權各不同，**部分限制商用**） | 16 號文件逐一列 |

## 5. 缺少的輸入（請提供）

1. SuperGrok 的 `00_EXECUTIVE_DECISION.md` ～ `05_CLAUDE_HANDOFF.md`。
2. 5090 主機上：ComfyUI 安裝方式（Desktop / portable / git）、版本、`custom_nodes/` 清單、`models/` 各資料夾檔名、`extra_model_paths.yaml`。
3. 目前有沒有已安裝 Mix Studio（如有，`data/settings.json` 去敏後的內容）。
4. Tailscale：是否已裝、MagicDNS 名稱、HTTPS 憑證是否已在 admin console 開啟。

## 6. 後續文件產出順序

`10_MASTER_REQUIREMENTS` → `11_ARCHITECTURE` → `13_MCWW_INTEGRATION_SPEC` → `15_SECURITY_SPEC` → `14_UI_UX_SPEC_ZH_TW` → `16_LICENSE_SPEC` → `17_CODEX_IMPLEMENTATION_PLAN` → `18_ACCEPTANCE_TESTS`
（12 已完成；10/11/13/15 不需要 SuperGrok 文件也能寫；16 的模型段與 17 的 WP-09 需要 SuperGrok 模型矩陣。）
