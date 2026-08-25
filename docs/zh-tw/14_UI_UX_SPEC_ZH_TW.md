# 14_UI_UX_SPEC_ZH_TW.md — 手機介面規格（唯一 UI/UX 執行規格）

> 適用對象：Codex。實作位置：`public/simple/`（簡易殼層）。原介面 `/studio` 不在本文件範圍。
> 每個欄位都對應到 `12_SOURCE_CODE_MAP.md` §A10 的**既有** API 參數；沒有對應參數的欄位在本文件明確標示為「提示詞層級」或「待 Codex 依實際環境確認」，不得憑空新增引擎參數。

## CONFLICTS_FOUND

| # | 衝突 | 來源 | 保守處理 |
|---|---|---|---|
| 1 | 企劃書要求「自訂工作流」以同網域 `/custom-workflows/` 全頁模式呈現 | 原企劃書 §八 vs `09_REVIEW_FINDINGS.md` D1、`13_MCWW_INTEGRATION_SPEC.md` §2/§7 | 依 13 號文件：新分頁開啟 `GET /custom-workflows/open`（302 到 3301 / 8443）。本文件不再描述子路徑版面 |
| 2 | 任務書要求文生影／圖生影一般模式有「動態強度」與「音訊開關」 | `/api/animate` 實際可接受欄位（`12_SOURCE_CODE_MAP.md` §A10、`server.js` L9274–L9900）**沒有**數值型動態強度，也**沒有**關閉音訊的參數 | 「動態強度」做成提示詞層級三段預設（§5.3）；「音訊開關」第一版改為唯讀標示「此模型會產生音訊」，關閉音訊列為待確認（§5.3） |
| 3 | 任務書要求品質三段「快速／標準／品質」 | 影片引擎只有兩段（`fast` true/false；H3 為 `h3Turbo`） | 圖片：三段（§5.1）；影片：「品質」= `fast:false` + 完成後可選放大，UI 仍顯示三段但第三段標示「含後製放大」（§5.3） |
| 4 | 任務書「Theme」設定 | Mix Studio 只有深色（`public/style.css` `:root` 單一深色 token，無 light theme） | 提供「深色（預設）／純黑（省電）」兩種，不做淺色；沿用相同 CSS 變數名稱 |
| 5 | 任務書「重試」 | server 無 `/api/queue/retry` 路由 | 重試 = 殼層以本機保存的送出參數重新 POST（§7）；待 Codex 確認 `/api/queue` 回傳是否含 `params` 以支援跨裝置重試 |

## 1. 設計原則

| 原則 | 具體規則 |
|---|---|
| Mobile-first | 以 360×800（Android 主流）設計，最大內容寬 640px 置中；桌機瀏覽器只是放大版 |
| 接近 Grok Imagine | 首頁 = 一個大提示詞框 + 四個模式 chip + 生成鍵；一般模式欄位 ≤ 8 個，全部一屏內可見（鍵盤收起時） |
| 不露技術細節 | 一般使用者不可看到：ComfyUI 節點名、Node ID、KSampler／Scheduler 字樣、模型檔名、Custom Node 名稱、JSON、`data/` 路徑、`comfyUrl`。**進度階段名稱用 §7 的 zh 對照表**，對照不到時顯示「處理中…」，英文原字串只放 Debug 區 |
| 常用在前、工程在後 | 進階設定一律在「進階設定」Bottom Sheet 內，預設收合；記住上次展開狀態（localStorage `simple.adv.<mode>`） |
| 觸控優先 | §12 尺寸規則；無 hover 依賴；長按有 haptic（`navigator.vibrate(10)`，不支援則略過） |
| 深色優先、不破壞既有 Theme | 殼層自帶 `public/simple/style.css`，**重新宣告** Mix Studio `style.css` `:root` 的同名 token（`--page-bg --ink --ink-soft --muted --panel --panel-strong --line --accent --radius-lg/md/sm --ease --mode-color`），不 `@import` 原 `style.css`（16k 行） |
| 零依賴 | 殼層與 Mix Studio 一致：純 HTML/CSS/JS，無框架、無 build、無 CDN（CSP `script-src 'self'`） |
| 可回進階 | 任何頁面的右上「⋯」選單有「進階工作室」→ `/studio`（同 session） |

## 2. 全域導航

底部固定 Tab Bar（高 56px + safe-area-inset-bottom）：

| 順序 | 名稱（固定字串） | 路由（殼層內 hash） | 圖示語意 |
|---|---|---|---|
| 1 | 首頁 | `#/` | 四格 |
| 2 | 任務 | `#/tasks` | 清單 + 未完成數徽章 |
| 3 | 素材庫 | `#/library` | 相片 |
| 4 | 自訂工作流 | `#/custom` | 節點 |
| 5 | 設定 | `#/settings` | 齒輪 |

- 生成中時「任務」Tab 顯示進度環（0–100%）。
- 未登入時所有 Tab 都導到登入頁 `#/login`（§11.1）。
- 頂部 App Bar：左「Mix Studio」字標（點擊回首頁），右「⋯」（進階工作室 / 登出 / 關於）。

## 3. 首頁（`#/`）

由上而下：

1. **狀態列**（單行，可折疊）：
   - ComfyUI 連線：`/api/setup/status` → 「已連線」綠點／「未連線」紅點（owner 看到「啟動」按鈕 → `POST /api/comfy/start`）。
   - GPU / VRAM：`/api/hardware` → `gpu.name`、`memoryBytes`（來源 `lib/hardware-info.js` `readGpuInfo`：nvidia-smi 或 ComfyUI `/system_stats`）。只在回傳有值時顯示；顯示格式「RTX 5090 · 32 GB」。VRAM 使用量**不顯示**（Mix Studio 無即時來源）。
   - 佇列：`/api/queue` → 「佇列 N」。
2. **提示詞框**（3 行自動長高，最高 8 行；右下「✕ 清除」「✨ 增強」）。
3. **四模式 Chip**（單選，橫向一排，44px 高）：文生圖 · 圖生圖 · 文生影 · 圖生影。選擇後下方參數區切換（§5）。
4. **參數區**（依模式）。
5. **生成鍵**（固定於鍵盤上方／畫面底部，全寬 52px，§12.3）。
6. **目前任務卡**（有執行中任務時）：縮圖／進度條／階段名／ETA／取消。
7. **最近結果**（橫向捲動 8 張，點擊進素材庫檢視）。

## 4. 通用元件規格

| 元件 | 規格 |
|---|---|
| 比例選擇 | 橫向 chip，值固定取自 `public/app.js` L232 `ASPECTS`：`1:1 4:5 3:4 2:3 9:16 3:2 4:3 16:9 21:9`；影片模式只顯示 `16:9 9:16 1:1 4:3 3:4`（其餘進階）。像素尺寸由殼層依比例與品質計算（§5.1 表），送 `width`/`height`，server 端再 `clampInt(64..4096)`（`server.js` 8702–8703） |
| 數量 | 步進器 1–8（server `clampInt(p.batch,1,8,1)` L8704）；影片固定 1 |
| Seed | 收合；展開後：隨機 🎲 / 輸入框（0–2^48，server L8751）；「鎖定」開關 = 下次生成沿用 |
| 上傳器 | 點擊或拖放；接受 §12.4 白名單；上傳 `POST /api/upload`（header `x-filename`、`x-asset-catalog: 1`）→ 回 `name`；顯示縮圖預覽（`/api/input?name=`）、檔名（清理後）、大小；可「更換」「移除」 |
| 風格 Preset | 來源 `GET /api/addons`（已安裝 Mix Packs，`lib/prompt-packs.js`）→ 以 `promptPresets` 送出；無安裝時隱藏此列 |
| 品質 | 三段 segmented control：快速／標準／品質（映射見 §5） |
| 進階設定 | Bottom Sheet（§12.2），標題「進階設定」，內含分組 |

## 5. 四模式欄位與參數映射（★ Codex WP-05 依此實作）

### 5.1 文生圖（`POST /api/generate`, `mode:'t2i'`）

一般模式欄位：

| 欄位 | UI | 送出參數 | 依據 |
|---|---|---|---|
| 提示詞 | 首頁提示詞框 | `prompt` | 必填，空值不可送 |
| 負面提示詞 | 折疊，展開後多行 | `negativePrompt` | `normalizeNegativePrompt` L8674 |
| 比例 | chip | `width`,`height`（下表） | `ASPECTS` |
| 品質 | 快速／標準／品質 | 快速：`krea2Turbo:true, steps:8`；標準：`krea2Turbo:false, steps:12`（需 `krea2raw` 元件已安裝，否則此段停用並提示）；品質：標準 + `postUpscale:{enabled:true, resolution:2048, profile:'sharp', noise:'low'}`（需 `upscale` 元件） | L8732（`p.krea2Turbo !== false`）、L8733（steps 預設 8/12）、`normalizePostUpscale` L5129 |
| 數量 | 步進器 | `batch` | 1–8 |
| 風格 Preset | chip 列 | `promptPresets` | `normalizePromptPresets` L8678 |
| Seed | 折疊 | `seed`（不送 = 隨機） | L8751 |
| 生成 | 主按鈕 | — | 成功回 `pid` → 跳任務頁 |

比例 → 像素（快速／標準；品質模式同標準，放大在後製）：

| 比例 | 寬×高 |
|---|---|
| 1:1 | 1024×1024 |
| 4:5 | 896×1120 |
| 3:4 | 896×1184 |
| 2:3 | 832×1248 |
| 9:16 | 768×1344 |
| 3:2 | 1248×832 |
| 4:3 | 1184×896 |
| 16:9 | 1344×768 |
| 21:9 | 1536×640 |

（皆為 16 的倍數、≤ 1.05 MP；`lib/vram-profile.js` 在 5090 為 `standard`，不套 low-VRAM 上限。待 Codex 對照 `public/app.js` `computeDims()` 若既有算法不同，以既有為準並回報。）

進階設定（分組）：

| 分組 | 欄位 | 參數 | 範圍／依據 |
|---|---|---|---|
| 模型 | 引擎：Krea 2 Turbo（預設）／Krea 2 Raw | `krea2Turbo` | Raw 需 `krea2raw` 元件 |
| LoRA | 多選 + 強度滑桿 | `loras:[{name,on,strength}]` | 清單來自 `GET /api/meta` 的 LoRA 列表（既有 `renderLoras` 用同來源；待 Codex 確認欄位名） |
| 取樣 | Steps | `steps` | 1–100（L8734） |
| 取樣 | CFG | `cfg` | 0–30，預設 1（L8734） |
| 取樣 | Sampler / Scheduler | **不提供**：`buildT2I` 寫死 `euler`/`beta`（style 引導時 `euler_ancestral`/`simple`，L4380–L4381）。UI 顯示「由引擎決定」 |
| 尺寸 | 精確寬高 | `width`,`height` | 64–4096，步進 16 |
| 圖片引導 | 上傳引導圖 + 模式：一般／深度／風格 + 強度 | `imageName`,`imageGuideMode:'image'|'depth'|'style'`,`denoise`／`depthStrength`／`styleStrength` | L8743–L8748；深度需 `krea2depth`、風格需 `krea2style` 元件 |
| 增強 | 提示詞增強（本機） | `enhance:true` | `lib/prompt-enhance.js`；雲端供應商不在此出現 |
| 後製 | 放大 | `postUpscale` | 需 `upscale` 元件 |

### 5.2 圖生圖（`POST /api/generate`）

預設路徑 = **Krea 2 img2img**：`mode:'t2i'` + `imageName` + `denoise`（`buildT2I` 讀 `p.imageName`；`test/krea2-img2img-ui.test.js` 證明此路徑存在）。

| 欄位 | UI | 參數 | 依據 |
|---|---|---|---|
| 圖片上傳 + 預覽 | 上傳器 | `imageName` | `/api/upload` |
| 提示詞 | 提示詞框 | `prompt` | 必填 |
| 修改強度 | 滑桿 0.1–1.0，預設 0.45，顯示「輕微／中等／大幅」刻度 | `denoise` | L8746–L8748：`clampNum(p.denoise, 0.05, 1, imageName ? 0.45 : 1)` |
| 比例 | chip（預設「跟隨原圖」= 以原圖比例取最接近的 ASPECTS） | `width`,`height` | 同 §5.1 |
| 品質 | 三段 | 同 §5.1 | |
| 數量 | 步進器 | `batch` | |
| 生成 | | | |

進階設定：

| 分組 | 欄位 | 參數 | 依據 |
|---|---|---|---|
| 編輯模式 | 切換為「指令編輯」：Klein 4B／Klein 9B／Qwen Edit／Krea 2 參考／Krea 2 Remix | `mode:'edit'`, `editEngine:'klein4'|'klein9'|'qwen'|'krea2ref'|'krea2remix'`, `refNames:[imageName,…]` | `buildGenerationGraph` L4906–L4919；引擎需對應元件已安裝（`/api/dependencies/status`）；切到指令編輯時「修改強度」隱藏（Klein/Qwen 的 denoise 為 null，L8895–L8909） |
| 遮罩 / Inpaint | 塗抹遮罩（Canvas，`public/mask-boxes.js` 可重用）+ 遮罩影響 | `maskImageName`（先上傳白黑遮罩 PNG）,`maskInfluence`,`editMaskFeather`,`editMaskInvert` | `buildKrea2Inpaint` L4393；限 `editEngine:'krea2'` |
| Outpaint / 外擴 | 方向 + 比例 + 羽化 | `editOutpaint:true`,`editOutpaintScale`(45–100),`editOutpaintFeather`(0–25),`editOutpaintOffsetX/Y`(0–1),`editOutpaintPosition` | L8682–L8692；需 `editoutpaint`/`krea2outpaint` 元件 |
| 參考圖 | 多張（≤ 8）+ 參考權重 | `refNames:[…]`,`krea2RefBoost`(0–20，預設 4) | L8681 |
| LoRA / Seed / 精確解析度 | 同 §5.1 | | |
| 角度 | 視角變換（Qwen） | `qwenAngle`,`anglePrompt` | `lib/edit-angle.js`；限 `qwen` |

### 5.3 文生影（`POST /api/animate`，不帶 `imageName`）

| 欄位 | UI | 參數 | 依據 |
|---|---|---|---|
| 提示詞 | 提示詞框 | `prompt` | |
| 比例 | chip（16:9 預設） | `width`,`height`（引擎自有 bucket：LTX 系列以 `ltx25`/`ltx` builder 對齊；殼層送 1280×720 / 720×1280 / 1024×1024 / 960×720 / 720×960，server 再對齊） | L9617–L9621 純 t2v 預設 704×1280（直式）；**待 Codex 對照 `public/app.js` `renderVideo`（L14511）既有比例→尺寸表，以既有為準** |
| 秒數 | 滑桿 | `seconds` | LTX 2.3：1–20（`LTX_MAX_SECONDS`）；LTX 2.5：1–20（`LTX25_MAX_SECONDS`，預設 5）；H3：5–15（`H3_MIN_SECONDS`/`H3_MAX_SECONDS`）。滑桿範圍隨引擎切換 |
| 品質 | 快速／標準／品質 | LTX 2.5：快速 `fast:true`、標準 `fast:false`（需 `ltx25quality` 元件）、品質 = 標準 + 完成後提示「放大」（`/api/video/upscale`，需 `upscale`）；H3：快速 `h3Turbo:true`（需 `h3turbo`）、標準 `h3Turbo:false`、品質同上；LTX 2.3：快速＝標準（無 fast 旗標，兩段合併顯示） | L9291、L9929（wan：4/20 steps）、`h3TurboRequested` L9288 |
| 動態強度 | 三段：輕微／中等／強烈（**提示詞層級**） | 以 `promptTemplate` 前置固定片語：輕微 `subtle, gentle, slow motion, minimal camera movement`；中等：不加；強烈 `dynamic, energetic, fast motion, expressive camera movement`。UI 註記「影響提示詞」 | `body.promptTemplate` 存在於 animate 欄位清單；非引擎參數（CONFLICTS_FOUND #2） |
| 音訊 | **唯讀標示**「此模型會產生音訊」（LTX 2.3 / 2.5 / H3 皆內建音訊 VAE；Wan 無） | 無參數 | `LTXVAudioVAELoader` L5388/L5625、`minimaxH3NativeAudioSampling`；關閉音訊 = **待 Codex 依實際環境確認**（選項：完成後 ffmpeg `-an` 去音軌另存，需新增 `lib/zh/strip-audio.js`，第二版） |
| 生成 | | 引擎：預設 `ltx25`（若未安裝依序退 `ltx`、`h3`；三者皆無 → 提示安裝） | 純 t2v 只允許 `ltx`/`ltx25`/`h3`（L9625–L9627） |

進階設定：

| 分組 | 欄位 | 參數 | 依據 |
|---|---|---|---|
| 模型 | LTX 2.5 / LTX 2.3 / MiniMax H3 | `engine` | `['ltx25','h3','wan','wan-animate2','eros','scail','ltx-edit']` 否則 `ltx`（L9276）；t2v 只列三個 |
| FPS | 唯讀顯示 | — | 由引擎決定：H3 24、LTX 2.5 24、LTX 2.3 25、Wan 16（L9727–L9788）；不可改 |
| Steps | 僅 Wan 顯示 | 由 `fast` 決定 4/20 | L9929 |
| Seed | | `seed` | L9838 `requestedSeed` |
| 負面提示詞 | | `negativePrompt` | 只在 `wan fast:false` 或 `ltx25 fast:false` 生效（L9307–L9309），其餘引擎隱藏 |
| 插幀 | 完成後動作 | `POST /api/video/interpolate`（RIFE，需 `rife` 元件） | `buildExistingVideoInterpolate` L6408 |
| 放大 | 完成後動作 | `POST /api/video/upscale`（SeedVR2） | `buildExistingVideoUpscale` L6364 |
| 長影片分段 | H3 長上下文 | `h3LongContext:true`（秒數上限改 `H3_LONG_CONTEXT_MAX_SECONDS`） | 需 `h3context` 元件 |
| 攝影機運動 | LTX 2.3 預設清單 | `cameraMotions:[…]` | `public/camera-motion.js`、`lib/ltx-director-workflows.js`；需 `ltxcamera` |
| 增強 | 本機提示詞增強 | `enhance` | 預設 true（L9845）；UI 可關 |
| LoRA | | `loras` | 影片 LoRA 清單需 `lib/lora-compat.js` 相容過濾 |

### 5.4 圖生影（`POST /api/animate`，帶 `imageName` 或素材庫 `id`）

| 欄位 | UI | 參數 | 依據 |
|---|---|---|---|
| 首幀圖片 + 預覽 | 上傳器；或從素材庫「再次使用」帶入 | `imageName`（上傳）或 `id`（素材庫項目，server 自動重傳 L9598–L9604） | |
| 動作提示詞 | 提示詞框（placeholder「描述畫面如何動」） | `prompt` | |
| 比例 | 預設「跟隨首幀」 | `width`,`height` | L9606–L9609 取上傳尺寸 |
| 秒數 | 滑桿 | `seconds` | 同 §5.3 + Wan 2.2：`wanDurationSeconds`（待 Codex 確認 wan 的秒數上限常數） |
| 品質 | 同 §5.3 | `fast`/`h3Turbo` | |
| 動態強度 | 同 §5.3（提示詞層級） | `promptTemplate` | |
| 音訊 | 同 §5.3（Wan 顯示「無音訊」） | — | |
| 生成 | 引擎預設 `ltx25`；圖生影可選 `wan` | | Wan/Eros/SCAIL 需圖片（L9625） |

進階設定（在 §5.3 之上追加）：

| 欄位 | 參數 | 依據 |
|---|---|---|
| 尾幀 | `endImageName`（上傳）| L9639、L9850；LTX 系列 |
| 參考影片（動作驅動） | `driveVideoName`,`driveStartSeconds`,`driveDurSeconds` | SCAIL 2 / Wan Animate 2 / LTX Edit（L9632–L9640）；需對應元件 |
| 參考音訊 | `audioName`（口型／聲音） | `buildAnimateFaceId opts.audioName`（`AGENTS.md`）；**待 Codex 確認 `/api/animate` body 對應欄位名**（欄位清單中未見 `audioName`，可能經 `faceImageName` 流程） |
| Face ID | `faceImageName` | 限 `engine:'ltx'`（L9631）；需 `faceid` 元件 |
| 角色一致性 | H3 參考模式 `h3Mode:'reference'`,`h3References` | 需 `h3r2v` |
| FPS / 插幀 / 放大 / 長影片 / LoRA / Seed | 同 §5.3 | |

## 6. 進階設定 Bottom Sheet 通則

- 只列**已安裝元件**能用的欄位；未安裝的顯示灰階 + 「需安裝 ○○（約 N GB）」→ 導到設定 › 模型。元件狀態來源 `GET /api/dependencies/status` 與新增 `GET /api/simple/capabilities`（`lib/zh/simple-capabilities.js` 把 `availableComponents()` 整理成 `{engines, features}`）。
- 每個欄位右側「ⓘ」= 一句白話說明（zh-TW.json `help.*`）。
- 「重設為預設」在 Sheet 底部。
- Sheet 內數值變更即時反映到首頁的「摘要列」（例：`16:9 · 5 秒 · 標準 · Seed 鎖定`）。

## 7. 任務頁（`#/tasks`）

資料來源：`GET /api/queue`（初始）+ SSE `/api/events`（`progress`、`complete`、`error`、`queue` 事件；殼層 `connectEvents()` 重寫版，斷線 3 秒重連並在 `onopen` 重抓 `/api/queue`）。

| 區段 | 內容 |
|---|---|
| 分段 Tab | 進行中（排隊中＋生成中）／已完成／失敗 |
| 任務卡 | 縮圖（輸入圖或模式圖示）、模式名、簡短提示詞（≤ 60 字）、狀態徽章、進度條 + 百分比、階段名稱、ETA、提交時間 |
| 階段名稱 | `lib/progress-labels.js` 回傳英文（如 `Loading Krea 2...`）→ 殼層 `zh-TW.json` `stages` 對照表翻譯（鍵 = 英文原字串）；無對照 → 「處理中…」 |
| ETA | `public/progress-eta.js` 演算法移植到殼層（純函式） |
| 動作 | 排隊中：取消（`POST /api/queue/cancel {id}`）、上移／下移（`POST /api/queue/reorder`，僅 `reorderable:true` 的項目顯示，L10947 `markReorderable`）；生成中：取消（`/api/interrupt` 或 cancel）；失敗：重試（殼層以本機 `simple.jobs.<pid>` 保存的送出參數重新 POST）、查看錯誤；完成：檢視（跳素材庫該項） |
| 其他 profile 的任務 | `/api/queue` 已脫敏為「另一位使用者的任務」（L10925–L10929），只顯示進度不顯示操作 |
| ComfyUI 忙碌提示 | `queue_running` 中有非本 App 的 `prompt_id`（例如 MCWW）→ 頂部橫幅「ComfyUI 正在執行自訂工作流，任務會排在其後」 |
| Debug 展開區 | 卡片底部「詳細資訊」折疊：`prompt_id`、引擎、原始階段字串、（僅 owner）目前節點 class；**Node ID 只允許出現在這裡** |
| 空狀態 | 「還沒有任務。到首頁生成第一張圖吧。」+ 回首頁按鈕 |

## 8. 素材庫（`#/library`）

資料：`GET /api/gallery`（分頁參數以既有為準；殼層每頁 40 項，捲到底再載入），項目欄位取既有 `item`（`file`、`width/height`、`pngDims`、`params`、`prompt`、`seed`、`engine`、`liked`、`folderId`、`createdAt`…；**待 Codex 以 `/api/gallery` 實際回傳欄位為準**）。

| 功能 | 規格 |
|---|---|
| 類型篩選 | 全部／圖片／影片／音訊（音訊 = `hasAudio` 的影片或 `kind:'audio'` 的上傳資產） |
| 搜尋 | 提示詞、模式、日期；本機過濾已載入項目 + 呼叫既有搜尋（`test/library-search-ui.test.js` 證明既有支援，**待 Codex 確認查詢參數名**） |
| 收藏 | `POST /api/item/:id/like`（`likeRoute` L11649）；篩選「收藏」 |
| 網格 | 3 欄（≥ 480px 時 4 欄）、正方形縮圖 `object-fit: cover`、影片顯示時長角標 |
| 檢視頁（全螢幕） | 左右滑動切換；捏合縮放（圖片）；影片原生 `<video controls playsinline>`；下方資訊卡：提示詞（可複製）、負面提示詞、模型（引擎中文名）、Seed（可複製）、尺寸、秒數／FPS、LoRA、建立時間 |
| 動作列 | 下載（`/images/<file>` 或 `/videos/<file>`，`download` 屬性；多選時 `POST /api/items/download` ZIP）、再次使用（把 `params` 帶回對應模式並跳首頁）、收藏、移到資料夾、刪除 |
| 刪除 | 二次確認 → `DELETE /api/item/:id`（既有進 `data/trash/`，`lib/deleted-media.js`）；「垃圾桶」入口在素材庫右上：列出 `GET /api/trash`，可還原／永久刪除 |
| 分組 | 同一次 `batch` 的結果以既有 group 顯示為一張卡 + 「N 張」角標（`lib/gallery-grouping.js`） |
| 私密資料夾 | 既有 `lib/private-gallery.js`：鎖定資料夾顯示鎖圖示，需 `POST /api/private/unlock` |

## 9. 自訂工作流（`#/custom`，名稱固定「自訂工作流」）

依 `13_MCWW_INTEGRATION_SPEC.md`。

| 區塊 | 內容 |
|---|---|
| 狀態卡 | `GET /api/custom-workflows/status`：「已就緒」／「尚未啟動：<reason>」；owner 顯示「啟動 ComfyUI」 |
| 主按鈕 | 「開啟自訂工作流」→ `<a href="/custom-workflows/open" target="_blank" rel="noopener">`；非 owner 且 `ownerOnly` → 按鈕停用 + 說明 |
| 說明卡 | 三步驟：① 在電腦的 ComfyUI 把節點標題改成 `<標籤:prompt:1>`、輸出節點 `<結果:output:1>` ② 另存到 `user/default/workflows/mcww/` ③ 回到這裡按「開啟」。附「查看範例」連到 MCWW 內建範例名稱清單（純文字） |
| 最近工作流 | `status.recent[]`：檔名（去 `.json`）+ 修改時間；唯讀 |
| 外出提示 | `tailscaleConfigured:false` 且目前為 https 連線 → 「外出時尚未啟用自訂工作流 HTTPS」+ owner 一鍵啟用（`POST /api/custom-workflows/enable-https`） |
| 返回主介面 | MCWW 是新分頁，返回 = 關閉分頁；本頁頂部仍有「返回首頁」。若 iframe 模式（設定開啟）：全螢幕 iframe + 頂部細條「← 返回主介面」 |
| 禁止 | 頁面任何地方不出現 `:8188`、`:7860`、`localhost` |

## 10. 設定（`#/settings`）

| 區段 | 項目 | API |
|---|---|---|
| 帳號 | 目前 profile、切換 profile、修改 PIN、登出、登出所有裝置 | `/api/me`、`/api/profiles`、`/api/profiles/:id`（PIN）、`/api/logout`、新增 `/api/logout-all` |
| 語言 | 繁體中文（預設）／English | 殼層 `locales/*.json`；`localStorage simple.lang` |
| 外觀 | 深色（預設）／純黑 | `localStorage simple.theme`；只換 `--page-bg`/`--panel` token |
| 連線 | ComfyUI 狀態、區網網址 + QR（`public/qrcodegen.js` 可重用）、Tailscale 狀態、「啟用 HTTPS」（owner） | `/api/setup/status`、`/api/settings`（`mobileAccess` 段，L6835–L6880）、`/api/mobile-access/enable-https` |
| 隱私 | 匿名分析（預設關，opt-in 開關 + 說明文字：「只記錄 App 啟動與模型啟動次數，不含提示詞、圖片、影片、畫面錄製」）；雲端提示詞增強（預設關；開啟需勾選第三方告知） | `/api/analytics-config` + 新增 `POST /api/simple/analytics`；`/api/settings` `externalLlmProvider` |
| 模型與工作流（進階） | 元件清單：已安裝／未安裝／容量；安裝進度；HF Token 設定（只顯示「已設定／未設定」） | `/api/dependencies/status|install|cancel`、`/api/settings`（`hfTokenConfigured`，token 值永不回傳，L678） |
| 管理者（owner 才顯示） | 重啟 Mix Studio、啟動／重啟 ComfyUI、自訂工作流設定（僅擁有者／iframe）、更新（顯示「由腳本管理」+ 目前版本 `release.json`） | `/api/app/restart`、`/api/comfy/start|restart`、`/api/custom-workflows/settings`、`/api/releases/latest` |
| 關於 | 版本、授權（連到 `docs/zh-tw/16_LICENSE_SPEC.md` 的摘要頁 `/simple/licenses.html`）、原始碼連結（Mix Studio、MCWW） | AGPL 要求可得性（16 號） |

## 11. 登入與首次設定

### 11.1 登入頁（`#/login`）
- 列出 profiles（`GET /api/profiles` → `profiles[]`、`access.remote`、`access.ownerHasPin`）。
- 點 profile → PIN 鍵盤（數字為主，可切全鍵盤）→ `POST /api/profiles/:id/login {pin}`。
- 錯誤：「PIN 錯誤」；429：「嘗試太多次，請 N 秒後再試」（`Retry-After`）。
- `access.remote && !access.ownerHasPin` → 顯示「請先在電腦上為擁有者設定 PIN」，不顯示 PIN 鍵盤。
- 記住上次 profile（localStorage），下次直接開 PIN 鍵盤。

### 11.2 首次設定（主機本機、無 profile 時）
建立擁有者（名稱 + PIN 兩次輸入 + 強度提示）→ 完成 → 首頁引導卡「掃描 QR 用手機開啟」。

## 12. 手機 UX 規則

### 12.1 觸控尺寸
- 最小可點區域 44×44 px；相鄰可點元件間距 ≥ 8 px。
- Chip 高 40 px（含 4 px 外邊距達 44）；主要按鈕 52 px；Tab 56 px。
- 滑桿 thumb 28 px、軌道命中區 44 px；數值以 tooltip 顯示，並提供 −/+ 步進鍵。
- 字級：正文 15 px、輔助 13 px（最小）、標題 20 px；行高 1.4。

### 12.2 Bottom Sheet / Modal 規則
- 參數與選擇 → Bottom Sheet（從底部滑入，高 60% 或內容高，可拖到 92%）；有把手、點背景關閉、`Esc`/返回鍵關閉（`history.pushState` 攔截 Android 返回鍵）。
- 破壞性確認（刪除、取消生成、登出所有裝置）→ 置中 Modal，主按鈕紅色，次按鈕「取消」在左。
- 一次只有一個 Sheet；Sheet 開啟時背景 `inert`、鎖捲動（沿用 Mix Studio `syncSheetScrollLock` 的做法）。
- 全螢幕檢視器（素材庫）是獨立層，上滑關閉。

### 12.3 鍵盤與生成鍵
- 生成鍵固定在視窗底部（`position: fixed; bottom: env(safe-area-inset-bottom)`），鍵盤彈出時用 `visualViewport` API 把生成鍵貼到鍵盤上緣；提示詞框聚焦時自動 `scrollIntoView({block:'center'})`。
- 提示詞框 `enterkeyhint="done"`；Enter 不送出（多行），送出只用生成鍵。
- 鍵盤打開時隱藏 Tab Bar。

### 12.4 圖片／影片預覽與上傳
- 上傳前本機用 `<img>`/`<video>` 讀 `URL.createObjectURL` 顯示預覽與尺寸；超過 2 GB 直接拒絕。
- 白名單（與 15 號 §6 一致）：圖 `png jpg jpeg webp`；影 `mp4 mov webm`；音 `wav mp3 m4a flac ogg`；`<input accept>` 同步。
- 影片預覽 `playsinline muted loop`，只在可見時播放（IntersectionObserver）；素材庫縮圖用 `/video-previews/<file>?size=…`（既有）。
- 圖片檢視器支援捏合縮放與雙擊放大。

### 12.5 橫豎屏
- 預設直式；橫式時：Tab Bar 改為左側 Rail（64 px），內容區兩欄（參數｜預覽）；`manifest.webmanifest` `orientation: "any"`。

### 12.6 長列表
- 任務／素材庫：虛擬捲動或分頁載入（每頁 40），保留捲動位置（`history.state`）；圖片 `loading="lazy"` + `decoding="async"`；縮圖固定尺寸避免版面跳動。

### 12.7 Loading
- 首次載入：骨架屏（App Bar + 提示詞框 + 4 chip）≤ 300 ms 出現；API 逾時 10 秒顯示重試。
- 按鈕動作：按下即 disabled + spinner，避免重複送出；生成鍵送出後 500 ms 內跳任務頁。
- 進度條：不確定狀態用條紋動畫；有百分比時平滑過渡（CSS transition 300 ms）。

### 12.8 Toast / Error Banner
- Toast：底部（Tab Bar 上方）、3 秒自動消失、最多疊 2 個、可點關閉；用於「已加入佇列」「已下載」「已複製」。
- Error Banner：頂部固定、紅底、直到解決才消失；用於 ComfyUI 未連線、Session 過期、離線。
- 錯誤文字用 zh-TW，API 回傳的英文 `error` 放在「詳細」折疊中；已知 `code` 對照表：`auth`→請重新登入、`pin_rate_limited`→嘗試太多次、`job_cancelled`→已取消、`comfy_krea2_update_required`→需更新 ComfyUI、`mcww_unavailable`→自訂工作流尚未啟動、`owner_pin_required`、`pin_required`、`csrf`、`unsupported_type`。

### 12.9 網路斷線與恢復
- `navigator.onLine` false 或 SSE 斷線 > 3 秒 → 頂部黃色 Banner「連線中斷，正在重試…」；恢復後自動重抓 `/api/queue`、`/api/me`，Banner 變綠 2 秒後消失。
- 生成中斷線：任務卡保留「最後已知進度」並標示時間。
- 離線時生成鍵停用；表單內容保留在 localStorage（`simple.form.<mode>`），重整不丟。
- PWA：`public/simple/sw.js` 只快取殼層靜態檔（app shell），**不快取 API 與媒體**；離線頁 `public/simple/offline.html`。

## 13. zh-TW 固定詞彙（`locales/zh-TW.json` 必須使用）

| 英文 | 繁中 | 英文 | 繁中 |
|---|---|---|---|
| Video | 影片 | Image | 圖片 |
| Settings | 設定 | Queue | 佇列 |
| File | 檔案 | Download | 下載 |
| Retry | 重試 | Cancel | 取消 |
| Library | 素材庫 | Custom Workflows | 自訂工作流 |
| Generate | 生成 | Prompt | 提示詞 |
| Negative Prompt | 負面提示詞 | Aspect Ratio | 比例 |
| Quality | 品質 | Batch / Count | 數量 |
| Style Preset | 風格預設 | Seed | Seed（保留英文） |
| Steps | 步數 | LoRA | LoRA（保留） |
| Upscale | 放大 | Interpolation | 插幀 |
| First Frame | 首幀 | Last Frame | 尾幀 |
| Duration | 秒數 | Motion | 動態 |
| Audio | 音訊 | Reference | 參考 |
| Task / Job | 任務 | Queued | 排隊中 |
| Running / Generating | 生成中 | Completed | 已完成 |
| Failed | 失敗 | Trash | 垃圾桶 |
| Restore | 還原 | Favorite | 收藏 |
| Reuse | 再次使用 | Advanced | 進階設定 |
| Owner | 擁有者 | Profile | 使用者 |
| Sign in / Sign out | 登入／登出 | PIN | PIN |
| Model | 模型 | Engine | 引擎 |
| Home | 首頁 | Studio (advanced UI) | 進階工作室 |

其他規則：全形標點；數字與英文前後留半形空格（「5 秒」「16:9」）；不使用簡體用語（視頻、文件、下載器→檔案）。

## 14. 交付檢查表（Codex WP-04 自檢）

- [ ] 五個 Tab 皆可達，未登入全部導到登入頁
- [ ] 四模式一般欄位與 §5 表一致，送出 payload 與表中參數名一致（以 `test/zh-simple-payload.test.js` 驗證）
- [ ] 未安裝元件的選項灰階並有安裝導引
- [ ] 任何畫面 grep 不到 `8188`、`7860`、`KSampler`、`node_id`、`.safetensors`（Debug 折疊區除外）
- [ ] 所有可點元件 ≥ 44 px（以 DevTools 量測 10 個抽樣）
- [ ] 鍵盤彈出時生成鍵可見
- [ ] 斷網 10 秒後恢復，任務頁自動更新
- [ ] `zh-TW.json` 覆蓋率 100%（缺鍵時 console.warn 且顯示英文 fallback）
