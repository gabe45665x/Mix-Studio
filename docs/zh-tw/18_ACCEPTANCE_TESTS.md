# 18_ACCEPTANCE_TESTS.md — 驗收測試（唯一驗收依據）

> 執行者：Codex（WP-12）；證據放 `docs/zh-tw/reports/evidence/<TestID>/`。
> 固定格式：Test ID｜名稱｜Blocker｜前置條件｜操作步驟｜預期結果｜Fail 條件｜證據。
> 主機 = Windows 11 + RTX 5090；手機 = Android Chrome。`<LAN>` = 主機區網 IP；`<TS>` = `<host>.<tailnet>.ts.net`。所有 curl 從「另一台裝置」執行時以手機 Termux 或第二台電腦為準。
> 「原企劃書 20 項」對照：1→A-01/B-01、2→B-02、3→B-03、4→D-01、5→E-01、6→F-01、7→G-01、8→J-03、9→K-01、10→K-02、11→H-01、12→H-03、13→H-04、14→I-04、15→A-06、16→M-01、17→B-09、18→C-01、19→N-06、20→O-04。

## CONFLICTS_FOUND
| # | 衝突 | 保守處理 |
|---|---|---|
| 1 | 任務書 B 組與 J 組要求「WebSocket」測試；MCWW 2.4.4 + Gradio 5.49.1 實際不使用 WebSocket（13 號 §4） | B-05 測 Mix Studio 的 SSE 進度與代理 upgrade 直通（以測試用 echo WS 伺服器）；J-06 標 N/A-by-design 並附 `/gradio_api/queue/data` SSE 證據 |
| 2 | H 組「重新排序」、I 組「垃圾桶」依賴既有功能 | 兩者既有（`/api/queue/reorder`、`/api/trash`），列為正式案例 |
| 3 | P 組效能 | 只記實測值，不設門檻 |

---

## A. 啟動

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| A-01 | Windows 本機啟動 | Yes | WP-11 腳本；ComfyUI 已停止 | 執行 `scripts\zh\start.ps1` | 60 秒內 `http://localhost:3300/` 顯示殼層登入頁；console 印出 Local/Phone URL、`Profile PIN: enabled` | 逾時或 PIN 顯示 `not set` | Console log、`status.ps1` 輸出 |
| A-02 | 重複啟動不重複開程序 | Yes | A-01 已啟動 | 再執行 `start.ps1` 兩次；`Get-Process node` | 仍只有一個監聽 3300 的 node（`netstat -ano \| findstr :3300` 一個 PID） | 出現第二個 node 或 EADDRINUSE 崩潰 | netstat 輸出 |
| A-03 | ComfyUI 未啟動時可安全啟動 | Yes | 8188 無程序 | `start.ps1` → 開殼層首頁 | 首頁狀態列「ComfyUI 未連線」+ owner 可按「啟動」；殼層不崩潰；按啟動後 ≤ 120 秒變綠 | 殼層白畫面、500、或啟動按鈕無效 | 截圖、`/api/setup/status` |
| A-04 | Mix Studio 自身健康 | Yes | A-01 | `curl http://127.0.0.1:3300/api/setup/status` | 200 JSON；`node --test` 全綠 | 非 200 或測試失敗 | Command output |
| A-05 | MCWW 隨 ComfyUI 啟動 | Yes | WP-06 | 啟動 ComfyUI → 等 30 秒 → `curl http://127.0.0.1:8188/mcww/available_at`、`curl -I http://127.0.0.1:7860/config` | 前者 `{"port":7860,...}`、後者 200 | 7860 無回應或 port ≠ 7860 | Command output、ComfyUI console |
| A-06 | 重開機恢復 | Yes | WP-11 排程任務已註冊 | 送出一個生成任務 → 立即 `shutdown /r /t 0` → 重開後計時 | ≤ 3 分鐘：3300、3301、8188、7860 全部就緒；殼層任務頁把中斷任務標「失敗（主機重啟）」並可重試 | 任一服務未起；任務狀態卡在「生成中」 | `status.ps1` 時間戳、截圖 |

## B. 網路

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| B-01 | Desktop localhost | Yes | A-01 | 主機瀏覽器開 `http://localhost:3300/`、`http://127.0.0.1:3301/` | 3300 殼層；3301 未登入 → 導到 3300 登入，登入後 MCWW | 任一失敗 | 截圖 |
| B-02 | 手機同 Wi-Fi | Yes | WP-09 防火牆；手機同網段 | 手機開 `http://<LAN>:3300/`、`http://<LAN>:3301/` | 同 B-01 | 連線逾時 | 截圖、`Get-NetFirewallRule` 輸出 |
| B-03 | 手機 4G/5G + Tailscale | Yes | WP-09；手機 Wi-Fi 關閉、Tailscale 開 | 開 `https://<TS>/` 與 `https://<TS>:8443/` | 憑證有效（無警告）；殼層可登入生成；8443 進 MCWW | 憑證警告、逾時、被導到 :8188 | 截圖（含網址列鎖頭）、`tailscale serve status --json` |
| B-04 | Tailscale HTTPS 為 Secure Context | Yes | B-03 | 手機 Chrome DevTools（USB）執行 `window.isSecureContext` | `true`；PWA 可安裝（「加入主畫面」出現「安裝應用程式」） | false | 截圖 |
| B-05 | 即時進度（SSE）與 WebSocket 直通 | No | B-02 | (a) 手機生成時觀察任務頁；(b) `test/zh-mcww-proxy.test.js` 的 upgrade echo 案例 | (a) 進度 ≤ 2 秒更新；(b) 測試通過 | 進度停滯 > 10 秒；測試失敗 | 影片、測試輸出 |
| B-06 | Windows Firewall Private Profile | Yes | WP-09 | `Get-NetConnectionProfile`；`Get-NetFirewallRule -DisplayName "MixStudio*" \| Get-NetFirewallPortFilter`；`Get-NetFirewallRule -DisplayName "MixStudio*" \| select Profile` | 網路為 Private；規則只含 3300/3301、Profile=Private、Program=node.exe | 規則 Profile 含 Public/Any | Command output |
| B-07 | Public Profile 不開 | Yes | B-06 | 將網路暫改為 Public（`Set-NetConnectionProfile -NetworkCategory Public`）→ 手機開 `http://<LAN>:3300/` → 改回 Private | Public 時連線失敗；改回後恢復 | Public 時可連 | 兩次 curl 輸出 |
| B-08 | 不使用 Funnel | Yes | WP-09 | `tailscale serve status --json`；`tailscale funnel status` | JSON 無 `AllowFunnel: true`；funnel status 顯示未設定；`POST /api/spark-access/enable`（owner cookie）→ 403 | 任何 Funnel 路由存在或 API 非 403 | Command output |
| B-09 | 8188 / 7860 外部不可直接存取 | Yes | WP-06、WP-09 | 主機 `netstat -ano \| findstr /R ":8188 :7860"`；手機 `curl -m 5 http://<LAN>:8188/` 與 `:7860/`；Tailscale `curl -m 5 http://<host-ts-ip>:8188/` | netstat 只見 `127.0.0.1`；三個 curl 全部失敗（拒絕或逾時） | 任一可連 | netstat + curl 輸出 |
| B-10 | 手機端不出現內部 port | Yes | WP-04/07 | 手機開殼層各頁與 MCWW 頁；DevTools 搜尋頁面 HTML/Network 中 `:8188`、`:7860` | 殼層零命中；MCWW 頁面除頁尾「Open ComfyUI」（13 號 §7 已知）外零命中 | 殼層任何命中 | DevTools 搜尋截圖 |

## C. 登入 / Session

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| C-01 | 未登入不能生成 | Yes | 無 cookie | 手機 `curl -X POST http://<LAN>:3300/api/generate -H 'Content-Type: application/json' -d '{"mode":"t2i","prompt":"x"}'` | 401 `{code:'auth'}`（或 403 `csrf`/`owner_pin_required`，皆非 200） | 200 或任務被建立 | curl 輸出、`/api/queue` 無新任務 |
| C-02 | 未登入不能 Queue | Yes | 無 cookie | `curl http://<LAN>:3300/api/queue`；`POST /api/queue/cancel` | 401 | 200 | curl 輸出 |
| C-03 | 未登入不能 MCWW | Yes | 無 cookie | 手機開 `http://<LAN>:3301/`；`curl http://<LAN>:3301/config`；`curl -H "Cookie: ks_profile=abc.def" http://<LAN>:3301/config` | 導向登入／401；401；401 | 任一 200 | curl 輸出、截圖 |
| C-04 | Session 過期 | Yes | 15 號 S-10 | 以 owner 登入取得 cookie；把 `data/zh-tw.json` `session.maxAgeDays` 暫設 0.0001（約 9 秒）→ 重啟 → 等 15 秒 → `GET /api/me` | 401 `auth`；殼層跳登入頁 | 200 | curl 輸出、截圖 |
| C-05 | 登出 | Yes | 已登入 | 殼層登出 → `GET /api/me` | 401；cookie 已清 | 仍 200 | DevTools Application › Cookies |
| C-06 | 登出所有裝置 / 改 PIN 使舊 session 失效 | Yes | 兩台裝置登入同 profile | 裝置 A 改 PIN（或「登出所有裝置」）→ 裝置 B `GET /api/me` | B 得 401 | B 仍 200 | 兩台截圖 |
| C-07 | 登入錯誤限制 | Yes | owner 有 PIN | 連續 6 次錯誤 PIN | 第 6 次 429 + `Retry-After`；殼層顯示「嘗試太多次」；10 分鐘後恢復 | 第 6 次仍 401 或無 Retry-After | curl 輸出（含 header） |
| C-08 | Cookie 安全屬性 | Yes | B-02、B-03 | 區網登入與 Tailscale 登入各抓 `Set-Cookie` | 兩者含 `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`；Tailscale（https）另含 `Secure`；值以 `v2.` 開頭 | 缺任一屬性 | curl -i 輸出 |
| C-09 | Owner 無 PIN 時遠端封鎖 | Yes | 備份 db 後移除 owner `pinHash` | 手機開殼層任何頁 | 顯示「請先在電腦上為擁有者設定 PIN」；`GET /api/gallery` → 403 `owner_pin_required` | 可進入 | 截圖；測後還原 db |
| C-10 | 轉發標頭不再視為本機 | Yes | 主機本機 | `curl -H "X-Forwarded-For: 1.1.1.1" http://127.0.0.1:3300/api/me`（無 cookie） | 401 | 200（開放 profile 被套用） | curl 輸出 |
| C-11 | 跨站 POST 被拒（CSRF） | Yes | 已登入 | `curl -b <cookie> -X POST -H "Origin: https://evil.example" http://<LAN>:3300/api/generate -d '{}'` | 403 `csrf` | 非 403 | curl 輸出 |
| C-12 | PIN 強度 | No | 建立 profile 頁 | 嘗試 `1234`、`000000`、`123456`、與名稱相同 | 全部拒絕並顯示原因；`482913` 接受 | 弱 PIN 被接受 | 截圖 |

## D. 文生圖

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| D-01 | 基本文生圖 | Yes | `image` 元件已裝；已登入（手機區網） | 首頁 › 文生圖 › 提示詞「a red apple on a wooden table」› 生成 | 任務頁出現任務、進度到 100%、素材庫出現 1 張圖；payload `mode:'t2i'` | 失敗或圖片不在素材庫 | 截圖、`/api/queue` log、素材庫項目 JSON |
| D-02 | 比例 | Yes | D-01 | 依序選 9:16、16:9、1:1 各生成一張 | 三張實際尺寸（`pngDims`）與 14 號 §5.1 表一致（或與 `computeDims()` 一致並在報告註明） | 尺寸不符或超出 64–4096 | 三張圖尺寸清單 |
| D-03 | 品質三段 | Yes | `krea2raw`、`upscale` 元件（缺則該段標 N/A） | 快速／標準／品質各一張，固定 seed | 快速 payload `krea2Turbo:true,steps:8`；標準 `krea2Turbo:false,steps:12`；品質另含 `postUpscale.enabled:true` 且輸出長邊 ≥ 2048 | payload 不符 | payload 快照、輸出尺寸 |
| D-04 | 數量 | Yes | D-01 | 數量 3 → 生成 | 素材庫 3 張同組（group 顯示「3 張」） | 數量不符 | 截圖 |
| D-05 | Seed | Yes | D-01 | 鎖定 seed=12345 生成兩次 | 兩張圖 SHA256 相同（或視覺相同；記錄 seed 欄位皆 12345） | seed 未帶入 | 兩張 hash、metadata |
| D-06 | 負面提示詞與風格預設 | No | 有 Mix Pack 安裝時 | 填負面提示詞；選一個風格預設 | payload 含 `negativePrompt` 與 `promptPresets` | 缺欄位 | payload 快照 |
| D-07 | History / Library 完整性 | Yes | D-01 | 素材庫開該圖 | 顯示提示詞、模型（引擎名，非檔名）、Seed、尺寸、時間 | 缺提示詞或 Seed；顯示 `.safetensors` 檔名 | 截圖 |

## E. 圖生圖

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| E-01 | 上傳 + 生成 | Yes | 手機相簿有 1 張 jpg | 圖生圖 › 上傳 › 提示詞「make it watercolor」› 生成 | 上傳回 `name` 以 `ks_` 開頭；payload `mode:'t2i', imageName, denoise:0.45`；輸出進素材庫 | 失敗 | payload、素材庫截圖 |
| E-02 | 預覽 | Yes | E-01 | 上傳後觀察 | 縮圖即時顯示、顯示尺寸；「更換」「移除」可用 | 無預覽 | 截圖 |
| E-03 | 修改強度 | Yes | E-01 同圖同 seed | 強度 0.2 與 0.9 各一張 | 0.2 明顯接近原圖、0.9 明顯改變；payload `denoise` 對應 | denoise 未變 | 兩張圖 + payload |
| E-04 | 指令編輯（進階） | No | `klein4` 或 `qwen` 元件 | 進階 › 編輯模式 Klein 4B › 提示詞「add sunglasses」 | payload `mode:'edit', editEngine:'klein4', refNames:[name]`；「修改強度」欄位隱藏 | 欄位仍顯示或 payload 錯 | payload、截圖 |
| E-05 | 原圖不覆蓋 | Yes | E-01 | 生成後檢查 `ComfyUI/input/` 與 `data/inputs/` 中的上傳檔 hash | 上傳檔 hash 不變；輸出為新檔 | 原檔被改寫 | hash 前後比對 |

## F. 文生影

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| F-01 | 基本文生影 | Yes | `ltx25`（或 `video`/`h3`）元件 | 文生影 › 提示詞「ocean waves at sunset, slow camera pan」› 5 秒 › 16:9 › 快速 › 生成 | payload 無 `imageName`、`engine ∈ {ltx25,ltx,h3}`、`seconds:5`；影片進素材庫可播放 | 引擎為 wan/eros/scail 或 400 | payload、影片檔 |
| F-02 | 秒數範圍 | Yes | F-01 | 拉到最小與最大 | LTX 2.5：1 與 20；H3：5 與 15（滑桿隨引擎變）；payload `seconds` 與 UI 一致 | 超出引擎範圍或 400 | 截圖、payload |
| F-03 | 比例 | Yes | F-01 | 9:16 與 16:9 | 輸出寬高方向正確（`ffprobe`） | 方向錯 | ffprobe 輸出 |
| F-04 | 品質 | Yes | `ltx25quality` 元件（缺則標 N/A） | 快速 vs 標準同 seed | 快速 `fast:true`；標準 `fast:false`；「品質」段標示含後製放大 | payload 不符 | payload |
| F-05 | 動態強度 | No | F-01 | 輕微 vs 強烈 | payload `promptTemplate` 含對應片語；UI 有「影響提示詞」註記 | 無 promptTemplate | payload |
| F-06 | 音訊標示 | No | F-01 | 觀察表單 | LTX/H3 顯示「此模型會產生音訊」；輸出 mp4 含音軌（`ffprobe` 有 audio stream） | 顯示為可切換開關卻無效 | 截圖、ffprobe |
| F-07 | 下載 | Yes | F-01 | 素材庫 › 影片 › 下載 | 手機下載資料夾出現 mp4，可播放 | 下載失敗或檔案損毀 | 截圖 |

## G. 圖生影

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| G-01 | 首幀 + 生成 | Yes | `ltx25` 或 `video` 或 `h3` | 圖生影 › 上傳首幀 › 動作提示詞「the cat turns its head」› 5 秒 › 生成 | payload 含 `imageName`；輸出影片第一幀與首幀相似 | 400 或影片與首幀無關 | payload、首幀 vs 影片第 1 幀截圖 |
| G-02 | 從素材庫「再次使用」帶入首幀 | No | D-01 圖 | 素材庫 › 圖 › 再次使用 › 圖生影 | payload 含 `id`（素材庫項目）或 `imageName`；表單自動填 | 需重新上傳 | payload |
| G-03 | 秒數 / 比例 / 品質 | Yes | G-01 | 同 F-02～F-04 | 同 | 同 | 同 |
| G-04 | Wan 2.2 圖生影（若安裝） | No | `wan` 元件 | 進階 › 模型 Wan 2.2 | payload `engine:'wan'`；文生影模式下 Wan 不可選 | t2v 可選 wan | 截圖 |
| G-05 | 首幀不被破壞 | Yes | G-01 | 生成後比對上傳檔 hash | 不變 | 改變 | hash |
| G-06 | 尾幀（進階） | No | G-01 | 進階 › 尾幀上傳 | payload `endImageName`；影片末幀近似尾幀 | 未帶入 | payload、截圖 |

## H. Queue

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| H-01 | 進度與階段名稱 | Yes | D-01 | 生成中觀察任務頁 | 百分比遞增；階段名稱為繁中（例「載入模型…」）；英文原字串只在「詳細資訊」 | 顯示 `KSampler`、Node ID 於主畫面 | 影片、截圖 |
| H-02 | ETA | No | H-01 | 第二次相同任務 | ETA 顯示且誤差 ≤ 50% | 無 ETA | 截圖與實際時間 |
| H-03 | 取消 | Yes | 生成中 | 按取消 | ≤ 5 秒內狀態變「已取消」；ComfyUI `/queue` 該 id 消失；GPU 釋放（下一任務可跑） | 任務殘留 | `/api/queue`、ComfyUI queue |
| H-04 | 重試 | Yes | 一個失敗任務（可用故意拔掉模型檔或取消製造） | 按重試 | 以相同參數建立新任務（payload 相同、seed 相同） | 參數遺失 | 兩次 payload 比對 |
| H-05 | 多任務 | Yes | D-01 | 連續送 3 個任務 | 依序執行；任務頁三個卡片狀態正確 | 卡住或順序錯 | 截圖時間序 |
| H-06 | 重新排序 | No | 3 個排隊任務 | 把第 3 個移到第 1 | `/api/queue/reorder` 200；執行順序改變 | 順序不變 | `/api/queue` 前後 |
| H-07 | 失敗任務不卡佇列 | Yes | 製造一個必失敗任務（例：進階解析度 4096×4096 造成 OOM，或暫時移除模型） | 送失敗任務 + 正常任務 | 失敗任務標「失敗」+ 錯誤摘要；正常任務照常完成 | 佇列停滯 | 截圖、log |
| H-08 | 其他來源任務提示 | No | MCWW 執行中 | 殼層送任務 | 橫幅「ComfyUI 正在執行自訂工作流」 | 無提示 | 截圖 |

## I. Library

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| I-01 | 圖片檢視 | Yes | D-01 | 開圖、左右滑、捏合 | 正常 | 卡頓 > 1 秒或無法縮放 | 影片 |
| I-02 | 影片檢視 | Yes | F-01 | 開影片 | 內嵌播放、可全螢幕、有聲（若有音軌） | 無法播放 | 截圖 |
| I-03 | 搜尋 | No | ≥ 5 項 | 搜尋提示詞片段 | 只列相符項 | 無結果或全列 | 截圖 |
| I-04 | 下載 | Yes | I-01 | 單張下載；多選 3 張下載 | 單張為原檔；多選為 zip（`/api/items/download`） | 失敗 | 檔案 |
| I-05 | 再次使用 | Yes | I-01 | 再次使用 | 首頁對應模式帶入提示詞、比例、seed、LoRA | 參數缺 | 截圖 |
| I-06 | Metadata / Prompt / Model / Seed | Yes | I-01 | 開資訊卡 | 四項皆顯示；提示詞可複製 | 缺項 | 截圖 |
| I-07 | 收藏 | No | I-01 | 收藏 → 篩選「收藏」 | 只顯示已收藏 | 篩選無效 | 截圖 |
| I-08 | 垃圾桶 | Yes | I-01 | 刪除 → 垃圾桶還原 → 再刪除 → 永久刪除 | 還原後回到素材庫且檔案存在；永久刪除後 `data/trash/` 無此檔（既有行為若為保留檔案則記錄） | 刪除即永久消失 | `data/trash/` 列表 |

## J. MCWW

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| J-01 | 路由（區網） | Yes | WP-07；已登入 owner | 殼層 › 自訂工作流 › 開啟 | 新分頁 `http://<LAN>:3301/`，MCWW 首頁載入，標題「自訂工作流」 | 404/502 或網址含 7860 | 截圖 |
| J-02 | 路由（Tailscale） | Yes | B-03 | 同上經 4G | `https://<TS>:8443/`；`curl https://<TS>:8443/config` 回應中 `"root"` 以 `https://<TS>:8443` 開頭 | root 指向 127.0.0.1 或無 port | curl 輸出 |
| J-03 | 自訂工作流執行 | Yes | WP-10 放入的範例工作流 | 選工作流 › 填提示詞 › Queue | 進度條動、完成後輸出可預覽 | 卡在 0% 或錯誤 | 截圖、ComfyUI log |
| J-04 | 圖片輸入 | Yes | 含 Load Image 的工作流 | 上傳圖片 › 執行 | `POST /gradio_api/upload` 經 3301 成功；輸出正確 | 上傳 413/403 | Network log |
| J-05 | 影片輸出 | Yes | 影片工作流（LTX 2.5 T2V 範例） | 執行 | 輸出影片可在 MCWW 播放與下載（`/gradio_api/file=` 經 3301） | 檔案 404 | 截圖 |
| J-06 | WebSocket | No | — | 檢視 Network | MCWW 無 WS 連線（設計如此）；SSE `/mcww_api/progress_sse`、`/gradio_api/queue/data` 存在且持續 | SSE 被緩衝（事件延遲 > 5 秒） | Network log（標 N/A-by-design） |
| J-07 | MCWW Queue | No | J-03 | 連送 2 個 | MCWW 佇列頁顯示兩項並依序執行 | 第二項消失 | 截圖 |
| J-08 | 返回 Mix Studio | Yes | J-01 | 關閉分頁／殼層「返回首頁」 | 回到殼層且仍登入 | 需重新登入 | 截圖 |
| J-09 | 未登入不可用 | Yes | 無 cookie | 同 C-03 | 401/導向 | 200 | curl |
| J-10 | 非 owner 拒絕 | No | 第二個 profile 登入 | 開 3301 | 403 + 說明 | 可進 | 截圖 |
| J-11 | 拒絕清單 | Yes | owner cookie | `curl -b <c> http://<LAN>:3301/proxy=http://example.com`、`/vibe-code`、`/gradio_api/mcp`、`/login` | 全部 404 | 任一非 404 | curl |

## K. Upload Security

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| K-01 | 正常圖片 | Yes | 已登入 | 上傳 png、jpg、webp 各一 | 200，`name` 以 `ks_` 開頭 | 415 | curl |
| K-02 | 正常影片 | Yes | 已登入 | 上傳 mp4（含音軌） | 200，`hasAudio:true` | 失敗 | curl |
| K-03 | 偽造副檔名 | Yes | 已登入 | `calc.exe` 改名 `a.png` 上傳 | 415 `unsupported_type`；`ComfyUI/input/` 無新檔 | 200 | curl、目錄列表 |
| K-04 | MIME 不符 | Yes | 已登入 | 真 jpg 以 `Content-Type: video/mp4` 與 `x-filename: a.mp4` 上傳 | 415（副檔名與 magic 類別不一致） | 200 | curl |
| K-05 | 超大檔案 | Yes | 已登入 | `Content-Length: 3000000000` 的上傳；以及 chunked 串流 > 2 GiB（可用 `/dev/zero` 管線） | 413；tmp 檔被清 | 磁碟被寫滿 | curl、`data/inputs/` |
| K-06 | Path traversal | Yes | 已登入 | `x-filename: ../../evil.png`；`GET /api/input?name=../../data/db.json` | 檔名被清理為 `_.._.._evil.png`（或等價）且落在 `data/inputs/`；`/api/input` 回 404 | 檔案落到目錄外或讀到 db.json | 目錄列表、curl |
| K-07 | 危險檔名 | No | 已登入 | `x-filename` 含 `\0`、`:`、`\|`、超長 500 字 | 清理後 ≤ 240 字、無特殊字元 | 500 或崩潰 | curl |
| K-08 | ZIP（.mixpack） | Yes | owner | 建含 `../x.txt` entry 的 zip → `/api/addons/install` | 400；`data/` 外無檔案 | 檔案落到外面 | 目錄列表 |
| K-09 | 暫存清理 | No | — | 中途中斷上傳 3 次；重啟 | `data/inputs/*.tmp` 為 0（重啟後 > 24h 的清掉） | tmp 堆積 | 目錄列表 |

## L. Proxy Security

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| L-01 | 無 Open Proxy | Yes | owner cookie | `curl -b <c> -H "Host: example.com" http://<LAN>:3301/`；`curl -b <c> "http://<LAN>:3301/http://example.com"` | 回應仍來自 MCWW（或 404），不是 example.com 內容 | 取得外部內容 | curl |
| L-02 | 無任意目標 | Yes | 程式碼審查 | `grep -n "127.0.0.1" lib/zh/mcww-proxy.js` | 目標 host 為常數，port 來自設定檔且驗證為整數 | 目標可由請求控制 | grep 輸出 |
| L-03 | SSRF | Yes | owner cookie | `curl -b <c> "http://<LAN>:3301/proxy=http://127.0.0.1:8188/system_stats"`；`GET /api/input?name=http://evil` | 404；404 | 取得 8188 內容 | curl |
| L-04 | ComfyUI 未授權 API 不外露 | Yes | 無 cookie | 手機 `curl http://<LAN>:3300/prompt`、`/history`、`/object_info`、`/system_stats`、`/queue` | 全部 404（Mix Studio 無此路由）；3301 未登入 401 | 取得 ComfyUI 回應 | curl |
| L-05 | 未登入 Proxy 拒絕 | Yes | — | 同 C-03 | 401/導向 | 200 | curl |
| L-06 | comfyUrl 遠端值拒絕啟動 | Yes | 備份 settings | 把 `data/settings.json` `comfyUrl` 改 `http://10.0.0.5:8188` → 啟動 | 啟動拒絕並印出原因；還原後正常 | 照常啟動 | console log |
| L-07 | 3301 速率限制 | No | owner cookie | 1 秒內 200 個 `GET /config` | 部分 429 | 全部 200 且服務變慢 | 統計 |

## M. 隱私

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| M-01 | Analytics 預設關閉 | Yes | 新安裝（清 localStorage） | `GET /api/analytics-config`；開首頁；Network 過濾 `posthog` | `enabled:false`；無 `array.js` 載入；無首次 toast | 任何 posthog 請求 | curl、Network log |
| M-02 | Prompt 不送第三方 | Yes | 生成 3 次（含本機增強） | 主機 Wireshark／防火牆出站日誌 24 小時 | 除白名單網域（15 號 S-96）外無出站連線；生成期間零出站 | 任何非白名單目的地 | pcap 摘要或日誌 |
| M-03 | 圖片不送第三方 | Yes | 同 M-02（圖生圖） | 同上 | 同上 | 同上 | 同上 |
| M-04 | 影片不送第三方 | Yes | 同 M-02（圖生影） | 同上 | 同上 | 同上 | 同上 |
| M-05 | 無雲端 moderation | Yes | 程式碼審查 | `grep -rniE "moderat|safety_checker|nsfw" lib public/simple server.js` | 無呼叫外部審核 API；提示詞無黑名單過濾（送出的 prompt 與輸入相同） | 有 | grep 輸出、payload 比對 |
| M-06 | 無 Session Replay | Yes | 若使用者主動開啟 analytics | 開啟後 Network | `disable_session_recording:true`；無 `/s/` recording 請求 | 出現錄製請求 | Network log |
| M-07 | 雲端 LLM 預設關且需告知 | Yes | 設定頁 | 檢查 `externalLlmProvider`；嘗試切 openai 未勾告知 | 預設 `local`；未勾選 → 400；勾選後才可 | 預設非 local | 截圖、curl |
| M-08 | Network Log 作證 | Yes | M-01～M-07 | 匯出 HAR（去敏）與出站日誌 | 附在 evidence | 缺 | 檔案 |

## N. 更新 / 回退

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| N-01 | 更新前備份 | Yes | WP-11 | `sync-upstream.ps1` | 執行第一步即產生 `backups\data-<時間>.zip`，可解壓 | 無備份 | 檔案 |
| N-02 | dirty tree 不硬更新 | Yes | 修改 `server.js` 一行未 commit | `sync-upstream.ps1` | 立即停止並列出 dirty 檔；`git status` 不變 | 繼續合併 | console |
| N-03 | 衝突停止 | Yes | 製造衝突（本地改 `server.js` 某行並 commit；用測試 upstream 分支改同行） | `sync-upstream.ps1 -Upstream <test-ref>` | 合併中止（`git merge --abort`），列出衝突檔，工作樹乾淨 | 留下衝突標記或自動覆蓋 | console、`git status` |
| N-04 | 使用者資料不覆蓋 | Yes | N-01 | 更新前後比對 `data/db.json`、`settings.json`、`zh-tw.json`、`auth_secret.txt` hash | 相同 | 改變 | hash |
| N-05 | 回退可用 | Yes | WP-14 `ROLLBACK.md` | 依 (a)+(d) 回退到 `baseline-bec3292` 再回到 `v1.0-zh-tw` | 兩個方向都能啟動並登入 | 任一方向失敗 | console、截圖 |
| N-06 | zh-TW 保留 | Yes | 完成一次真實或模擬的 upstream 合併 | 開殼層 | 語言仍繁中；`public/simple/`、`lib/zh/` 完整；`test/zh-*` 全綠 | 遺失 | `git diff --stat`、截圖 |
| N-07 | 內建更新按鈕行為 | No | Fork | 設定 › 更新 | 顯示「由腳本管理」，`POST /api/update` 回 `update_origin` 錯誤，不做任何 pull | 執行了 pull | curl |

## O. 模型

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 預期結果 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| O-01 | 掃描既有模型 | Yes | WP-00 清單 | 設定 › 模型；`reports/WP-10_existing_models.md` | 清單包含 `models/` 與 `extra_model_paths.yaml` 目錄中的檔案，數量與 WP-00 一致 | 漏掉 extra paths | 報告 |
| O-02 | 不重複下載 | Yes | 已有核心模型 | 觸發安裝核心元件 | 已存在且大小相符的檔案標「跳過」；無網路流量下載該檔 | 重新下載 | 安裝 log、流量 |
| O-03 | 大模型下載前顯示容量 | Yes | 缺少一個元件 | 設定 › 模型 › 安裝 | 先顯示「新增 N GB／磁碟剩餘 M GB」與確認鍵，未確認不下載 | 直接開始下載 | 截圖 |
| O-04 | 既有模型未被刪除 | Yes | WP-00 清單 | 全部 WP 完成後比對 `models/**` 清單（名稱+大小） | 完全包含 WP-00 清單 | 少任何一檔 | 比對輸出 |
| O-05 | Token 不進 Git | Yes | 設定 HF token | `git grep -n "hf_" ; git log -p \| findstr hf_`；`GET /api/settings` | 零命中；回應只有 `hfTokenConfigured:true` 無值 | 出現 token | 輸出 |
| O-06 | Hash 驗證 | Yes | O-03 下載 | 下載完成後 log | 每檔 sha256 與 LFS `oid` 一致；故意改一個 byte 後重驗 → 失敗並刪除 | 無驗證 | log |
| O-07 | 授權記錄 | Yes | WP-10 | 檢查 `docs/zh-tw/MODEL_LICENSES.md`、`licenses/models/` | 每個下載檔一列；兩個無 LICENSE 節點有風險標示 | 缺 | 檔案 |

## P. 效能（只記實測，不設門檻）

| Test ID | 名稱 | Blocker | 前置條件 | 操作步驟 | 記錄欄位 | Fail 條件 | 證據 |
|---|---|---|---|---|---|---|---|
| P-01 | Peak VRAM | No | `nvidia-smi dmon -s m` 背景記錄 | 四模式各跑一次（快速品質） | 每模式峰值 MiB | 不適用 | csv |
| P-02 | Peak RAM | No | 工作管理員／`Get-Counter` | 同上 | 峰值 GB（ComfyUI python + node） | 不適用 | csv |
| P-03 | 首次模型載入 | No | ComfyUI 剛啟動 | 文生圖第一次 | 從送出到 100% 的秒數；階段「載入模型」秒數 | 不適用 | log |
| P-04 | 第二次生成 | No | P-03 後 | 同參數再一次 | 秒數 | 不適用 | log |
| P-05 | 文生圖 | No | 1024×1024 快速／標準 | 各 3 次取中位數 | 秒數 | 不適用 | 表 |
| P-06 | 圖生圖 | No | 同上 | 同上 | 秒數 | 不適用 | 表 |
| P-07 | 文生影 | No | 5 秒 16:9 快速 | 3 次 | 秒數、輸出 fps/解析度 | 不適用 | 表 |
| P-08 | 圖生影 | No | 同上 | 3 次 | 秒數 | 不適用 | 表 |
| P-09 | 手機 UI 回應 | No | 區網 + 4G | Lighthouse Mobile（Performance/Accessibility）；首頁可互動時間；任務頁 SSE 首次事件延遲 | 分數與毫秒 | 不適用 | Lighthouse 報告 |

---

## 附錄：Blocker 總表（WP-12 必須全部 Pass 才能進 WP-14）

A-01～A-06；B-01～B-04、B-06～B-10；C-01～C-11；D-01～D-05、D-07；E-01～E-03、E-05；F-01～F-04、F-07；G-01、G-03、G-05；H-01、H-03～H-05、H-07；I-01、I-02、I-04～I-06、I-08；J-01～J-05、J-08、J-09、J-11；K-01～K-06、K-08；L-01～L-06；M-01～M-08；N-01～N-06；O-01～O-07。
