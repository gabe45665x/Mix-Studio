# 13_MCWW_INTEGRATION_SPEC.md — MCWW Sidecar 整合規格

> 決策依據：`09_REVIEW_FINDINGS.md` D1（已核准）。程式定位見 `12_SOURCE_CODE_MAP.md` §B。
> 原則：**MCWW 原始碼零修改**；所有整合邏輯在 Mix Studio Fork 的 `lib/zh/` 與 `scripts/zh/`。

## 1. Sidecar 啟動方式

### 1.1 安裝（`scripts/zh/setup-mcww.ps1`，owner 在主機執行一次）

```powershell
# 參數：-ComfyPath "D:\ComfyUI"（ComfyUI 根目錄，內含 custom_nodes\、user\、models\）
#       -PythonExe  "D:\ComfyUI\python_embeded\python.exe"   # portable
#                   或 "<Desktop 安裝目錄>\.venv\Scripts\python.exe" # Desktop（Codex 需在目標機確認實際路徑）
$mcww = Join-Path $ComfyPath "custom_nodes\Minimalistic-Comfy-Wrapper-WebUI"
if (-not (Test-Path $mcww)) {
  git clone https://github.com/light-and-ray/Minimalistic-Comfy-Wrapper-WebUI $mcww
}
git -C $mcww fetch --all
git -C $mcww checkout 1f65c75b96a1eccec906ac3b613906752bc569a6   # 釘死審查基準
& $PythonExe -m pip install -r (Join-Path $mcww "requirements.txt")
New-Item -ItemType Directory -Force (Join-Path $ComfyPath "user\default\workflows\mcww") | Out-Null
# 寫入 .env（見 §1.2），不覆蓋使用者已有的自訂行
```

安裝後驗證（腳本自動做）：
1. 啟動／重啟 ComfyUI，console 必須出現 Gradio 啟動訊息且**沒有** `ImportError` / `pydantic` 版本錯誤（gradio 5.49.1 會帶入 fastapi/pydantic；若與 ComfyUI 衝突，記錄版本並停止，不要硬升級 ComfyUI 的套件）。
2. `curl http://127.0.0.1:8188/mcww/available_at` → `{"port":7860,"shareUrl":null}`。
3. `curl -I http://127.0.0.1:7860/config` → 200。
4. `netstat -ano | findstr :7860` → 只有 `127.0.0.1:7860`。

### 1.2 `.env`（路徑：`custom_nodes\Minimalistic-Comfy-Wrapper-WebUI\.env`，由 `mcww/opts.py` L9 `dotenv_path` 載入）

```ini
# --- 本專案固定值（scripts/zh/setup-mcww.ps1 產生） ---
GRADIO_SERVER_NAME=127.0.0.1
GRADIO_SERVER_PORT=7860
GRADIO_NUM_PORTS=1
GRADIO_ANALYTICS_ENABLED=0
GRADIO_TEMP_DIR=D:\ComfyUI\temp\mcww
MCWW_WORKFLOWS_SUBDIR=mcww
WEBUI_TITLE=自訂工作流
WEBUI_TITLE_SHORT=自訂工作流
REQUESTS_TIMEOUT_NORMAL_SEC=30
REQUESTS_TIMEOUT_BIG_SEC=600
# --- 明確不設定（設了就違反 R-64） ---
# MCWW_AUTH=            ← 登入由 Mix Studio 代理負責；Gradio 自己的 /login 在代理層封鎖
# GRADIO_SHARE=         ← 禁止
# FRP_SHARE_SERVER_*=   ← 禁止
# COMFY_MCWW_BUTTON_URL_OVERRIDE=  ← 不設；ComfyUI 桌面前端的 MCWW 按鈕只在主機本機使用
# MCWW_COMFY_BUTTON_URL_OVERRIDE=  ← 第一版不設（見 §7 註記）
```

理由：
- `GRADIO_NUM_PORTS=1`：預設 100 會在 7860 被占用時漂移到 7861…，代理會找不到它。寧可啟動失敗並在狀態頁顯示。
- `GRADIO_ANALYTICS_ENABLED=0`：MCWW 本身已在 `mcww/ui/mainUI.py` L23/L32 關閉，這裡雙保險。
- `REQUESTS_TIMEOUT_BIG_SEC=600`：影片工作流常超過 120 秒。

### 1.3 生命週期
MCWW 由 ComfyUI 載入時自動啟動（`__init__.py` → `launchInThread()`），沒有獨立的啟動／停止。Mix Studio **不啟動 MCWW**，只啟動 ComfyUI（既有 `startComfy()`）。

## 2. URL

| 情境 | 使用者看到的 URL | 實際路徑 |
|---|---|---|
| 區網 | `http://<LAN-IP>:3301/` | 手機 → :3301（Mix Studio listener B）→ 127.0.0.1:7860 |
| Tailscale | `https://<host>.<tailnet>.ts.net:8443/` | 手機 → tailscaled(8443, TLS) → 127.0.0.1:3301 → 127.0.0.1:7860 |
| 主機本機 | `http://127.0.0.1:3301/` | 同區網；`http://127.0.0.1:7860/` 也可直接開（僅本機） |

**URL 永遠由 server 計算**，前端不寫死：
- `GET /api/custom-workflows/status`（3300，需登入）回傳 `openUrl`。
- `GET /custom-workflows/open`（3300，需登入）→ `302 Location: <openUrl>`（簡易殼層的按鈕連到這裡，`target="_blank" rel="noopener"`）。
- 計算規則（`lib/zh/mcww-status.js` `openUrlFor(req)`）：
  ```
  proto = req.headers['x-forwarded-proto'] === 'https' && isLoopback(remote) ? 'https' : 'http'
  hostname = (req.headers['x-forwarded-host'] || req.headers.host).split(':')[0]
  https → `https://${hostname}:8443/`      （Tailscale）
  http  → `http://${hostname}:${MCWW_PROXY_PORT}/`（區網 / 本機）
  ```

## 3. Proxy 路由規則（listener B，`lib/zh/mcww-proxy.js`）

### 3.1 處理順序（每個請求）
1. `pathname` 先 `decodeURIComponent` 失敗 → 400；含 `..` 或 `\` → 400。
2. **驗證**：`currentProfile(req)`（重用 `server.js` L916 的函式，經參數注入）為 null →
   - `Accept` 含 `text/html` → `302` 到 Mix Studio 登入頁 `<mixStudioUrl>/?next=custom-workflows`
   - 否則 → `401 {"error":"請先登入 Mix Studio","code":"auth"}`
3. `config.customWorkflows.ownerOnly`（預設 `true`）且 profile 不是 `db.profiles[0]` → `403 {"error":"只有擁有者可以使用自訂工作流"}`。
4. **拒絕清單**（前綴比對，大小寫不敏感）→ `404`：
   ```
   /proxy=            （Gradio 任意 URL 代理 → SSRF）
   /vibe-code /vibe-edit /undo-vibe-edit /vibe-starter-queries
   /monitoring        （Gradio 監控頁）
   /dev/reload
   /gradio_api/mcp    （Gradio 內建 MCP 伺服器）
   /login /logout /login_check /token /user   （Gradio 帳密機制，本專案不用）
   /process_recording
   /openapi.json
   ```
5. **CSRF**：`method ∉ {GET, HEAD, OPTIONS}` 時，`Origin` 存在且 `Origin !== expectedOrigin(req)` → `403`；`Origin` 不存在時檢查 `Sec-Fetch-Site ∈ {same-origin, none}`，否則 `403`。`expectedOrigin` = `${proto}://${req.headers.host}`（同 §2 計算）。
6. **大小**：`content-length > 2 GiB` → `413`；無 content-length 的串流計數超過 2 GiB → 中止並 `413`。
7. **轉發**（見 §3.2）。

### 3.2 轉發細節

| 項目 | 規則 |
|---|---|
| 目標 | `http://127.0.0.1:${MCWW_PORT}`（預設 7860，讀 `data/zh-tw.json` `mcww.port`） |
| Method / path / query | 原樣（不改寫路徑；根路徑一對一） |
| 移除的請求標頭 | `host`、`connection`、`keep-alive`、`proxy-authorization`、`proxy-connection`、`te`、`trailer`、`upgrade`（非 upgrade 請求時）、所有 `x-forwarded-*`、`forwarded`、所有 `tailscale-*` |
| 改寫的請求標頭 | `Host: 127.0.0.1:7860`；`Cookie`：解析後**移除** `ks_profile`、`ks_private`，其餘保留（Gradio 自己的 cookie 可通過） |
| 新增的請求標頭 | `X-Forwarded-Host: <原 req.headers.host>`（**必須含 port**，例如 `192.168.1.10:3301` 或 `host.ts.net:8443`）；`X-Forwarded-Proto: https|http`（§2 規則）；`X-Forwarded-For: <clientAddress(req)>` |
| 為何要 X-Forwarded-Host | Gradio `route_utils.get_request_origin()` 以 `x-forwarded-host` + `x-forwarded-proto` 計算 `config.root`，前端所有 `/gradio_api/*` 呼叫都以此為基底；沒有它前端會打 `127.0.0.1:7860` |
| 請求 body | `req.pipe(proxyReq)` 串流，不落地 |
| 回應狀態／標頭 | 原樣轉回，移除 `connection`、`keep-alive`、`transfer-encoding`；**覆蓋／新增**安全標頭（§8） |
| 回應 body | `proxyRes.pipe(res)` 串流 |
| SSE | 偵測 `content-type: text/event-stream` → `res.flushHeaders()`；`res.socket.setNoDelay(true)`；`res.socket.setTimeout(0)`；不做任何緩衝或壓縮 |
| 逾時 | 代理請求不設 timeout；listener B：`server.requestTimeout = 0`、`server.headersTimeout = 65000`、`server.keepAliveTimeout = 65000` |
| 上游錯誤 | `ECONNREFUSED` / `ETIMEDOUT` → §6 回退頁 |
| 日誌 | 只記 `method path status ms`（不記 query、不記 body、不記 cookie） |

### 3.3 參考骨架（Codex 依此實作，zero-dependency）

```js
// lib/zh/mcww-proxy.js
'use strict';
const http = require('http');
const net = require('net');
const DENY = ['/proxy=', '/vibe-code', '/vibe-edit', '/undo-vibe-edit', '/vibe-starter-queries',
  '/monitoring', '/dev/reload', '/gradio_api/mcp', '/login', '/logout', '/login_check', '/token',
  '/user', '/process_recording', '/openapi.json'];
const HOP = new Set(['host','connection','keep-alive','proxy-authorization','proxy-connection','te','trailer','upgrade','forwarded']);
const MAX_BODY = 2 * 1024 * 1024 * 1024;

function createMcwwProxy(deps) {
  // deps: { targetPort, authenticate(req) -> {profile, isOwner} | null, ownerOnly(), clientAddress(req),
  //         isForwardedHttps(req), securityHeaders(req), fallbackHtml(reason, req), log }
  const server = http.createServer((req, res) => proxyHttp(req, res, deps));
  server.on('upgrade', (req, socket, head) => proxyUpgrade(req, socket, head, deps));
  server.requestTimeout = 0; server.headersTimeout = 65000; server.keepAliveTimeout = 65000;
  return server;
}
function gate(req, deps) {  // 回傳 null = 通過；否則 {status, body}
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return { status: 400 }; }
  if (pathname.includes('..') || pathname.includes('\\')) return { status: 400 };
  const auth = deps.authenticate(req);
  if (!auth) return { status: 401, code: 'auth' };
  if (deps.ownerOnly() && !auth.isOwner) return { status: 403 };
  const low = pathname.toLowerCase();
  if (DENY.some((p) => low === p || low.startsWith(p))) return { status: 404 };
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const expected = `${deps.isForwardedHttps(req) ? 'https' : 'http'}://${req.headers.host}`;
    const origin = req.headers.origin;
    const sfs = req.headers['sec-fetch-site'];
    if ((origin && origin !== expected) || (!origin && sfs && !['same-origin','none'].includes(sfs))) return { status: 403 };
  }
  if (Number(req.headers['content-length']) > MAX_BODY) return { status: 413 };
  return null;
}
function upstreamHeaders(req, deps) {
  const out = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (HOP.has(key) || key.startsWith('x-forwarded-') || key.startsWith('tailscale-')) continue;
    if (key === 'cookie') { const kept = String(v).split(';').map(s => s.trim()).filter(c => !/^(ks_profile|ks_private)=/.test(c)); if (kept.length) out.cookie = kept.join('; '); continue; }
    out[k] = v;
  }
  out.host = `127.0.0.1:${deps.targetPort}`;
  out['x-forwarded-host'] = req.headers.host;
  out['x-forwarded-proto'] = deps.isForwardedHttps(req) ? 'https' : 'http';
  out['x-forwarded-for'] = deps.clientAddress(req);
  return out;
}
// proxyHttp: gate → http.request({host:'127.0.0.1', port, method, path: req.url, headers}) →
//   req.pipe(proxyReq)（並計數 > MAX_BODY 時 destroy）→ proxyRes: 複製 status/headers（去 hop-by-hop）
//   → Object.assign(headers, deps.securityHeaders(req)) → if text/event-stream: flushHeaders + setNoDelay + setTimeout(0)
//   → proxyRes.pipe(res)；proxyReq.on('error') → 502（Accept text/html → fallbackHtml；否則 JSON）
// proxyUpgrade: gate（失敗直接寫 'HTTP/1.1 401 …\r\n\r\n' 後 destroy）→ net.connect(port,'127.0.0.1') →
//   寫入 `${req.method} ${req.url} HTTP/1.1\r\n` + upstreamHeaders（保留 upgrade / connection: Upgrade / sec-websocket-*）
//   + head → socket.pipe(upstream).pipe(socket)；任一方 error/close → 兩邊 destroy
module.exports = { createMcwwProxy, gate, upstreamHeaders, DENY };
```

## 4. WebSocket 路由

- **現況**：MCWW 2.4.4 + Gradio 5.49.1 **不使用 WebSocket**（進度走 `/mcww_api/progress_sse` 與 `/gradio_api/queue/data` 兩條 SSE；`gradio/routes.py` 無 `@app.websocket`）。
- **仍需實作** `server.on('upgrade')` 直通（§3.3 `proxyUpgrade`），原因：企劃書要求、未來 Gradio 版本可能改用 WS、成本約 40 行。
- 驗證：`test/zh-mcww-proxy.test.js` 以假上游 WS 伺服器做 echo 測試。

## 5. 靜態資源、上傳、輸出

| 類別 | 路徑（7860 端） | 代理處理 |
|---|---|---|
| Gradio 靜態 | `/assets/*`、`/static/*`、`/svelte/*`、`/theme.css`、`/manifest.json`、`/pwa_icon*`、`/favicon.ico`、`/custom_component/*` | 直通；保留上游 `cache-control`/`etag` |
| MCWW 自有前端 | 經 Gradio `allowed_paths` 提供（`mcww_web/`）：`/gradio_api/file=<MCWW_WEB_DIR>/…` 及 `/pwa/*` | 直通 |
| MCWW API | `/mcww_api/queue_version`、`/mcww_api/outputs_version/*`、`/mcww_api/queue_indicator`、`/mcww_api/progress_sse`（SSE） | 直通；SSE 規則 |
| Gradio 佇列 | `POST /gradio_api/queue/join`、`GET /gradio_api/queue/data`（SSE）、`/gradio_api/heartbeat/*`、`/gradio_api/cancel`、`/gradio_api/info`、`/config` | 直通 |
| **上傳** | `POST /gradio_api/upload`（multipart，可多檔）、`/gradio_api/upload_progress` | 串流直通；2 GiB 上限；不落地於 Mix Studio；Gradio 寫入 `GRADIO_TEMP_DIR`，MCWW 再存入 `ComfyUI/input/` |
| **輸出／預覽** | `/gradio_api/file=<絕對路徑>`、`/file=…`、`/gradio_api/stream/*`（影片 HLS） | 直通；上游 `allowed_paths` 只含 `mcww_web/`、`storage/thumbnails`、`ComfyUI/input`、`ComfyUI/output`（`mainUI.py` L113–L116）；**Codex 不得擴大** |
| PWA | `/pwa/serviceWorker.js`（MCWW 自有 SW，scope `/pwa/`）、`/manifest.json` | 直通；因為 3301 是獨立 origin，與 Mix Studio 的 SW 互不影響 |

上傳格式白名單**不在代理層做**（Gradio 的 multipart 需完整解析才能驗），改由 MCWW 工作流的 Load Image/Video 節點決定；風險已由「僅登入者可用 + 檔案只進 ComfyUI input」限縮。若日後要在代理層驗，需完整 multipart 解析，列為第二版。

## 6. 錯誤回退

| 狀況 | 偵測 | 行為 |
|---|---|---|
| MCWW 未啟動（7860 拒絕連線） | 代理 `ECONNREFUSED` | 導航請求 → 回 `503` HTML（zh-TW）：「自訂工作流尚未啟動。可能原因：ComfyUI 未執行、MCWW 未安裝、或 7860 被占用。」+「回到 Mix Studio」+（owner）「啟動 ComfyUI」按鈕（呼叫 3300 的 `/api/comfy/start`）；API 請求 → `503 {"error":"mcww_unavailable"}` |
| ComfyUI 未啟動但 MCWW… | 不可能（MCWW 在 ComfyUI 程序內） | — |
| 7860 被別的程式占用 | `GET http://127.0.0.1:7860/config` 回 200 但 body 不含 `"version"` 與 `"components"`（Gradio config 特徵） | 狀態頁顯示「7860 被其他程式占用」，代理回 502 |
| Tailscale 8443 未設定 | `tailscale serve status --json` 無 `127.0.0.1:3301` | 狀態頁提示「外出時尚未啟用自訂工作流 HTTPS」+ 一鍵啟用 |
| 登入過期 | 代理 401/302 | 回 Mix Studio 登入，登入後 `?next=custom-workflows` 自動再開 |
| iframe 被拒 | 若啟用 iframe 模式且瀏覽器阻擋 | 簡易殼層偵測 iframe `load` 逾時 5 秒 → 改用新分頁 |

## 7. iframe 或新分頁

**決定：預設「新分頁」**（Android PWA 內會以 Chrome Custom Tab 開啟）；iframe 為可選設定 `customWorkflows.iframe=false`。

理由：
1. 3301 是不同 origin，同網域全頁模式已不可行（D1）。
2. Gradio 版面需要完整 viewport，手機上 iframe 內捲動與鍵盤行為差。
3. 新分頁不需要放寬 `frame-ancestors`。

iframe 模式（若 owner 開啟）：3301 回應加 `Content-Security-Policy: frame-ancestors <mixStudioOrigin>`（依 §2 計算的 `http://<hostname>:3300` 或 `https://<hostname>`），不設 `X-Frame-Options`；簡易殼層以 `<iframe src=/custom-workflows/open>` 全螢幕嵌入並提供「另開視窗」。

註記：MCWW 頁尾有「Open ComfyUI」按鈕，預設指向 `buildLocalLink(8188)`（`mcww/ui/uiUtils.py` L54–L60），在手機上會變成 `http://<手機看到的主機名>:8188` — 這不是資訊外洩（8188 未開放），但違反 R-63 的觀感。第一版接受；第二版評估以 `MCWW_COMFY_BUTTON_URL_OVERRIDE` 指回 Mix Studio（Codex 需先確認該值的 JS 引號處理，`.env.example` 範例為裸值）。

## 8. 安全限制（3301 專用；全站規則見 15 號文件）

| 項目 | 規則 |
|---|---|
| 認證 | 只認 Mix Studio `ks_profile` v2 token；不轉交給 Gradio |
| 授權 | 預設 owner-only |
| 綁定 | 與 listener A 同 `MIXBOX_HOST`；防火牆 Private 放行 3301 |
| CSP（3301） | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` — Gradio 前端需要 inline/eval；`font-src 'self'` 會擋 Google Fonts（Gradio 主題可能引用），字型退回系統字，可接受 |
| 其他標頭 | `X-Frame-Options: DENY`（iframe 模式時不設）、`Referrer-Policy: same-origin`、`X-Content-Type-Options: nosniff`、`Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| CORS | 不加任何 `Access-Control-*`；ComfyUI 不加 `--enable-cors-header` |
| 拒絕清單 | §3.1 第 4 點 |
| Open proxy 防護 | 目標寫死 `127.0.0.1:<port>`，不從請求取得目標 |
| 速率 | 每 client 每秒 ≤ 60 個請求（token bucket，超過 429）—避免 SSE 重連風暴 |
| 日誌脫敏 | 不記 query／cookie／body |

## 9. Mix Studio 端新增路由（3300，`handleApi` 內，`// [ZH-TW-CUSTOM]`）

| 路由 | 權限 | 回應 |
|---|---|---|
| `GET /api/custom-workflows/status` | 登入 | `{ running, reason, port, openUrl, lanUrl, tailscaleUrl, tailscaleConfigured, ownerOnly, iframe, recent:[{name, modifiedAt}] }` |
| `GET /custom-workflows/open` | 登入（+ownerOnly） | `302 → openUrl` |
| `GET /api/custom-workflows/recent` | 登入 | 列 `ComfyUI/user/default/workflows/mcww/*.json`（只列檔名與 mtime，不讀內容；路徑來自 `RUNTIME.comfy.path`，不接受參數） |
| `POST /api/custom-workflows/enable-https` | owner | 執行 `runTailscale(['serve','--bg','--yes','--https=8443','http://127.0.0.1:3301'])`；前置：`tailscaleHttpsStatus(3300).configured === true`，否則回 409 要求先啟用 Mix Studio HTTPS |
| `POST /api/custom-workflows/settings` | owner | `{ ownerOnly, iframe }` 寫 `data/zh-tw.json` |

## 10. Codex 修改清單

| # | 檔案 | 動作 |
|---|---|---|
| 1 | `lib/zh/mcww-proxy.js` | 新增（§3.3） |
| 2 | `lib/zh/mcww-status.js` | 新增：`probeMcww()`（GET 127.0.0.1:7860/config，2 秒逾時，驗 Gradio 特徵）、`openUrlFor(req)`、`listRecentWorkflows(comfyPath)`、`mcwwTailscaleStatus()`（解析 `tailscale serve status --json` 找 3301） |
| 3 | `lib/zh/config.js` | 新增：`data/zh-tw.json` 讀寫，預設 `{ mcww:{port:7860}, customWorkflows:{ownerOnly:true, iframe:false}, proxyPort:3301 }` |
| 4 | `server.js` | 在 `server.listen(...)`（L12162）之後加 `// [ZH-TW-CUSTOM] MCWW proxy`：建立 `createMcwwProxy({...})` 並 `listen(zh.proxyPort, HOST)`；在 `handleApi` 加 §9 路由；在主分派器加 `/custom-workflows/open` |
| 5 | `scripts/zh/setup-mcww.ps1` | 新增（§1.1） |
| 6 | `scripts/zh/tailscale-mcww.ps1` | 新增：等同 §9 enable-https 的命令列版 |
| 7 | `scripts/zh/verify-ports.ps1` | 新增：`netstat -ano` 檢查 8188/7860 只在 127.0.0.1、3300/3301 在預期 HOST |
| 8 | `public/simple/`（自訂工作流頁） | 新增：狀態卡、說明卡、開啟按鈕（`/custom-workflows/open`）、最近工作流列表、owner 的啟用 HTTPS 按鈕 |
| 9 | `test/zh-mcww-proxy.test.js` | 新增：401 未登入、403 非 owner、404 拒絕清單、403 跨站 POST、X-Forwarded-Host 含 port、cookie 剝離、SSE 分段即時到達、upgrade echo、上游斷線 502/503、413 |
| 10 | `docs/zh-tw/13_MCWW_INTEGRATION_SPEC.md` | 本文件入庫 |

**不改**：MCWW 任何檔案、ComfyUI 任何檔案、Mix Studio `public/app.js`（原介面不加 MCWW 入口，避免衝突）。

## 11. 驗收（對應 18 號文件測試 8、17）

1. 手機區網開 `http://<LAN-IP>:3301/` 未登入 → 被導到 Mix Studio 登入；登入後回到 MCWW 首頁，能看到 `example_workflows/extract audio MCWW.json`（安裝時複製到 `mcww/` 資料夾作為範例）。
2. 執行一次工作流，進度條有動、輸出可預覽、可下載。
3. 手機 4G + Tailscale 開 `https://<host>.<tailnet>.ts.net:8443/` 重複 1–2。
4. `curl http://<LAN-IP>:8188/` 與 `:7860/` 從手機／另一台電腦皆連線失敗。
5. `curl -H "Cookie: ks_profile=garbage" http://<LAN-IP>:3301/config` → 401。
6. `curl http://<LAN-IP>:3301/proxy=http://example.com`（帶有效 cookie）→ 404。
