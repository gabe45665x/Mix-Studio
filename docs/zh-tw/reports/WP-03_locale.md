# WP-03：zh-TW Locale 與自訂設定基礎

## 結論

WP-03 已完成。簡易殼層目前具備對稱的繁中／英文語系資料、英文 fallback 翻譯核心，以及不會把未知欄位寫入設定檔的原子設定存取層。本工作包沒有掛接 `server.js`、沒有改動原版 `/studio`，也沒有寫入正式 `data/`。

主要實作 commit：`3fa6c78`（`WP-03: 建立繁中語系與設定基礎`）。

## 完成項目

- `zh-TW.json` 與 `en.json` 各有 340 個對稱、非空語系鍵，分為 15 個區段。
- 使用台灣慣用詞：影片、圖片、設定、檔案、佇列、下載、素材庫、自訂工作流。
- `stages` 包含 48 個靜態進度標籤與 5 個動態進度模板，共 53 項。
- `i18n.js` 提供 `t(key, vars)` 行為：變數插值、缺鍵警告、英文 fallback、最後回傳鍵名。
- `lib/zh/config.js` 提供 `readZhConfig()` 與 `writeZhConfig(patch)`：
  - 預設關閉 Analytics。
  - 預設不確認雲端 LLM 資料傳送。
  - Session 預設 30 天，上限 90 天。
  - MCWW 預設 `127.0.0.1:7860` 的設定值與 3301 代理 port。
  - 未知欄位丟棄、非法值拒絕、先寫 `.tmp` 再 rename。
- 所有新增 JS 與測試檔均有 GPL-3.0-or-later SPDX 標頭。

## 修改檔案

| 檔案 | 用途 |
|---|---|
| `public/simple/locales/zh-TW.json` | 繁中語系與進度翻譯 |
| `public/simple/locales/en.json` | 英文 fallback，鍵集合與繁中完全相同 |
| `public/simple/i18n.js` | 零依賴翻譯核心 |
| `lib/zh/config.js` | `data/zh-tw.json` 的驗證、合併與原子存取 |
| `test/zh-locale.test.js` | 語系完整性、台灣詞彙、進度覆蓋、fallback |
| `test/zh-config.test.js` | 預設值、非法值、未知欄位與原子寫入 |

`git show --stat 3fa6c78`：6 個檔案，新增 1,144 行。

## TDD 證據

1. RED：先執行 `node --test test/zh-locale.test.js test/zh-config.test.js`，兩個測試檔都因 `public/simple/i18n.js` 與 `lib/zh/config.js` 尚不存在而失敗。
2. GREEN：完成最小實作後，WP-03 專用測試 9/9 通過。
3. REFACTOR：移除 WP-04 才需要的預載功能，只保留本工作包有測試保護的 API；測試保持全綠。

## 驗證結果

| 驗證 | 結果 |
|---|---|
| `node --check public/simple/i18n.js` | Pass |
| `node --check lib/zh/config.js` | Pass |
| `node --test test/zh-locale.test.js test/zh-config.test.js` | 9/9 Pass |
| 完整 `node --test --test-reporter=dot` | 1,273/1,273 Pass |
| `git diff --check` | Pass |
| 密鑰樣式掃描 | 無命中 |

完整測試在隔離的 `%APPDATA%` 與 `%LOCALAPPDATA%` 下執行。只隔離 `%LOCALAPPDATA%` 時，上游既有 `model-discovery` 測試會讀取主機真實 `%APPDATA%\Comfy Desktop` 設定，進而把 `ComfyUI-Shared\models` 加入測試結果；同時隔離兩者後，該案與全部測試均通過。未修改使用者模型、Comfy Desktop 設定或上游探索邏輯。

## 未確認事項

- Owner PIN 尚待使用者在已開啟的 Mix Studio 頁面輸入；不影響 WP-03。
- 語系檔的瀏覽器載入、`/` 簡易殼層掛接與動態進度模板套用屬 WP-04。
- 原版 `/studio` 依主需求 R-42 維持英文，不在第一版翻譯範圍。

## 回退

執行 `git revert 3fa6c78` 可完整移除本工作包；因未修改 `server.js` 或正式 `data/`，不需資料遷移。

## 下一步

進入 WP-04：建立 `public/simple/` 手機殼層、登入頁、五個 Tab 與四模式表單骨架。WP-04 完成後需由使用者以手機確認 UI 方向，才可進入 WP-05。
