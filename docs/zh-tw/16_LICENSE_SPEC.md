# 16_LICENSE_SPEC.md — 授權與合規規格

> 本文件是**工程合規規格**，不取代法律意見。未來若商業發布，需再做正式法律審查。
> 驗證方式標示：**[已驗證]** = 本次實際讀取該 repo 的 LICENSE 檔（`raw.githubusercontent.com/<repo>/HEAD/LICENSE*`，2026-08-25）；**[公開資訊]** = 依 2026-01 前公開資訊，Codex 安裝時須以模型卡／LICENSE 再確認；**[待確認]** = 無可靠來源，Codex 依實際環境確認後填入。
> 注意：以 HEAD 檢查，Mix Studio 釘死的 commit（`lib/dependency-installer.js` `NODE_PACKS.*.ref`）可能較舊；WP-10 安裝時對釘死 commit 再讀一次 LICENSE 並記錄到 `docs/zh-tw/THIRD_PARTY_LICENSES.md`。

## CONFLICTS_FOUND

| # | 衝突 | 來源 | 保守處理 |
|---|---|---|---|
| 1 | 企劃書要求對照 SuperGrok `04_PRIVACY_LICENSE_RISK.md` 與 `02_MODEL_WORKFLOW_MATRIX.md` | 兩份文件至今**未提供** | 本文件以 Mix Studio 原始碼 `lib/dependency-installer.js` 的 `NODE_PACKS` 與 `MODEL_ASSETS` 為唯一清單來源；SuperGrok 文件到位後由 Codex 做差異比對並附在 WP-10 報告 |
| 2 | 專案目標「合法成人內容不在應用層封鎖」 vs 部分**模型／文字編碼器授權**含使用政策（見 §5） | 授權條款 vs 專案需求 | 應用層不加封鎖（維持 R-66）；授權層風險逐項記錄，由專案擁有者自行承擔並在設定頁「關於 › 授權」揭露 |

## 1. 授權總表（程式）

| 名稱 | 官方來源 | License | 私人自用 | 修改 | 分發 | 網路服務 | 要求提供原始碼 | 保留 LICENSE/NOTICE | 商用限制 | 成人內容限制（授權明文） | 未確認事項 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mix Studio | github.com/BlackMixture/Mix-Studio | **GPL-3.0** [已驗證] | 可 | 可 | 可，須附完整對應原始碼 | 可（GPLv3 無網路條款） | 分發時是 | 是 | 無 | 無 | — |
| MCWW | github.com/light-and-ray/Minimalistic-Comfy-Wrapper-WebUI | **AGPL-3.0** [已驗證] | 可 | 可 | 可，須附原始碼 | **可，但使用者透過網路互動時須提供對應原始碼（§13）** | 分發或網路服務時是 | 是 | 無 | 無 | — |
| ComfyUI | github.com/Comfy-Org/ComfyUI | GPL-3.0 [已驗證] | 可 | 可 | 可，附原始碼 | 可 | 分發時是 | 是 | 無 | 無 | — |
| ComfyUI-Manager | github.com/Comfy-Org/ComfyUI-Manager | GPL-3.0 [已驗證] | 可 | 可 | 可，附原始碼 | 可 | 分發時是 | 是 | 無 | 無 | 本專案不強制安裝（Mix Studio 自帶 `NODE_PACKS` 安裝器） |
| Gradio 5.49.1 | github.com/gradio-app/gradio | Apache-2.0 [已驗證] | 可 | 可 | 可 | 可 | 否 | 是（含 NOTICE） | 無 | 無 | — |
| Node.js、Python、Tailscale 客戶端 | 各官方 | MIT / PSF / BSD-3 [公開資訊] | 可 | — | — | — | 否 | 是 | 無 | 無 | — |

## 2. 主要 Custom Nodes（Mix Studio `NODE_PACKS`，HEAD LICENSE 實讀）

| Repo | License | 用途（Mix Studio 元件） | 風險註記 |
|---|---|---|---|
| city96/ComfyUI-GGUF | Apache-2.0 [已驗證] | gguf | — |
| PozzettiAndrea/ComfyUI-SAM3 | GPL-3.0 [已驗證] | smartmask / scail | — |
| kijai/ComfyUI-KJNodes | GPL-3.0 [已驗證] | regional 等 | `AGENTS.md` 提到本機曾手動修補 `ideogram4_nodes.py`（GPL 修改，私用無義務） |
| PlagueKind/ComfyUI-PlagueKind-Nodes | MIT [已驗證] | — | — |
| nova452/ComfyUI-Conditioning-Rebalance | Apache-2.0 [已驗證] | rebalance | — |
| numz/ComfyUI-SeedVR2_VideoUpscaler | Apache-2.0 [已驗證] | upscale | — |
| ssitu/ComfyUI_UltimateSDUpscale | GPL-3.0 [已驗證] | ultimateupscale | — |
| Comfy-Org/Nvidia_RTX_Nodes_ComfyUI | Apache-2.0 [已驗證] | video4k | 依賴 NVIDIA 二進位（另有 NVIDIA 授權，[待確認]） |
| Kosinkadink/ComfyUI-VideoHelperSuite | GPL-3.0 [已驗證] | vhs | — |
| Lightricks/ComfyUI-LTXVideo | **LTX-2 Community License Agreement**（自訂）[已驗證] | ltxvideo | 年營收 ≥ US$10M 的實體需付費商業授權（LICENSE L87–L91）；含使用限制／AUP（L121、L151–L153）；Codex 需完整閱讀全文並摘錄到 THIRD_PARTY_LICENSES.md |
| Fannovel16/ComfyUI-Frame-Interpolation | MIT [已驗證] | rife | RIFE 模型權重另有授權 [待確認] |
| TenStrip/10S-Comfy-nodes | **無 LICENSE 檔** [已驗證：找不到] | eros（10Eros DMD） | **高風險**：無授權 = 預設保留所有權利，不可假設可修改／分發／商用；私人自用亦建議向作者確認 |
| alisson-anjos/ComfyUI-BFSNodes | GPL-3.0 [已驗證] | bfs（Face ID） | — |
| collbroGTR/comfyui-scail2-infinity | GPL-3.0 [已驗證] | scailinfinity | — |
| CliffNodes/Krea2-Multi-Character-Lora-Node-w-bounding-box-By-Fedor | MIT [已驗證] | regional | — |
| facok/comfyui-krea2-controlnet | **無 LICENSE 檔** [已驗證：找不到] | krea2Control | **高風險**，同 10S |
| PozzettiAndrea/ComfyUI-DepthAnythingV3 | MIT [已驗證] | depthAnything3 | DA3 權重另有授權 [待確認] |
| jieg9341-lab/ComfyUI-Krea2-StyleTransfer | MIT [已驗證] | krea2Style | — |
| lbouaraba/comfyui-krea2edit | Apache-2.0 [已驗證] | krea2edit | — |
| Larryvrh/ComfyUI-MiniMax-H3-Turbo | Apache-2.0 [已驗證] | h3turbo | — |
| NikoDemon80/ComfyUI-H3-Motion-Context | GPL-3.0 [已驗證] | h3context | — |
| WhatDreamsCost/WhatDreamsCost-ComfyUI | GPL-3.0 [已驗證] | （NODE_PACKS 內） | — |

規則：
- Codex 維護 `docs/zh-tw/THIRD_PARTY_LICENSES.md`：每個 node pack 一段（repo、釘死 commit、License、LICENSE 檔複本路徑或連結、安裝日期）。安裝腳本在 clone 後自動把 `LICENSE*` 複製到 `docs/zh-tw/licenses/<folder>/`。
- **無 LICENSE 的 repo**：安裝前在設定頁與安裝報告標示「授權不明」；不得假設可商用；若日後商用，必須取得作者授權或替換。
- GPL-3.0 節點在 ComfyUI 程序內執行，與 GPL-3.0 的 ComfyUI 相容；Mix Studio 只透過 HTTP 呼叫 ComfyUI，不連結這些節點。

## 3. Mix Studio（GPLv3）義務矩陣

| 情境 | 義務 | 本專案對應 |
|---|---|---|
| 私人自用（本專案第一版） | 無 | — |
| 修改但不分發（Fork 私有） | 無（GPLv3 §2：私人修改不需公開） | Fork 可設 private；但若 push 到公開 GitHub 即等同分發（見下） |
| 分發修改版（含公開 Fork、給朋友安裝、賣硬體預裝） | 提供完整對應原始碼（含 `lib/zh/`、`public/simple/`）、保留版權與授權聲明、標示修改與日期（§5(a)）、整體以 GPLv3 授權、不得附加額外限制 | 自訂碼一律以 GPLv3 授權；在 `lib/zh/*.js` 與 `public/simple/*.js` 檔頭加 `// SPDX-License-Identifier: GPL-3.0-or-later` 與 `// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) <owner> 2026` |
| 提供安裝包（zip / 安裝程式 / portable） | 同分發：附原始碼或書面承諾（§6）；安裝包內保留 `LICENSE`、`README.md` 的 Acknowledgments、`public/lottie-web-LICENSE.md` | `scripts/zh/package-release.ps1`（若日後需要）必須把整個 git 樹（含 `.git` 或原始碼壓縮檔）放入 |
| 網路服務（只讓他人透過網路用，不給程式） | GPLv3 無 AGPL 式條款 → 無強制義務 | — |
| 必須保留 | `LICENSE`（GPLv3 全文）、`README.md` §License/§Acknowledgments、`public/lottie-web-LICENSE.md`（lottie-web MIT）、各檔案既有版權標頭 | Codex 禁止刪除（§7） |

## 4. MCWW（AGPLv3）義務矩陣

| 情境 | 義務 | 本專案對應 |
|---|---|---|
| Sidecar 私人自用（只有擁有者自己透過網路使用） | AGPL §13 針對「透過網路互動的使用者」：使用者是擁有者本人 → 實務上無人可主張；仍建議保留原始碼連結 | 設定 › 關於 顯示「自訂工作流由 MCWW 提供（AGPL-3.0）— 原始碼：github.com/light-and-ray/Minimalistic-Comfy-Wrapper-WebUI @ 1f65c75」 |
| 修改 MCWW | 修改版若透過網路提供給任何使用者 → 必須提供**修改版**對應原始碼下載 | 本專案**零修改**（R-02、R-61），義務不觸發 |
| 未來對外提供服務（其他人可登入使用 MCWW） | 必須讓那些使用者能取得所用版本的完整原始碼（未修改則指向上游 commit 即可，但仍要「提供」— 建議在 3301 回應頁腳或 Mix Studio 關於頁放連結） | 已納入設定 › 關於；若日後修改 MCWW，必須公開 Fork |
| Sidecar 與主體的授權邊界 | Mix Studio（GPLv3）與 MCWW（AGPLv3）為**獨立程式**：不同語言、不同程序、僅 HTTP 反向代理（arm's length）；不構成 combined work，Mix Studio 不被 AGPL 覆蓋。若把 MCWW 程式碼複製進 Mix Studio（R-61 禁止）則整體須依 AGPL（GPLv3 §13 允許與 AGPL 結合，結合體受 AGPL §13 約束） | 維持代理架構即可 |
| 必須保留 | MCWW `LICENSE`（AGPLv3 全文）、`Readme.md` 作者資訊；`.env` 與 `storage/` 為使用者資料不屬授權範圍 | — |

## 5. 模型授權登記表（Mix Studio `MODEL_ASSETS` 全清單；模型授權與程式授權分開）

欄位：Model name｜Source｜License｜Commercial use｜Redistribution｜LoRA/derivative｜Adult-content restriction（授權明文）｜Attribution｜Gated｜Token/EULA｜狀態

| 元件群 | Model name（檔案） | Source（HF repo） | License | 商用 | 再分發 | LoRA/衍生 | 成人內容限制（明文） | 署名 | Gated | Token/EULA | 狀態 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| image | krea2_turbo_fp8_scaled | Comfy-Org/Krea-2 | [待確認]（Krea 2 為 2026 年模型，無可靠公開資訊） | 待確認 | 待確認 | 待確認 | 待確認 | 待確認 | 待確認 | 待確認 | **核心模型，WP-10 第一個確認** |
| image | qwen_image_vae | Comfy-Org/Krea-2 | Apache-2.0 [公開資訊：Qwen-Image VAE] | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | 待確認 repack 頁面 |
| image | Huihui-Qwen3-VL-4B-Instruct-abliterated-fp8 | cusiman/Huihui-Qwen3-VL-4B-Instruct-abliterated-comfy | Apache-2.0 [公開資訊：Qwen3-VL 基底]；abliterated 為社群衍生 | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | 衍生版無官方支援 |
| krea2raw | krea2_raw_fp8、krea2_turbo_lora | Comfy-Org/Krea-2 | 同 Krea 2 [待確認] | | | | | | | | |
| krea2depth | depth-control-lora | Patil/Krea-2-depth-controlnet | [待確認]（社群 LoRA，衍生自 Krea 2） | | | | | | | | |
| krea2depth | DA3-LARGE-1.1 model.safetensors | depth-anything/DA3-LARGE-1.1 | [待確認]（Depth Anything 3 各尺寸授權不同，Large 可能為非商用） | 待確認 | | | | | | | **商用高風險** |
| krea2outpaint | krea2_identity_edit_v1_2 | conradlocke/krea2-identity-edit | [待確認] | | | | | | | | |
| klein4 | flux-2-klein-4b-fp8 | black-forest-labs/FLUX.2-klein-4b-fp8 | [待確認]（BFL 模型系列授權依尺寸不同，4B 可能 Apache-2.0；以 HF 模型卡為準） | 待確認 | | | 待確認（BFL 授權含使用限制） | | **可能 gated** | 可能需接受 BFL 條款 | |
| klein4 | qwen_3_4b（text encoder） | Comfy-Org/vae-text-encorder-for-flux-klein-4b | Apache-2.0 [公開資訊：Qwen3] | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | |
| klein4/9 | f2k_*_consist（LoRA） | lrzjason/Consistance_Edit_Lora | [待確認] | | | | | | | | |
| klein4/9 | flux2-vae | Comfy-Org/flux2-dev | [待確認]（FLUX.2 dev 授權） | | | | | | 可能 gated | | |
| klein9 | flux-2-klein-9b-fp8 | black-forest-labs/FLUX.2-klein-9b-fp8 | [待確認]（9B 可能為非商用授權） | **可能不可商用** | | | 待確認 | | 可能 gated | | **商用高風險** |
| klein9 | qwen_3_8b_fp8mixed | Comfy-Org/flux2-klein-9B | Apache-2.0 [公開資訊：Qwen3] | 可 | 可 | 可 | 無 | | 否 | 否 | |
| qwen | qwen_image_edit_2511_bf16 | Comfy-Org/Qwen-Image-Edit_ComfyUI | Apache-2.0 [公開資訊：Qwen-Image 系列] | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | 2511 版以模型卡確認 |
| qwen | qwen_2.5_vl_7b_fp8_scaled | Comfy-Org/Qwen-Image_ComfyUI | Apache-2.0 [公開資訊] | 可 | 可 | 可 | 無 | | 否 | 否 | |
| qwen | Qwen-Image-Edit-2511-Lightning-4steps（LoRA） | art1455/Qwen2511 | [待確認]（Lightning 系列常為 Apache-2.0） | | | | | | | | |
| qwen | multiple-angles LoRA | fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA | [待確認] | | | | | | | | |
| upscale | seedvr2_ema_7b_fp8、ema_vae | AInVFX/SeedVR2_comfyUI、numz/SeedVR2_comfyUI | Apache-2.0 [公開資訊：ByteDance SeedVR2] | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | repack 頁確認 |
| ltx（LTX 2.3） | ltx-2.3-22b-dev-fp8、distilled-lora-384、spatial-upscaler-x2 | Lightricks/LTX-2.3-fp8、Lightricks/LTX-2.3 | **LTX-2 Community License** [已驗證：節點 repo 同名授權；模型頁待確認同一份] | 可，年營收 ≥ US$10M 需付費授權 | 依授權 | 衍生品受同授權 | AUP 需讀全文 [待確認] | 是（授權要求標示） | 待確認 | 接受 LTX-2 Community License | |
| ltx | gemma_3_12B_it_fp4_mixed（text encoder） | Comfy-Org/ltx-2 | **Gemma Terms of Use + Prohibited Use Policy** [公開資訊] | 可（依 Gemma 條款） | 可，須附 Gemma 條款 | 衍生品須附條款 | **Gemma Prohibited Use Policy 明文禁止生成以色情／性滿足為目的的性露骨內容（藝術、教育等目的除外）**[公開資訊；待確認現行版本] | 是 | 官方 google/gemma-3 gated；Comfy-Org repack 待確認 | 接受 Gemma Terms | **與 R-66 目標有授權層張力，需擁有者知悉** |
| ltx | gemma-3-12b-it-abliterated_lora（LoRA） | Comfy-Org/ltx-2、Lightricks/LTX-2.3 | 衍生自 Gemma → Gemma 條款流下 | 同上 | 同上 | 同上 | 同上 | | | | |
| ltx25（LTX 2.5） | ltx-2.5-22b-distilled-transformer-int8、video-vae、audio-vae、latent-spatial-upscaler | Lightricks/LTX-2.5 | LTX-2 Community License [待確認同一份] | 同 LTX 2.3 | | | | 是 | 待確認 | | |
| ltx25 | gemma4-12b-with-proj-ltx-2.5-int8、gemma4_e2b_it_bf16 | Lightricks/LTX-2.5、Comfy-Org/gemma-4 | Gemma Terms（Gemma 4 系列）[待確認] | 同 Gemma | | | 同 Gemma [待確認] | 是 | 待確認 | | |
| ltx25Quality | ltx-2.5-22b-dev-transformer-bf16、gemma4-12b bf16、distilled-lora-450 | Lightricks/LTX-2.5 | 同上 | | | | | | | | 高容量 |
| h3 | minimax_h3_fl2va_pruned_int8、video_vae、audio_vae | Comfy-Org/MiniMax-H3 | [待確認]（MiniMax H3 為 2026 年模型） | 待確認 | | | 待確認 | | | | **核心影片候選，WP-10 確認** |
| h3 | qwen3vl_32b_minimax_h3_nvfp4_awq（text encoder） | Comfy-Org/MiniMax-H3 | Apache-2.0 [公開資訊：Qwen3-VL 基底]；H3 微調版待確認 | | | | | | | | |
| h3Ref / h3Bf16 / h3RefBf16 | minimax_h3_ref2va_*、fl2va_bf16 | Comfy-Org/MiniMax-H3 | 同 H3 | | | | | | | | 高容量 |
| h3RefTurbo | minimax_h3_fl2v_lightx2v_turbo_4step LoRA | Kijai/MiniMax-H3_comfy | [待確認]（lightx2v 衍生） | | | | | | | | |
| h3dyntime | MiniMax-H3-DynTime-sQKV | DmitryDB/MiniMax-H3-DynTime-sQKV | [待確認] | | | | | | | | 實驗性 |
| h3turbo | Minimax-h3-Turbo | lightx2v/Minimax-h3-Turbo | [待確認]（lightx2v 專案多為 Apache-2.0） | | | | | | | | |
| ltxCamera | LTX2.3-22B_IC-LoRA-Cameraman_v2 | Cseti/LTX2.3-22B_IC-LoRA-Cameraman_v2 | 衍生自 LTX-2 → Community License；LoRA 本身 [待確認] | | | | | | | | 研究用途標示 |
| ltxDirector | ltx-2.3-22b-ic-lora-ingredients | Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients | LTX-2 Community License [待確認] | | | | | | | | |
| ltxEdit | edit_anything_v1.1_r256 | Alissonerdx/EditAnything | [待確認] | | | | | | | | |
| faceid | Best_FaceID_v1.0_LoRA、ltx_2.3_22b_distilled_1.1_lora | Alissonerdx/LTX-Best-Face-ID、Comfy-Org/ltx-2.3 | [待確認]；後者 LTX-2 Community | | | | | | | | 人臉功能另涉個資法規（非授權） |
| wan | wan2.2_i2v_high/low_noise_14B_fp8 | Comfy-Org/Wan_2.2_ComfyUI_Repackaged | Apache-2.0 [公開資訊：Wan 2.2] | 可 | 可 | 可 | 無 | 建議 | 否 | 否 | |
| wan | umt5_xxl_fp8、wan_2.1_vae、clip_vision_h | Comfy-Org/Wan_2.1_ComfyUI_repackaged | Apache-2.0 [公開資訊] | 可 | 可 | 可 | 無 | | 否 | 否 | |
| wan | wan2.2_t2v_lightx2v_4steps LoRA（high/low） | lightx2v/Wan2.2-Lightning | [待確認]（多為 Apache-2.0） | | | | | | | | |
| wanAnimate2 | wan_animate_2_int8、lightx2v I2V distill LoRA、umt5、clip_vision_h、Wan2_1_VAE | Comfy-Org/Wan-Animate-2 | [待確認]（Wan-Animate 2 授權；Wan 2.1/2.2 為 Apache-2.0） | | | | | | | | |
| eros | 10Eros_v1.2_fp8mixed、gemma_3_12B_it_heretic_fp8、LTX2.3_DMD LoRA | Tridae/ErosDeployment_ComfyUI | [待確認]；衍生自 LTX 2.3（Community License）與 Gemma 3（Gemma 條款） | 待確認 | 待確認 | | **繼承 Gemma 政策；且節點 repo 無 LICENSE** | | | | **高風險：社群成人向衍生模型，授權鏈不清** |
| scail | wan2.1_14B_SCAIL_2_fp8 | Comfy-Org/SCAIL-2 | [待確認]（衍生自 Wan 2.1 Apache-2.0） | | | | | | | | |
| scail | Wan21_I2V_14B_lightx2v distill LoRA（480P/720P） | lightx2v/Wan2.1-I2V-14B-*-StepDistill-CfgDistill-Lightx2v | [待確認] | | | | | | | | |
| scail | Wan21_PusaV1_LoRA | Kijai/WanVideo_comfy | [待確認] | | | | | | | | |
| scail | sam3.1_multiplex_fp16 | Comfy-Org/sam3.1 | [待確認]（Meta SAM 3 系列採自訂 SAM License，含使用政策） | 待確認 | | | 待確認 | 是 | 官方 gated | 接受 Meta 條款 | |

規則：
- Codex 維護 `docs/zh-tw/MODEL_LICENSES.md`：每個實際下載的檔案一列（上表欄位 + 下載日期 + SHA256 + 模型卡 URL + License 檔複本路徑）。**下載前**先抓模型卡（`https://huggingface.co/<repo>`）的 `license:` metadata 與 LICENSE 檔並存檔；模型卡缺 license → 標「未標示」並視為保留所有權利。
- Gated repo：需 HF Token（`settings.hfToken` 或 `HF_TOKEN`；`data/settings.json` 不進 git，`/api/settings` 不回傳 token 值）；接受 EULA 的動作由擁有者在 HF 網站完成，Codex 不代為接受。
- 「abliterated / heretic」等社群去限制版：授權仍隨基底模型（Gemma 條款、Apache-2.0）；技術上移除拒答不等於授權放寬。
- 成人內容：應用層不封鎖（R-66）；但表中 Gemma 系列文字編碼器（LTX 2.3、LTX 2.5、10Eros 使用）之使用政策由擁有者自行評估；Krea 2、FLUX.2、MiniMax H3、SAM 3 的政策待確認。設定 › 關於 › 授權 頁需列出此表的「成人內容限制」欄。

## 6. 第一版核心模型建議（供 WP-10；待 SuperGrok 02 或擁有者確認）

| 層級 | 元件 | 理由 |
|---|---|---|
| 核心 | `image`（Krea 2 Turbo + Qwen3-VL-4B + VAE） | 文生圖／圖生圖唯一路徑 |
| 核心 | `ltx25`（LTX 2.5 distilled + Gemma 4 + VAE） | 文生影／圖生影皆支援、1–20 秒、含音訊；授權為 Community License（私用無門檻） |
| 可選 | `klein4`、`qwen`（指令編輯）、`upscale`（SeedVR2）、`rife` | 圖生圖進階、品質模式 |
| 可選 | `video`（LTX 2.3）、`h3`（MiniMax H3） | 備用影片引擎；H3 授權待確認 |
| 高容量／暫緩 | `ltx25quality`、`h3Bf16`、`klein9`、`wan`、`wananimate2`、`scail`、`scailinfinity`、`eros` | 容量大或授權風險高（eros、klein9、DA3-Large） |

## 7. Codex 禁止刪除／修改

- `LICENSE`（Mix Studio GPLv3）、MCWW `LICENSE`（AGPLv3）、ComfyUI `LICENSE`、各 custom node 的 `LICENSE*`。
- `NOTICE` 檔（若存在，例如 Gradio、Apache 系列節點）。
- 所有檔案既有的版權標頭與 `README.md` 的 Acknowledgments / Attribution 段。
- `public/lottie-web-LICENSE.md`。
- `docs/zh-tw/THIRD_PARTY_LICENSES.md`、`docs/zh-tw/MODEL_LICENSES.md`、`docs/zh-tw/licenses/`（第三方授權記錄與模型來源／授權記錄）。
- 模型檔案旁的 `*.license.txt` / 模型卡複本（WP-10 產出）。
- 新增檔案必須加 SPDX 標頭（§3）；不得把第三方程式碼以「重寫」名義去除來源標示。

## 8. 交付前檢查（對應 10 號 C-08）

- [ ] `find . -iname 'LICENSE*' -o -iname 'NOTICE*'` 清單與安裝前一致（腳本 `scripts/zh/verify-licenses.ps1` 比對 hash）
- [ ] `docs/zh-tw/THIRD_PARTY_LICENSES.md` 涵蓋 `NODE_PACKS` 全部 22 個 repo，兩個「無 LICENSE」有風險標示
- [ ] `docs/zh-tw/MODEL_LICENSES.md` 涵蓋實際下載的每個檔案，「待確認」項目已由 Codex 填入模型卡實際值或明確標「未標示」
- [ ] 設定 › 關於 顯示：Mix Studio GPLv3、MCWW AGPLv3 + 原始碼連結、模型授權摘要
- [ ] 自訂碼檔頭 SPDX 標頭齊全

## 9. 聲明

- 未來若商業發布（含收費服務、預裝硬體、對外開放帳號），需再做正式法律審查，特別是：LTX-2 Community License 的營收門檻、FLUX.2 / Krea 2 / MiniMax H3 / SAM 3 的商用條款、Gemma 使用政策、以及兩個無授權的 custom node。
- 此文件是工程合規規格，不取代法律意見。
