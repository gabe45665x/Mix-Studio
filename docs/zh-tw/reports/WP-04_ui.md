# WP-04 手機優先簡易介面

## 結果

新增零框架、零 CDN 的手機優先簡易殼層，首頁位於 `/`；原始 Advanced Studio 完整保留於 `/studio`。簡易殼層包含登入、首頁、任務、作品庫、自訂工作流預留頁、設定、繁中／英文切換、深色主題、PWA 離線殼層與授權頁。

首頁提供文字生圖、圖片編輯、文字生影片與圖片生影片四個操作入口，並以能力 API 顯示目前可用狀態。能力回應只包含 `engines`、`features`、`limits`，不回傳 ComfyUI 位址、本機路徑、節點名稱或模型檔名。

## 實作範圍

- `/`：手機簡易介面。
- `/studio`：未改寫的原始完整工作區。
- `GET /api/simple/capabilities`：依目前安裝狀態產生去識別化、失敗關閉的能力資訊。
- `POST /api/simple/analytics`：僅擁有者可更新匿名分析偏好，寫入 `data/zh-tw.json`；`GET /api/analytics-config` 以同一份伺服器設定為準，關閉時不下發收集金鑰或主機。
- PWA：本機 manifest、service worker、離線頁與 SVG 圖示。
- 五分頁導覽：首頁、任務、作品庫、自訂工作流、設定。
- 任務：提交時間、階段、ETA、最後已知進度、詳細資訊、取消與可重排佇列操作。
- 作品庫：全頁檢視器、下載、複製提示詞、收藏、再次使用、二次確認刪除與垃圾桶容量／永久清空。
- 手機連線：優先選實體 Wi-Fi／乙太網路而非虛擬網卡，顯示區網網址、純本機 QR、Tailscale 與 HTTPS 狀態。
- 手機韌性：四模式各自保存草稿；SSE 中斷三秒顯示警告，恢復時重驗 session 與佇列；Bottom Sheet 支援 `inert`、`Esc`、Android 返回鍵與 `visualViewport` 鍵盤位移。

## 畫面證據

- [手機首頁](assets/wp04/wp04-mobile.png)
- [圖生圖表單](assets/wp04/wp04-image-image.png)
- [文生影表單](assets/wp04/wp04-text-video.png)
- [圖生影表單](assets/wp04/wp04-image-video.png)
- [桌面寬度](assets/wp04/wp04-desktop.png)
- [登入](assets/wp04/wp04-login.png)
- [任務](assets/wp04/wp04-tasks.png)
- [作品庫](assets/wp04/wp04-library.png)
- [設定](assets/wp04/wp04-settings.png)
- [英文介面](assets/wp04/wp04-english.png)
- [Lighthouse JSON](assets/wp04/lighthouse-mobile.json)

## 驗證

- 完整 Node 測試：1,295 通過、0 失敗。
- Lighthouse 手機版：Performance 97、Accessibility 100、Best Practices 100。
- FCP 0.9 秒、LCP 2.6 秒、TBT 0 毫秒、CLS 0、Speed Index 0.9 秒。
- 四模式手機與桌面瀏覽器檢查：無水平溢位、可見互動元件皆至少 44 × 44 px、敏感內部字串 0、無非預期 console 錯誤。
- 簡易殼層 JavaScript 合計 80,059 字元，低於 150 KB 上限。
- `/` 與 `/studio` 均回傳 200；能力 API 頂層只有 `engines`、`features`、`limits`，敏感欄位掃描為 0。
- 原始 Studio 與 ComfyUI 連線正常；目前受管模型／元件仍未達簡易模式可生成條件，因此首頁正確顯示「需要安裝工作流」。
- 離線狀態會立即停用生成按鈕，action handler 也會再次攔截離線提交；SSE 失聯時會重驗 session，避免過期登入留在可操作狀態。

## 本階段刻意不做

- WP-05：四種模式的正式 payload 對應與實際生成；失敗任務的同參數重試，以及再次使用時完整還原 seed／LoRA／媒體參照。
- WP-06：審核後的節點與模型安裝。
- WP-07：MCWW 工作流開啟、安裝與狀態。
- WP-08：完整分析執行期接線與安全收尾。
- 既有垃圾桶後端目前只提供總數／容量與永久清空，沒有逐項索引或 restore API；殼層清楚標示此限制，未私自增加超出 WP-04 三個 server 掛鉤的還原資料格式。

## 使用者驗收門

WP-04 的程式與桌面瀏覽器驗證已完成；進入 WP-05 前仍需使用者用實體 Android 手機檢視方向。遠端登入必須先由使用者本人在擁有者設定中建立 PIN；PIN 不由程式代填、產生或記錄。
