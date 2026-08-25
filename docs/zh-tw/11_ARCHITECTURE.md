# 11_ARCHITECTURE.md — 系統架構

> 依 `10_MASTER_REQUIREMENTS.md` R-01～R-10。程式位置引用 `12_SOURCE_CODE_MAP.md`。

## 1. 系統結構圖

```
┌──────────────── Android 手機 ────────────────┐
│  Chrome / PWA                                 │
│   ├─ 區網:   http://<LAN-IP>:3300/  (Mix Studio 簡易殼層)
│   │          http://<LAN-IP>:3301/  (自訂工作流 = MCWW 代理)
│   └─ 外出:   https://<host>.<tailnet>.ts.net/       (443  → 3300)
│              https://<host>.<tailnet>.ts.net:8443/  (8443 → 3301)
└───────────────────────┬───────────────────────┘
                        │ Wi-Fi / Tailscale (WireGuard)
┌───────────────────────▼──────────── Windows 11 主機 ─────────────────────────┐
│  tailscaled  ── tailscale serve ──┐ 443 → http://127.0.0.1:3300               │
│                                   └ 8443 → http://127.0.0.1:3301              │
│  Windows Firewall: Private profile 放行 TCP 3300, 3301；其餘拒絕                 │
│                                                                               │
│  ┌── node server.js (Mix Studio, 一個程序) ──────────────────────────────┐    │
│  │  listener A  :3300  (HOST 可設定, 預設 0.0.0.0)                        │    │
│  │    /              → public/simple/index.html   [ZH-TW-CUSTOM]          │    │
│  │    /studio        → public/index.html (原介面)   [ZH-TW-CUSTOM]          │    │
│  │    /api/*         → handleApi (既有 92 條 + 新增 /api/simple/*,        │    │
│  │                     /api/custom-workflows/*)                            │    │
│  │    /images|videos → 需登入的媒體檔                                      │    │
│  │    /api/events    → SSE 進度                                            │    │
│  │  listener B  :3301  (lib/zh/mcww-proxy.js)      [ZH-TW-CUSTOM]          │    │
│  │    * → 檢查 ks_profile cookie → 反向代理 http://127.0.0.1:7860/*        │    │
│  └────────────┬───────────────────────────────┬──────────────────────────┘    │
│               │ HTTP /prompt /history /view    │ HTTP + SSE                    │
│               │ /upload/image /object_info     │                               │
│               │ WS /ws                         ▼                               │
│  ┌────────────▼──────── ComfyUI python 程序 (127.0.0.1:8188) ───────────┐     │
│  │  custom_nodes/Minimalistic-Comfy-Wrapper-WebUI                        │     │
│  │    └─ thread: Gradio 5.49.1 server  127.0.0.1:7860  (MCWW)            │     │
│  │         ├─ 讀 user/default/workflows/mcww/*.json                       │     │
│  │         └─ WS ws://localhost:8188/ws  + HTTP /prompt /history …        │     │
│  │  models/ (+ extra_model_paths.yaml)     input/     output/            │     │
│  └──────────────────────────────┬────────────────────────────────────────┘     │
│                                 ▼                                             │
│                          RTX 5090 32GB                                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2. 程序與 Port

| 程序 | 啟動者 | 綁定 | Port | 對外可見？ | 備註 |
|---|---|---|---|---|---|
| `node server.js`（Mix Studio） | `start.bat`（開機排程） | listener A：`MIXBOX_HOST`（預設 `0.0.0.0`） | 3300 | 區網（防火牆 Private）+ Tailscale 443 | 既有 |
| 同一程序，listener B（MCWW 代理） | 同上 | 同 listener A 的 HOST | 3301（`MIXBOX_MCWW_PROXY_PORT`） | 區網 + Tailscale 8443 | 新增 `lib/zh/mcww-proxy.js` |
| ComfyUI（python） | Mix Studio `startComfy()`（`lib/comfy-restart.js`）或 Comfy Desktop | `127.0.0.1` | 8188 | **否** | 不得加 `--listen` |
| MCWW（Gradio thread，在 ComfyUI 程序內） | ComfyUI 載入 custom node 時自動 | `127.0.0.1`（`.env` 強制） | 7860（`GRADIO_NUM_PORTS=1`） | **否** | 若 7860 被占用 → 啟動失敗而非漂移到其他 port；代理健康檢查會顯示原因 |
| `tailscaled` | Tailscale 服務 | — | 41641/UDP（WireGuard） | tailnet | serve 設定持久化在 tailscaled |
| 本機提示詞 LLM（可選，`lib/local-prompt-ai.js`） | ComfyUI 節點內（`TextGenerate`）或 Mix Studio 呼叫本機服務 | `127.0.0.1` | 依設定 | 否 | 雲端 LLM（`lib/external-llm.js`）預設停用 |

## 3. Mix Studio 與 ComfyUI 的關係

| 動作 | Mix Studio 端 | ComfyUI 端 |
|---|---|---|
| 送工作 | `queuePrompt()` L2121 → `comfyFetch('/prompt')` | `POST /prompt` → 回 `prompt_id` |
| 進度 | `ensureWs()` L2169：Node 22 原生 `WebSocket` 連 `ws://127.0.0.1:8188/ws?clientId=…`；Node < 22 或斷線 → L3107 輪詢 `/queue` `/history` | `/ws` 推 `progress`、`executing`、`executed` |
| 取結果 | `completeJob()` L2619 → `/history/<id>` → `/view?filename=…&type=output` → 寫 `data/images|videos` | 檔案永久留在 `ComfyUI/output/`（災難復原來源） |
| 上傳輸入 | `uploadFileToComfy()` L2095 → `POST /upload/image` | 存 `ComfyUI/input/ks_*` |
| 讀回輸入 | `GET /api/input?name=` L8176 → 先 `data/inputs/`，再 `/view?type=input` | |
| 節點相容 | 開機與設定變更時 `GET /object_info` → `lib/comfy-compatibility.js`、`nodeFromOrdered()`、`filterInputs()` | |
| 啟停 | `lib/comfy-restart.js`：`startComfy` / `restartComfy`；`lib/comfy-discovery.js`：`discoverComfyEndpoints`（只認 loopback） | |
| 取消 | `/api/queue/cancel` L11097 → ComfyUI `POST /queue {delete:[id]}` 或 `/interrupt` | |

**ComfyUI 的 URL 只存在 `data/settings.json` 的 `comfyUrl`（預設 `http://127.0.0.1:8188`）**；手機端任何 API 回應都不得包含此值（新增的 `/api/simple/*` 回應需過濾）。

## 4. MCWW Sidecar

- 安裝位置：`ComfyUI/custom_nodes/Minimalistic-Comfy-Wrapper-WebUI/`（git clone，釘在 `1f65c75`）。
- 設定檔：同目錄 `.env`（由 `scripts/zh/setup-mcww.ps1` 產生；不進 git；內容見 13 號文件 §2）。
- 生命週期：**與 ComfyUI 同生同滅**。ComfyUI 啟動 → `__init__.py` → `comfyExtension.launchInThread()` → `waitForComfy(10)` → Gradio 在 7860 起來。ComfyUI 重啟 = MCWW 重啟。
- 工作流來源：`ComfyUI/user/default/workflows/mcww/*.json`（`MCWW_WORKFLOWS_SUBDIR=mcww`）。使用者在桌面 ComfyUI 編輯器把節點標題改成 `<標籤:prompt:1>` 格式後「另存」到該資料夾即可，MCWW 頁面按「重新整理」即出現。
- 狀態／佇列：MCWW 自己的 `storage/`（在 custom node 目錄下）保存佇列與 UI 狀態；與 Mix Studio `data/` 完全獨立。
- 輸出：MCWW 直接寫 `ComfyUI/output/`，透過 Gradio `allowed_paths` 提供瀏覽；**不進 Mix Studio 素材庫**（R-41）。
- 與 Mix Studio 的唯一耦合：3301 代理 + Mix Studio 讀取 `user/default/workflows/mcww/` 目錄列出檔名（`/api/custom-workflows/recent`）。

## 5. Proxy（摘要，完整規格見 13 號文件）

```
瀏覽器 ──(cookie ks_profile)──▶ :3301 listener B
   │ 1. currentProfile(req) 為 null → 401 JSON（zh-TW）或 302 到 :3300 登入頁（依 Accept）
   │ 2. ownerOnly 設定為 true 且非 owner → 403
   │ 3. 路徑在拒絕清單 → 404
   │ 4. 非 GET/HEAD/OPTIONS 且 Origin/Sec-Fetch-Site 非同源 → 403
   │ 5. http.request → 127.0.0.1:7860，同 method、同 path+query
   │      加：X-Forwarded-Host(原 Host)、X-Forwarded-Proto、X-Forwarded-For
   │      去：Cookie 中的 ks_profile 與 ks_private（不把 Mix Studio 憑證交給 Gradio）
   │ 6. 回應原樣串流（SSE 不緩衝）；加安全標頭（CSP、X-Frame-Options、Referrer-Policy）
   └─ upgrade（WebSocket）：同樣驗證後 TCP 對接（目前 MCWW 不用，保留）
```

## 6. Tailscale

| 項目 | 規格 |
|---|---|
| 前提 | 主機與手機登入同一 tailnet；admin console 開啟 MagicDNS 與 HTTPS 憑證 |
| Mix Studio | 既有 `enableTailscaleHttps(3300)` → `tailscale serve --bg --yes http://127.0.0.1:3300`（等同 `--https=443`） |
| MCWW | 新增 `scripts/zh/tailscale-mcww.ps1` 或 `/api/custom-workflows/enable-https`（owner）→ `tailscale serve --bg --yes --https=8443 http://127.0.0.1:3301` |
| 順序 | **先** 3300（既有按鈕）**再** 3301。原因：`inspectServeConfig()` 在「有設定但沒有 3300」時回報 conflict 並拒絕啟用 |
| 驗證 | `tailscale serve status --json` 應同時含 `http://127.0.0.1:3300` 與 `http://127.0.0.1:3301`，且 **不得出現 `AllowFunnel` 為 true 的項目** |
| 標頭 | Serve 會加 `X-Forwarded-For`、`X-Forwarded-Host`、`X-Forwarded-Proto: https`、`Tailscale-User-Login` 等（僅 Serve；Funnel 不加）。Mix Studio 用這些標頭**只做「這是遠端請求」的判定，不做免密登入** |
| 禁止 | `tailscale funnel` 任何形式；`/api/spark-access/enable` 永久 403 |
| 手機端 | 安裝 Tailscale App，登入同一帳號；PWA 用 `https://<host>.<tailnet>.ts.net/` 安裝一次即可 |

## 7. Session

```
登入  POST /api/profiles/:id/login {pin}
  ├─ 節流 key = clientAddress(req) + profileId   （clientAddress 見 15 號 §1.4）
  ├─ verifyPin；非本機請求且 profile 無 PIN → 拒絕
  └─ Set-Cookie: ks_profile=<v2 token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; [Secure if https]
v2 token = v2.<profileId>.<issuedAt>.<sessionVersion>.<hmac16bytes-base64url>
  驗證：簽章正確 ∧ now - issuedAt ≤ 30d ∧ sessionVersion == profile.sessionVersion
  舊 v1 token（id.sig）→ 一律視為未登入（強制重新登入一次）
登出  POST /api/logout            → 清 cookie
登出所有裝置 / 改 PIN            → profile.sessionVersion += 1
本機免登入（唯一無 PIN profile）→ 只在 isTrustedLocalRequest(req) 為 true 時
```
Cookie 不分 port → 3300 與 3301 共用同一個 session。

## 8. 檔案流

```
[手機上傳] ─POST /api/upload (2GB上限, 白名單)─▶ data/inputs/.upload-*.tmp
     ├─ magic-bytes 驗證失敗 → 415，刪 tmp
     └─ OK → uploadFileToComfy → ComfyUI/input/ks_<ts>_<rand>_<name>
                                → rename 到 data/inputs/<同名>（durable 複本）
[生成] ─/prompt─▶ ComfyUI 執行 ─▶ ComfyUI/output/<prefix>_*.png|mp4
     └─ completeJob: /view 下載 → data/images/ | data/videos/ → db.json item
[素材庫] /images/<file> /videos/<file> /video-previews/<file>（需登入 + profile 檢查）
[刪除] → data/trash/（lib/deleted-media.js），可還原
[MCWW 上傳] ─:3301 /gradio_api/upload─▶ Gradio temp（GRADIO_TEMP_DIR）→ MCWW 存入 ComfyUI/input
[MCWW 輸出] → ComfyUI/output/ → 經 :3301 /gradio_api/file=… 瀏覽（allowed_paths 限制）
[備份] data/backups/db-*.json（開機 + 每 30 分，40 份）；sync-upstream 前另外整包 zip data/
```

## 9. Queue

- **單一 GPU、單一 ComfyUI 佇列**：Mix Studio 與 MCWW 各自維護前端佇列，最後都進 ComfyUI 的 `/prompt` 佇列，由 ComfyUI 串行執行。兩邊同時送會互相排隊，不會撞 GPU。
- Mix Studio：`jobs` Map（L1000）→ SSE `/api/events`；重排 `/api/queue/reorder`（呼叫 ComfyUI queue 重排）；取消 `/api/queue/cancel`；重試 = 前端以相同 params 重新 POST。
- MCWW：`mcww/queueing.py` 自己的佇列 + `progress_sse`；只在 MCWW 頁面內可見。
- 簡易殼層任務頁**只顯示 Mix Studio 的任務**；MCWW 執行中時，Mix Studio 的 ETA 會因 ComfyUI 忙碌而延後——任務頁需顯示「ComfyUI 正在執行其他工作（自訂工作流）」（來源：ComfyUI `/queue` 的 `queue_running` 中 `prompt_id` 不在 `jobs` Map 內）。
- 重開機：Mix Studio 啟動時 `pendingSmartRecoveryIds` / `public/job-reconciliation.js` 對帳；ComfyUI 佇列不持久化 → 未執行的任務標記為「失敗（主機重啟）」並提供重試。

## 10. 輸出儲存

| 資料 | 位置 | 進 git？ | 備份 |
|---|---|---|---|
| 生成圖／影 | `data/images/`、`data/videos/` | 否 | 使用者自行（建議 `scripts/zh/backup-data.ps1` 每日 zip 到第二顆碟） |
| 索引 | `data/db.json` | 否 | `data/backups/` 自動 |
| 設定 | `data/settings.json`、`data/zh-tw.json`（新增）、`data/auth_secret.txt` | 否 | 同上 |
| ComfyUI 原始輸出 | `ComfyUI/output/` | 否 | 保留，不清理（災難復原） |
| MCWW 狀態 | `custom_nodes/Minimalistic-Comfy-Wrapper-WebUI/storage/` | 否 | 同 ComfyUI 備份 |
| 模型 | `ComfyUI/models/` + `extra_model_paths.yaml` 指向的目錄 | 否 | 不備份（可重下） |

## 11. 啟動順序與開機恢復

```
Windows 開機 → 工作排程器「MixStudio」(登入時觸發, 延遲 30 秒)
  → start.bat → node server.js
      ├─ 讀 settings、db、auth_secret；backupDb('boot')
      ├─ listener A :3300、listener B :3301 起來
      ├─ 若 settings.comfyAutoStart（既有 /api/comfy/start 邏輯）→ startComfy()
      │     → ComfyUI 起來 → 載入 MCWW → 7860 起來
      ├─ ensureWs() 連 ComfyUI；失敗每 N 秒重試
      └─ 對帳未完成任務
tailscaled 為 Windows 服務，serve 設定持久化 → 不需重設
```

## 12. Fork 目錄配置（自訂碼集中）

```
Mix-Studio/                         (origin = 你的 fork, upstream = BlackMixture)
├─ server.js                        少量 [ZH-TW-CUSTOM] 掛鉤（見 17 號 WP 清單）
├─ lib/zh/                          ★ 新增，全部自訂
│   ├─ config.js                    讀寫 data/zh-tw.json
│   ├─ mcww-proxy.js                listener B
│   ├─ mcww-status.js               健康檢查、URL 計算、recent workflows
│   ├─ trusted-local.js             isTrustedLocalRequest / clientAddress
│   ├─ session-v2.js                token v2 簽發／驗證
│   ├─ upload-guard.js              副檔名 + magic bytes 白名單
│   ├─ security-headers.js          CSP 等
│   └─ simple-capabilities.js       /api/simple/capabilities
├─ public/simple/                   ★ 新增：簡易殼層
│   ├─ index.html  app.js  style.css  manifest.webmanifest  sw.js
│   └─ locales/zh-TW.json  (en.json 備用)
├─ scripts/zh/                      ★ 新增：install.ps1 setup-mcww.ps1 tailscale-mcww.ps1
│                                     firewall.ps1 sync-upstream.ps1 backup-data.ps1 verify-ports.ps1
├─ test/zh-*.test.js                ★ 新增測試
├─ docs/zh-tw/                      ★ 本套 10～18 號文件
└─ data/                            不進 git
```
