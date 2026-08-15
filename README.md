# Elevator Waiting Simulator

日本のオフィス／マンションにあるエレベーターホールで、ただ到着を待つだけの静的Webシミュレーターです。ゲームらしいスコアや説明画面を排除し、階数表示の間、進行方向と呼び方向の関係、途中階での乗降停止、扉の速度、金属や壁の質感に重点を置いています。

公開版: https://woollest.github.io/elevator-simulator/

[![Control system quality gate](https://github.com/Woollest/elevator-simulator/actions/workflows/quality.yml/badge.svg)](https://github.com/Woollest/elevator-simulator/actions/workflows/quality.yml)

## 体験できること

- エレベーターは呼び出しがなくても1階から20階まで自動運転します
- 移動中はランダムな階で乗客の乗降を想定した停止が発生します
- 12階には上り／下りの独立した呼びボタンがあります
- 両方の呼び出しを同時に登録できます
- 進行方向と呼び方向が一致しなければ12階を通過します
- 端の階で折り返し、方向が一致した時点で12階に停車します
- 到着音は音声ファイルではなくWeb Audio APIで生成します
- 最初のボタン操作後、空調音と蛍光灯由来の低い電気音が常時流れます
- モーター音は12階との距離に応じて音量と周波数が変化します
- 他階での到着音と扉音はローパス処理され、壁越しの遠い音として左右から聞こえます
- 呼びボタンを連打すると、設備側から控えめな注意表示が出ます
- 見えないNPCが足音と衣擦れを伴って近づき、上下いずれかの呼び出しを追加します
- 咳や衣擦れだけが聞こえる場合もあり、人物そのものは一切表示しません
- 混雑した途中階では複数人の乗降を想定して停止時間が大幅に延びます
- 12階では乗客待ち、閉まりかけのセンサー反応、扉の再開放がランダムに発生します
- 左右の扉にはわずかな速度差があり、完全閉鎖後には機械式ロック音が鳴ります
- `prefers-reduced-motion` が有効な環境では扉アニメーションを短縮します

## 技術構成

詳細な境界、制御不変条件、検証方針は [`ARCHITECTURE.md`](ARCHITECTURE.md) に記録しています。Rust/Wasm採用の判断経緯は [`docs/adr/0001-rust-wasm-control-core.md`](docs/adr/0001-rust-wasm-control-core.md) にあります。

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

### Web Audio API

音声素材は使用していません。空調はフィルター処理したノイズ、蛍光灯は100Hzの微かなハム音、モーターは基音と倍音のオシレーターで合成しています。途中階の到着音と扉音には距離減衰、ローパスフィルター、ステレオ定位を適用しています。ブラウザの自動再生制限に従い、環境音は最初に呼びボタンを操作した後から始まります。

## ファイル構成

```text
.
├── .github/workflows/ # 自動品質ゲート
├── docs/adr/          # Architecture Decision Records
├── scripts/           # 再現可能なWasmビルド
├── tests/             # 配信WasmのABI・決定表テスト
├── ARCHITECTURE.md    # 実行境界と制御不変条件
├── Cargo.toml         # Rustクレート定義と最適化設定
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

Rustと `wasm32-unknown-unknown` ターゲットが必要です。Windowsでは次を実行します。

```sh
npm run build:wasm
```

macOS／Linuxでは `sh scripts/build-wasm.sh` を使用します。標準ライブラリを使わない小さなコアなので、生成されるWasmは169バイトです。ビルドスクリプトとテストは4KiBの上限を強制します。

## 品質ゲート

```sh
npm test
```

この1コマンドでJavaScript構文確認、Rust単体テスト、配信Wasmの全8状態決定表、エクスポートABI、バイナリサイズを検証します。Rustは `rust-toolchain.toml` により1.96.1へ固定されています。GitHub Actionsでも同じコンパイラを使ってWasmをゼロから再生成し、コミット済みバイナリと完全一致することを確認します。

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
