# Elevator Waiting Simulator

日本のオフィス／マンションにあるエレベーターホールで、ただ到着を待つだけの静的Webシミュレーターです。ゲームらしいスコアや説明画面を排除し、階数表示の間、進行方向と呼び方向の関係、途中階での乗降停止、扉の速度、金属や壁の質感に重点を置いています。

公開版: https://woollest.github.io/elevator-simulator/

## 体験できること

- エレベーターは呼び出しがなくても1階から20階まで自動運転します
- 移動中はランダムな階で乗客の乗降を想定した停止が発生します
- 12階には上り／下りの独立した呼びボタンがあります
- 両方の呼び出しを同時に登録できます
- 進行方向と呼び方向が一致しなければ12階を通過します
- 端の階で折り返し、方向が一致した時点で12階に停車します
- 到着音は音声ファイルではなくWeb Audio APIで生成します
- 呼びボタンを連打すると、設備側から控えめな注意表示が出ます
- `prefers-reduced-motion` が有効な環境では扉アニメーションを短縮します

## 技術構成

### React

画面描画、呼び出し状態、階数、進行方向、扉、注意表示をReact 19で管理しています。ビルド工程を不要にするため、React・React DOM・htmはES Modulesとして読み込みます。

### Rust / WebAssembly

進行方向と上下の呼び出し状態から「12階に停車すべきか」を判断する制御コアはRustで実装し、`wasm32-unknown-unknown` 向けWebAssemblyとして配信しています。

WebAssemblyが読み込めなかった場合も、同じ判断を行うJavaScriptのフォールバックが動作します。

### CSS

画像素材を使わず、次の質感をCSSで構成しています。

- ステンレス扉のヘアラインと反射ムラ
- 石調の壁面とパネル目地
- 天井照明、ダウンライト、周辺減光
- 床タイル、巾木、扉の床面反射
- 黒ガラスの階数インジケーター
- 金属製呼び出しパネル、固定ネジ、押し込み表現
- 階数プレート、館内スピーカー、監視カメラ

## ファイル構成

```text
.
├── index.html          # GitHub Pagesの入口
├── style.css           # ホール全体の外観とレスポンシブ表示
├── script.js           # React UI、運転状態、音声、アニメーション
├── elevator_core.rs    # Rust製の停止判断ロジック
└── elevator_core.wasm  # ブラウザが実行するコンパイル済みWasm
```

## ローカルで確認する

ES ModulesとWebAssemblyを使用しているため、`index.html` を直接開くのではなくHTTPサーバー経由で確認してください。

例:

```sh
python -m http.server 8000
```

その後、`http://localhost:8000/` を開きます。

## Rustコアを再ビルドする

Rustと `wasm32-unknown-unknown` ターゲットが必要です。

```sh
rustup target add wasm32-unknown-unknown
rustc --target wasm32-unknown-unknown \
  --crate-type cdylib \
  -C opt-level=z \
  -C panic=abort \
  -C strip=symbols \
  elevator_core.rs \
  -o elevator_core.wasm
```

標準ライブラリを使わない小さなコアなので、生成されるWasmは非常に軽量です。

## GitHub Pagesで公開する

1. ファイル一式をリポジトリの `main` ブランチへ置きます
2. GitHubの **Settings → Pages** を開きます
3. **Deploy from a branch** を選びます
4. `main` と `/ (root)` を指定して保存します

追加のビルドワークフローやサーバー処理は不要です。

## 調整ポイント

主要な数値は `script.js` 冒頭と `runController()` 内にあります。

- `HALL_FLOOR`: ユーザーが待つ階
- `MIN_FLOOR` / `MAX_FLOOR`: 建物の階数範囲
- 階移動の待ち時間: `sleep(1350 + Math.random() * 750)`
- 途中停止率: `Math.random() < .38`
- 途中階の乗降時間: `2700 + Math.random() * 3000`
- 12階での扉開放時間: `4200`

## 対応環境

WebAssembly、ES Modules、Web Audio APIを利用できる現行のChrome、Edge、Firefox、Safariを対象としています。画面はデスクトップ、横長画面、スマートフォン向けに調整しています。
