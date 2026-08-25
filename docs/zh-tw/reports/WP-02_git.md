# WP-02 安全 Git 工作分支報告

日期：2026-08-25
狀態：完成

## 完成項目

- 建立正確的 GitHub Fork：`https://github.com/gabe45665x/Mix-Studio`
- 設定 `origin` 為使用者 Fork，`upstream` 為官方 `BlackMixture/Mix-Studio`
- 從指定基準 commit `bec329225456846d8143f82f199d79f28ec0a04c` 建立 `zh-tw` 分支
- 建立 `baseline-bec3292` tag，指向指定基準 commit
- 將 09～18 號規格文件放入 `docs/zh-tw/`
- `.gitignore` 追加本機環境、報告壓縮檔與備份排除規則；未移除原有規則
- 新增 `.githooks/pre-commit`，拒絕疑似 Hugging Face token、PIN hash、auth secret 與 session cookie 值
- 設定 `core.hooksPath=.githooks`
- 新增可重複執行的 `scripts/zh/git-setup.ps1`
- 新增 hook 與 Git 設定腳本的自動測試
- repo-local 提交者使用 GitHub noreply 信箱，未將私人信箱寫入 commit

## Git 狀態

```text
branch: zh-tw
origin: https://github.com/gabe45665x/Mix-Studio.git
upstream: https://github.com/BlackMixture/Mix-Studio.git
baseline-bec3292: bec329225456846d8143f82f199d79f28ec0a04c
hooksPath: .githooks
```

實作 commits：

```text
9fd842b236ae370d0c9dfb33fd8a831bf40b00b9 WP-02: 建立安全 Git 工作分支
2190a27e0b2037403d755b339981606f8ec0ee3a WP-02: 修正 Windows 密鑰掃描 hook
f05e51e6d57b17c242d06a099d4b5f0bec71be0d WP-02: 新增 Git 工作流報告
```

報告前的 `git diff --stat baseline-bec3292..HEAD`：15 個檔案，新增 2697 行。

## 測試結果

1. WP-02 專用測試：2/2 通過。
   - 一般文字可提交。
   - 四類疑似密鑰值均被拒絕。
   - 使用真實 repo 暫存一個 24 字元假 HF token，`git hook run pre-commit` 回傳 exit 1，測後已取消暫存並移除 probe。
   - Git 設定腳本連續執行兩次皆成功，remote、branch、tag 與 hooksPath 保持正確。
2. 官方完整測試直接執行：1263/1264 通過；1 個既有 `model-discovery` 測試受到本機 Comfy Desktop 真實 `%LOCALAPPDATA%` 模型設定污染。
3. 將 `%APPDATA%` 與 `%LOCALAPPDATA%` 指向空白隔離目錄後重跑完整測試：1264/1264 通過，0 failure。
4. `git diff --cached --check`：通過。
5. `git push -u origin zh-tw --tags`：成功；遠端已建立 `zh-tw`、`baseline-bec3292`，並同步官方既有版本 tags `v1.0.1`～`v1.2.4`。
6. GitHub 瀏覽器驗證：`https://github.com/gabe45665x/Mix-Studio/tree/zh-tw` 可正常開啟。

## 規格衝突與保守處理

WP-02 同時要求「只要出現 `pinHash`、`auth_secret`、`ks_profile=` 字樣就阻擋」以及提交本身包含這些安全術語的 09～18 號規格文件。若照字面實作，規格文件與後續安全程式碼都無法提交。

因此 hook 採以下保守規則：

- HF token 格式仍無條件阻擋。
- 其他三類只在後方出現至少 20 字元、外觀像密鑰或 session 值時阻擋。
- 僅討論欄位名稱、檔名或安全規格的文字不阻擋。
- hook 不依賴 Git Bash 的 `grep`，改以 Git 自身的 `-G` pickaxe 執行，避免 Windows 非登入 shell 找不到工具而 fail-open。

## 未確認事項

- Codex GitHub 連線帳號為 `gabe840621-hub`，Chrome 已登入帳號為 `gabe45665x`；Fork 建立在能實際建立與推送的 `gabe45665x`。
- 先前交接摘要誤指向 ComfyUI，因而多建立了 `https://github.com/gabe45665x/ComfyUI` Fork。未經刪除確認，現保留不動；不影響本專案。
- WP-01 的瀏覽器 Smoke Test（啟動 UI、建立 Owner+PIN、連線 ComfyUI、`/api/me`）尚未完成。依計畫，該 Gate 通過前不開始 WP-03 功能客製。

## 下一步

回到 WP-01 完成官方原版 Smoke Test；通過 Gate 後才開始 WP-03。
