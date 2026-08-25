# 15_SECURITY_SPEC.md — 安全規格

> 對應 `09_REVIEW_FINDINGS.md` §3（S1～S11）與 `10_MASTER_REQUIREMENTS.md` R-28、R-55、R-57、R-60～R-69。
> 每一項都有：規則 → 既有程式位置 → Codex 修改 → 驗證方法。內容自由（無提示詞封鎖）與系統安全分開處理：本文件**只管系統安全**。

## 0. 信任模型

| 主體 | 信任 |
|---|---|
| 主機本人（loopback，無轉發標頭） | 完全信任（可用開放 profile、可建 profile、可跑 owner 動作） |
| 區網裝置 | 不信任，需 PIN 登入；owner 動作需 owner profile |
| Tailscale 裝置 | 不信任（同區網）；Tailscale 身分標頭**不用於免密登入**（Mix Studio 監聽非 loopback，標頭可被區網偽造） |
| 公網 | 不存在（無 Funnel、無 port forward） |
| 已登入的 profile | 可生成、可看自己的素材；owner 另可改設定、安裝、更新、用 MCWW |

## 1. 登入

### 1.1 規則
| 編號 | 規則 |
|---|---|
| S-01 | Owner（`db.profiles[0]`）**必須**有 PIN。無 PIN 時所有非 loopback 請求只允許 `/api/profiles`（GET）、`/api/profiles/:id/login`、靜態檔；其他 API 回 `403 {code:'owner_pin_required'}`，簡易殼層顯示「請先在主機設定擁有者 PIN」 |
| S-02 | PIN 最少 6 碼、最多 64 碼；拒絕全同字元（`000000`）、連號（`123456`/`654321`）、與 profile 名稱相同 |
| S-03 | 非 `isTrustedLocalRequest` 的登入，profile 必須有 PIN；對無 PIN profile 的遠端登入回 `403 {code:'pin_required'}`（原本 `verifyPin()` 對無 PIN 一律 true 的行為只保留給本機） |
| S-04 | 暴力嘗試：沿用 `createLoginThrottle`（5 次/5 分/鎖 10 分），但節流 key 改用 `clientAddress(req)`（§1.4），並加**全域**節流：任一來源 1 分鐘內 > 30 次失敗 → 所有遠端登入鎖 5 分鐘 |
| S-05 | 登入失敗回應統一 `401 {error:'PIN 錯誤'}`，不透露 profile 是否存在（現有 404 'Profile not found' 改為同樣 401） |

### 1.2 既有位置
`lib/profiles.js` `hashPin` L8、`verifyPin` L19、`createLoginThrottle` L55；`server.js` 登入 L7046–L7071、建立 profile L7024（PIN 可選）、`profMan`（改 PIN）L7094。

### 1.3 Codex 修改
- `lib/zh/pin-policy.js`：`validatePin(pin, profileName) → {ok, reason}`；在 `POST /api/profiles`（L7024）與改 PIN 路由呼叫。
- `server.js` L7046：`if (!isTrustedLocalRequest(req) && !target.pinHash) return json(res, 403, {code:'pin_required'})`。
- `server.js` `handleApi` 開頭（L7000 附近）：owner 無 PIN 且非本機 → S-01 阻擋。
- 簡易殼層首次啟動流程強制設定 owner PIN（10 號 §5.1）。

### 1.4 `clientAddress(req)` 與 `isTrustedLocalRequest(req)`（`lib/zh/trusted-local.js`）
```js
function hasForwardingHeaders(h) {
  return !!(h['x-forwarded-for'] || h['x-forwarded-host'] || h['x-forwarded-proto'] || h['forwarded']
    || Object.keys(h).some((k) => k.startsWith('tailscale-')));
}
function isTrustedLocalRequest(req) {          // 取代所有 isLoopbackRequest(req) 的語意
  return isLoopbackAddress(requestAddress(req)) && !hasForwardingHeaders(req.headers);
}
function clientAddress(req) {                  // 用於節流 key 與日誌
  const remote = requestAddress(req);
  if (isLoopbackAddress(remote) && req.headers['x-forwarded-for']) {
    return String(req.headers['x-forwarded-for']).split(',')[0].trim() || remote;   // 只在 loopback 來源時信任
  }
  return remote;
}
function isForwardedHttps(req) {
  return isLoopbackAddress(requestAddress(req)) && req.headers['x-forwarded-proto'] === 'https';
}
```
`server.js` 中 `isLoopbackRequest(req)` 的三個使用點（`currentProfile` L916、`/api/profiles` GET L7011、POST L7024）改呼叫 `isTrustedLocalRequest`。

### 1.5 驗證
- 從手機 `curl -X POST http://<LAN>:3300/api/profiles/<ownerId>/login -d '{"pin":""}'` → 403。
- 連錯 5 次 → 第 6 次 429 + `Retry-After`。
- 主機本機 `curl http://127.0.0.1:3300/api/me` 無 cookie → 200（開放 profile 仍可用於本機）；加 `-H "X-Forwarded-For: 1.2.3.4"` → 401。

## 2. Session

| 編號 | 規則 |
|---|---|
| S-10 | Token v2：`v2.<id>.<issuedAt>.<sessionVersion>.<sig>`；`sig = base64url(HMAC-SHA256(AUTH_SECRET, "id|issuedAt|sessionVersion")).slice(0,22)`；有效期 30 天（`SESSION_MAX_AGE_MS`，可在 `data/zh-tw.json` 調整，上限 90 天） |
| S-11 | `profile.sessionVersion`（預設 0）：改 PIN、`POST /api/logout-all`（新增）→ +1，所有既有 token 立即失效 |
| S-12 | 舊 v1 token（`id.sig`）視為無效（升級後所有裝置重新登入一次） |
| S-13 | Cookie：`ks_profile=<v2>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`；當 `isForwardedHttps(req)` 為 true 時加 `; Secure`。`ks_private` 同規則 |
| S-14 | 登入成功後重新簽發（滑動延長）：每次 `/api/me` 若 token 剩餘 < 7 天則 Set-Cookie 新 token |
| S-15 | `AUTH_SECRET`（`data/auth_secret.txt`，L853）維持；備份包含它，否則還原後所有人登出 |

Codex：`lib/zh/session-v2.js`（`issueToken`、`parseToken`），替換 `server.js` 中 `signProfileId`/`parseProfileToken` 的 6 個呼叫點（L7007、L7043、L7069、L7120、`currentProfile` L918、L11150 私密 cookie 另用 `ks_private`），`profileCookie()` L930 加 `secure` 參數。測試 `test/zh-session-v2.test.js`：過期、版本不符、簽章錯、v1 拒絕、Secure 旗標。

## 3. CSRF

| 編號 | 規則 |
|---|---|
| S-20 | 所有 `/api/*` 非 GET/HEAD/OPTIONS 請求：若有 `Origin` → 必須等於 `${proto}://${req.headers.host}`；無 `Origin` 時 `Sec-Fetch-Site` 必須是 `same-origin` 或 `none`（或不存在，向後相容舊瀏覽器與 curl-from-localhost）；不符 → `403 {code:'csrf'}` |
| S-21 | `SameSite=Lax` 維持（第一道防線） |
| S-22 | `/mcp/*`（Spark）整段停用（§9），不需 CSRF 例外 |
| S-23 | 3301 代理同規則（13 號 §3.1 第 5 點） |

Codex：`lib/zh/security-headers.js` `assertSameOrigin(req)`；在 `handleApi` 開頭（`/api/analytics-config` 之後、profile 判定之前）呼叫。測試：跨 Origin POST → 403。

## 4. CORS

| 編號 | 規則 |
|---|---|
| S-30 | Mix Studio 3300/3301 **不**發任何 `Access-Control-*` 標頭（現況已如此，維持） |
| S-31 | ComfyUI 啟動參數**不得**含 `--enable-cors-header`；`lib/comfy-restart.js` L91 附近組參數處加斷言：若 settings 裡出現該旗標 → 移除並記警告 |
| S-32 | MCWW 不用 `direct_links` 模式（extension 模式固定 `same_server`） |

## 5. CSP 與安全標頭

### 5.1 3300（Mix Studio；`public/index.html` 無 inline script、無 inline handler，可用嚴格 script-src）
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  font-src 'self' data:;
  connect-src 'self';
  worker-src 'self';
  manifest-src 'self';
  frame-src 'self' <mcwwOrigin-if-iframe-mode>;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```
- `connect-src 'self'` 直接封鎖 `us.i.posthog.com`（§9 雙保險）。
- `img-src` 不含 `https:`：Mix Studio 設定頁的 HuggingFace 連結是 `<a>` 不受影響；若 Codex 發現任何外部 `<img>`（如 `docs/download` 品牌圖只在 GitHub Pages 用）需列出後再決定。
- 先以 `Content-Security-Policy-Report-Only` 跑 1 天，`report-to` 指向本機 `POST /api/csp-report`（只寫日誌），確認 `/studio` 全功能無違規後轉正式。
- 3301 的 CSP 見 13 號 §8。

### 5.2 Codex
`lib/zh/security-headers.js` `applySecurityHeaders(res, {mode:'app'|'proxy', req})`；在 `server.js` 主分派器 L12027 進入處呼叫（所有回應）；`json()`/`serveFile()` 不需改。測試：`GET /` 回應含上述標頭。

## 6. Upload

| 編號 | 規則 |
|---|---|
| S-40 | 副檔名白名單（不分大小寫）：圖片 `png jpg jpeg webp`；影片 `mp4 mov webm`；音訊 `wav mp3 m4a flac ogg`；其餘 → `415 {code:'unsupported_type'}` |
| S-41 | Magic bytes 驗證（前 16 bytes）：PNG `89 50 4E 47 0D 0A 1A 0A`；JPEG `FF D8 FF`；WebP `52 49 46 46 ?? ?? ?? ?? 57 45 42 50`；MP4/MOV/M4A offset 4 = `66 74 79 70`（`ftyp`）；WebM `1A 45 DF A3`；WAV `52 49 46 46 ?? ?? ?? ?? 57 41 56 45`；MP3 `49 44 33` 或 `FF Ex/FF Fx`；FLAC `66 4C 61 43`；OGG `4F 67 67 53`。副檔名與 magic 類別不一致 → 415 |
| S-42 | `Content-Type` 標頭只作參考，不作依據 |
| S-43 | 大小：圖片 ≤ 64 MB、影片／音訊 ≤ 2 GB（沿用 `MAX_INPUT_BYTES`）；超過 → 413，刪 tmp |
| S-44 | 檔名：沿用 L8217–L8218 清理（去路徑、控制字元、非 `[\w.\-]` → `_`）+ 隨機前綴；最終路徑必須在 `INPUTS` 之下（`inputAssetPath` 已保證，加 `path.resolve` 斷言） |
| S-45 | 暫存檔：`data/inputs/.upload-*.tmp` 在失敗時刪除（既有）；新增開機清理 > 24 小時的 `.tmp` |
| S-46 | ZIP（`.mixpack`，`/api/addons/install`）：只允許 owner；解壓每個 entry 以 `path.resolve(root, entry)` 驗證仍在 `root` 下（zip-slip）；單檔 ≤ 200 MB、總量 ≤ 1 GB、entry 數 ≤ 2000；拒絕 symlink |
| S-47 | 頭像（`/api/profiles/:id/avatar`，10 MB 上限既有）套 S-40/41 的圖片規則 |

Codex：`lib/zh/upload-guard.js` `inspectUpload(tmpPath, originalName) → {ok, kind, reason}`（讀前 16 bytes，可重用 `lib/media-inspection.js`）；在 `receiveInputFile` 完成後、`uploadFileToComfy` 之前呼叫（L8228）。測試：改副檔名的 `.exe`→415、正常 png→200、`.mixpack` 含 `../` entry → 400。

## 7. Proxy（3301 + Mix Studio 既有轉發）

| 編號 | 規則 |
|---|---|
| S-50 | 3301 代理目標寫死 `127.0.0.1:<port>`；路徑不改寫；拒絕清單；CSRF；owner-only；cookie 剝離（13 號 §3） |
| S-51 | `GET /api/input?name=`（L8176）：只允許 `name` 符合 `^ks_[\w.\-/]+$` 且無 `..`；或 `name` 存在於 `db.uploadedAssets` 且屬於該 profile。其他 → 404 |
| S-52 | `comfyFetch()`（L1461）的 base 只能來自 `settings.comfyUrl`，且啟動時斷言 hostname ∈ {127.0.0.1, localhost, ::1}；否則拒絕啟動並提示（防止設定被改成遠端主機造成 SSRF） |
| S-53 | `/api/setup/comfy/discover`、`lib/comfy-discovery.js`：維持只探測 loopback |
| S-54 | 任何 API 回應不得包含 `settings.comfyUrl` 或 `RUNTIME.comfy.path`（`/api/settings` GET 對非 loopback 請求過濾這兩個欄位；`/api/simple/*` 一律不含） |

## 8. Command Execution

現況（已審）：全部 `execFile`/`spawn` 且不用 shell；PowerShell 以 `-NoProfile -ExecutionPolicy Bypass -File <固定腳本>` 或 `-Command <程式內固定字串>` 執行（`server.js` L1201、`lib/comfy-restart.js` L192/L305、`lib/comfy-discovery.js` L188）；Git 用 `execFile(git, args)`（`lib/app-update.js` L37）。

| 編號 | 規則 |
|---|---|
| S-60 | 維持零 `shell:true`；Codex 新增的所有 `spawn/execFile` 禁止 `shell:true`，參數一律陣列 |
| S-61 | 使用者可控字串（路徑、名稱）進入命令參數前：路徑必須 `path.resolve` 後位於允許根目錄（ComfyUI 根、`data/`）；名稱必須通過 `^[\w.\-]+$` |
| S-62 | 允許執行的外部程式白名單：`git`、`tailscale`、`powershell.exe`（System32 絕對路徑）、ComfyUI 的 python（`RUNTIME.comfy.path` 下）、`ffmpeg`（PATH 或設定路徑）、`node`（自身）。新增其他程式需寫入本表 |
| S-63 | `-ExecutionPolicy Bypass` 只用於 repo 內 `installer/*.ps1`、`scripts/zh/*.ps1`；腳本路徑以 `__dirname` 組成，不接受請求參數 |
| S-64 | 所有 owner 動作（安裝、更新、重啟、啟用 HTTPS）在 3300 上仍需 `isAdmin()`；`/api/queue/reset`（L11117）補上 `isAdmin()` |

## 9. Git Update

| 編號 | 規則 |
|---|---|
| S-70 | 內建 `POST /api/update`：在 Fork 上會因 `isOfficialOrigin()` 失敗而拒絕——**保持**，UI 改顯示「此安裝由腳本更新」 |
| S-71 | `scripts/zh/sync-upstream.ps1` 流程：<br>1. `git status --porcelain` 有未提交變更 → 停<br>2. `Compress-Archive data\ → backups\data-<時間>.zip`（排除 `images/ videos/` 可選）<br>3. `git fetch upstream --tags`<br>4. `git merge --no-ff upstream/main`；衝突 → `git merge --abort`、列出檔案、停<br>5. `node --check server.js`、`node --test`；失敗 → `git reset --hard ORIG_HEAD`、停<br>6. `git push origin` 目前分支<br>7. 重啟（`start.bat`），呼叫 `/api/setup/status` 驗證 200 |
| S-72 | `upstream` URL 固定 `https://github.com/BlackMixture/Mix-Studio.git`（HTTPS，不用 SSH agent）；腳本檢查 `git remote get-url upstream` 相符才繼續 |
| S-73 | 不自動 `git pull` custom nodes；`NODE_PACKS` 釘死 commit（既有），更新 commit 需經 Codex 審查後改 `lib/dependency-installer.js` |
| S-74 | MCWW 更新：`scripts/zh/setup-mcww.ps1 -Ref <新 commit>`，同樣先備份 `storage/` |

## 10. Model Download

| 編號 | 規則 |
|---|---|
| S-80 | 只允許 `https://huggingface.co/...`（既有 `parseHuggingFaceResolveUrl`）與 GitHub release 資產（ComfyUI portable，`installer/install-comfy.ps1`）；新增來源需列入白名單常數 |
| S-81 | **完整性驗證**：每個模型檔在 `MODEL_ASSETS` 加 `sha256` 欄位；未提供時下載前先抓 LFS 指標 `https://huggingface.co/<repo>/raw/<rev>/<path>`（內容含 `oid sha256:<hash>` 與 `size`），下載後比對；不符 → 刪除並報錯（不重試超過 2 次） |
| S-82 | 續傳：`Range` 續傳到 `.part`，完成後改名；`.part` 超過 7 天清理 |
| S-83 | 磁碟空間：下載前檢查目標磁碟剩餘 ≥ 檔案大小 × 1.1，否則拒絕 |
| S-84 | 既有模型：`installer/model-discovery.js` 掃描結果中已存在同檔名且大小相符者**跳過下載**；**永不刪除**非 Mix Studio 下載的檔案（`lib/model-cleanup.js` 只清理 `managedModelCleanupCandidates`，維持） |
| S-85 | 掃描 `extra_model_paths.yaml`（既有 `parseExtraModelPaths`）；路徑展開後必須是絕對路徑且存在 |

## 11. Telemetry

| 編號 | 規則 | 位置 |
|---|---|---|
| S-90 | PostHog 改 **opt-in**：`data/zh-tw.json` `analytics.enabled` 預設 `false`；`/api/analytics-config`（L6990）在 false 時回 `{enabled:false, key:'', host:''}`；`public/analytics.js` 在 `enabled:false` 時不載入 SDK、不顯示首次 toast | `lib/runtime-config.js` L92–L110 |
| S-91 | 3300 CSP `connect-src 'self'`、`script-src 'self'` 雙重封鎖 posthog | §5 |
| S-92 | Session replay：SDK 設定已 `disable_session_recording: true`；opt-in 時仍維持 | `public/analytics.js` L48–L51 |
| S-93 | 雲端 LLM：`externalLlmProvider` 預設 `local`（既有）；切到 `openai`/`gemini` 需 owner 在設定頁勾選「我了解提示詞與圖片會傳給第三方」並寫入 `data/zh-tw.json` `privacy.cloudLlmAcknowledged=true`；未勾選時 `/api/settings` POST 拒絕該值 | `lib/external-llm.js` L13–L17、`server.js` L7936 |
| S-94 | Gradio：`GRADIO_ANALYTICS_ENABLED=0`（MCWW 已內建 + `.env` 雙保險） | 13 號 §1.2 |
| S-95 | ComfyUI Desktop：安裝時的「傳送使用統計」選項必須關閉；portable 版無此項 | 安裝腳本檢查 `<Desktop 設定>\config.json` 的 `sendStatistics`（若存在）為 false |
| S-96 | Mix Studio 允許的對外連線白名單：`huggingface.co`、`cdn-lfs*.huggingface.co`、`github.com`、`api.github.com`、`objects.githubusercontent.com`、`release-assets.githubusercontent.com`、`pypi.org`/`files.pythonhosted.org`（安裝時）、Tailscale 控制面（`*.tailscale.com`、`controlplane.tailscale.com`、`login.tailscale.com`）。驗收時以 Windows 防火牆出站日誌或 Wireshark 24 小時抽樣確認沒有其他目的地 | |

## 12. Windows Firewall（`scripts/zh/firewall.ps1`，以系統管理員執行）

```powershell
$rules = @(
  @{ Name = "MixStudio 3300 (Private)"; Port = 3300 },
  @{ Name = "MixStudio 3301 MCWW proxy (Private)"; Port = 3301 }
)
foreach ($r in $rules) {
  Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Protocol TCP -LocalPort $r.Port `
    -Profile Private -Action Allow -Program "$env:ProgramFiles\nodejs\node.exe" | Out-Null
}
# 明確封鎖（即使程式綁錯位址也擋住）
foreach ($p in 8188, 7860) {
  $n = "Block ComfyUI/MCWW $p inbound"
  Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $n -Direction Inbound -Protocol TCP -LocalPort $p -Profile Any -Action Block | Out-Null
}
# 目前網路必須是 Private，否則 3300/3301 規則不生效（這是預期行為）
Get-NetConnectionProfile | Select-Object Name, NetworkCategory
```
- Tailscale 流量到 3300/3301 是從 `tailscaled` 以 loopback 轉發，不受入站規則影響。
- **禁止**：關閉防火牆、對 Public profile 放行、放行 8188/7860、路由器 port forward。
- `node.exe` 路徑依實際安裝調整（腳本以 `(Get-Command node).Source` 取得）。

## 13. Tailscale

| 編號 | 規則 |
|---|---|
| S-100 | 只用 `tailscale serve`；`tailscale funnel` 任何形式禁止。`scripts/zh/verify-ports.ps1` 執行 `tailscale serve status --json`，若任何 `AllowFunnel` 為 `true` → 失敗並印出 `tailscale funnel reset` 建議 |
| S-101 | `POST /api/spark-access/enable`（L7406）改為永久 `403 {code:'disabled_by_policy'}`；`/mcp/*` 分派（L12030）改為 404；設定頁隱藏 Spark 區塊；`lib/spark-access.js` 不刪（減少合併衝突） |
| S-102 | Serve 設定：443→3300、8443→3301；不使用 `--set-path` 子路徑 |
| S-103 | Tailscale ACL（admin console）建議：只允許使用者自己的裝置存取該主機的 tcp:443、tcp:8443（`"src":["autogroup:member"]` 縮到本人）；不共享節點 |
| S-104 | 手機端 Tailscale App 開啟「MagicDNS」與「HTTPS」；Key expiry 到期會斷線，這是正常行為，不要關閉 key expiry |
| S-105 | 3300 收到 `Tailscale-User-Login` 等標頭時只記錄到日誌（去識別：只記 hash），不用於授權 |

## 14. 日誌脫敏

| 編號 | 規則 |
|---|---|
| S-110 | `console.error('[error]', req.method, loggedPath, e.message)`（L12098）：`loggedPath` 改為去 query（`url.pathname`），且 `/api/input`、`/images/`、`/videos/`、`/faces/` 的檔名以 `[media]` 取代 |
| S-111 | 絕不記錄：PIN、cookie、token、提示詞全文（`[prompt-revise]` L3753 的 `summary` 只保留長度與 stage）、上傳原始檔名（保留清理後的隨機名） |
| S-112 | 3301 代理日誌：`method pathname status ms clientHash`；`clientHash = sha256(clientAddress + AUTH_SECRET).slice(0,8)` |
| S-113 | 日誌檔（若 `start.bat` 導向檔案）放 `data/logs/`，7 天輪替，最大 50 MB |
| S-114 | 錯誤回應給前端的 `error` 字串不含檔案系統絕對路徑（既有多處含 `data/…` 路徑，Codex 在 `json()` 包一層：非 loopback 請求時以正規表達式去除磁碟路徑 `[A-Za-z]:\\[^\s"']+` 與 `/home/…`） |

## 15. 驗收清單（對應 18 號文件測試 16～18，Codex 完工自檢）

- [ ] `netstat -ano | findstr /R ":8188 :7860"` 只出現 `127.0.0.1`
- [ ] 另一台裝置 `curl http://<LAN>:8188/` 與 `:7860/` 連線被拒（防火牆 Block 規則生效）
- [ ] `tailscale serve status --json` 含 3300 與 3301，無 Funnel
- [ ] `curl -X POST http://<LAN>:3300/api/spark-access/enable`（owner cookie）→ 403
- [ ] 手機未登入開 `/api/gallery` → 401；開 `:3301/` → 導到登入
- [ ] Owner 無 PIN 時手機任何 API → 403 `owner_pin_required`
- [ ] 錯誤 PIN 6 次 → 429
- [ ] 改 PIN 後舊手機 cookie → 401
- [ ] `curl -H "X-Forwarded-For: 1.1.1.1" http://127.0.0.1:3300/api/me` → 401（不再視為本機）
- [ ] `GET /api/analytics-config` → `enabled:false`；24 小時封包抽樣無 posthog.com
- [ ] `GET /` 回應含 CSP、X-Frame-Options、Referrer-Policy；`/studio` 全功能無 CSP 違規
- [ ] 上傳 `.exe` 改名 `.png` → 415；`.mixpack` 含 `../` → 400
- [ ] 跨 Origin POST `/api/generate` → 403
- [ ] `data/settings.json` `comfyUrl` 改成 `http://10.0.0.5:8188` → 啟動拒絕
- [ ] 日誌中 grep `pin`、`ks_profile`、提示詞樣本字串 → 無命中
