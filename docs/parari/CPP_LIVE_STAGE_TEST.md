# CPP LIVE STAGE 少人数テスト

2026-10-14 JST更新。対象ブランチ `feat/cpp-live-stage-media`。依存順は #134 → #135 → この変更。

## 現在の到達点

STAGE専用Daily通信をカスタム画面へ移行。司会＋6人のパネル、1人の講演への切替、独立した質問者1人、司会の映像表示切替を実装。参加者は自分のカメラをONにできる。マイクは司会・現在発言を許可された登壇者・質問者のみ。

パネルはPCで7枠。質問者はその下のギャラリー左端に赤枠とラベルで固定する。ギャラリーはPCで最大49人（7×7）、幅640〜1023pxは12人、640px未満は6人。質問者は1枠を使い、ページ切替でも固定する。登壇枠はギャラリーの49人とは別枠。ページ外の映像を購読せず、発言者の音声はページに依存せず受信する。ギャラリーは低い受信レイヤー、講演者の拡大映像は高いレイヤーを要求する。

10/14にユーザーが同じMac・別アカウントで通信と画面共有の成功を報告。ただしこれは旧Prebuilt画面での確認であり、新しいカスタム画面は改めて実機確認が必要。
自動テストは模擬Daily応答と隔離DBを使用する。実端末の媒体取得、Dailyのban適用・再入室拒否、長時間接続、100人規模は未確認。
**Previewのビルド成功だけでは実機テスト準備完了ではない。下記の環境確認が必要。**

## 検証環境の準備

1. Vercelの対象は `kanae-muraisos-projects / gtp-parari`、このブランチのPreview。Productionを対象にしない。
2. 既存CPPスキーマと検証用のSupabase Auth・CPP登録者を持つ隔離DBを用意する。テスト用SQL fixtureは実ユーザー用環境へ適用しない。
3. 既存スキーマの上に、次の順でmigrationを適用し、Supabase advisorsとRPC権限を確認する。
   - `20261013055737_cpp_live_event_progression.sql`
   - `20261013063642_cpp_live_control_ui.sql`
   - `20261013072254_cpp_live_stage_media.sql`
   - `20261014040755_cpp_live_stage_gallery.sql`
4. PreviewのSupabase URL・anon key・service role keyを同じ検証DBへ向ける。値はVercelの環境設定で扱い、チャット・PR・ログに貼らない。
5. 当該ブランチのPreviewだけに `CPP_DAILY_STAGE_ENABLED=true` とサーバー用 `DAILY_API_KEY` を設定する。PRIVATE TALKも試す場合は既存の `CPP_DAILY_AUDIO_TEST_ENABLED=true` を設定する。再ビルド後、`GET /api/parari/live/cpp/stage` が `enabled:true` を返すことを確認する。
6. 管理者と通常参加者、できれば講演者を加えた3アカウントを用意。管理者が「CPP LIVE開催管理」→「STAGE・LOUNGEの進行確認」で開発用イベントを作る。短い試験では通常CPP形式、交流時間20分、開会項目各1分、クロージング1分に設定できる。全員が同じ会場URLを開く。

隔離DBは `gtp (cpp-live-stage-test)` / `odrpsdmsaeunofjyjdfw`。既存の司会・参加者テストアカウントを利用する。本番DBへの適用やmainのマージはこの検証に含めない。

## 最初の実機確認（2〜3端末）

| 操作 | 確認する結果 |
| --- | --- |
| 司会者が「オープニングを始める」→確認→実行 | 全員が同じSTAGEとプログラムを表示 |
| 全員が「STAGEに接続する」 | 全員のマイク・カメラがOFF。参加者は自分でカメラだけONにでき、マイクは許可まで操作できない |
| 司会者が「マイクをON」「カメラをON」 | 他の端末で司会者の声と顔を確認。聞こえない場合は「音声を再生する」を試す |
| 司会者または許可された講演者が画面共有 | 他端末で共有画面が見え、共有停止で元に戻る |
| 参加者が「質問を希望する」 | 映像タイルと挙手一覧に表示。別ページの挙手も一覧に残る |
| 司会者が参加者を選び「質問を許可」 | 質問者は接続し直してから、自分でマイク・カメラをON。顔と声が全員に届く。質問者に進行操作・他人の媒体操作・画面共有の権限はない |
| 司会者が「質問を終了」 | 質問者の音声が止まる。再接続すると通常参加者に戻り、カメラのみ自分でONにできる |
| 司会者が別の参加者に「質問を許可」 | 質問者が交代。赤枠は下段左端に固定し、上段の登壇7枠を増やさない |
| 「パネルに追加」で6人を選ぶ | 司会＋6人。7人目の追加を拒否し、質問枠は独立 |
| 登壇者を選び「この人の講演に切り替え」 | その人を大きく表示。司会・講演者・質問者が発言可能。他のパネル登壇者の旧接続を停止する |
| 「パネルに戻す」 | 名簿を保持し、6人の発言を再許可。対象者は再接続後に自分でマイクON |
| 「司会の映像枠を隠す」→表示 | 司会のカメラがOFFになり映像を隠す。マイクと進行操作は継続。再表示してもカメラは自動ONにならない |
| 司会者が一時切断→再接続 | イベントは進まず、同じプログラムを復元。マイク・カメラはOFFから再開 |
| 管理者が司会を引き継ぐ | 古い接続を停止。全員が再接続。元の司会へ再び戻しても新しい部屋で接続できる |
| 「自由交流を始める」 | STAGE接続解除が成功した後にLOUNGEへ。待機だけではDaily接続を作らない |
| 2人でPRIVATE TALK→退出・振り返り | 既存の会話・カメラ操作・チャット・非公開メモが動く |
| 受付停止→クロージング | 新規申し込み・承諾が止まり、元の通話有効期限まで待ってからSTAGEへ。未保存メモを保持 |

## 公開前に必須の追加確認

- 取得済みの古い登壇トークンで、降壇直後・全員退出後・再入室後に送信を再開できないこと。検証中のトークンも共有・ログ保存しない。
- 入室用トークンは60秒で失効するが、接続中の配信は部屋の終了期限まで継続する。トークンのeject設定は送らず、部屋の `eject_at_room_exp` を継承する。少なくとも60秒超の接続と、短い専用イベントの終了時刻で実際の切断を確認する。
- Daily/APIが失敗した状態では降壇・進行の完了扱いにならず、「接続権限の切替を再試行」で退役処理を完了できること。DBの直接RPCでも未解除のSTAGEを飛び越えて進行できないこと。
- メディア拒否時の音声のみ参加、Safari/iPhoneの音声再生、画面共有停止、画面ロック、回線変更、途中入室。
- 最初の少人数確認後、2時間以上のSTAGE連続配信、段階的な人数増加、100人規模で帯域・端末負荷・参加ログを確認。120人のroom設定値は容量実証ではない。

## 利用記録

`cpp_live_stage_rooms` はDaily部屋→イベント→主催アカウント→支払アカウントの対応を保持する。
`cpp_live_stage_tickets` は参加者と、Dailyに渡す使い捨ての接続ID・権限を保持する。これは入室許可であり、利用分数ではない。

Dailyの `participant.joined` / `participant.left` を署名付きWebhookで受け、`cpp_live_stage_usage_events` に開始時刻・実参加秒数・セッションIDを保存する。氏名・映像・音声・メモは記録しない。`event id` と `部屋＋session id＋type` で二重取り込みを防ぎ、退出通知が先に届いても保存できる。請求額は算出しない。

Webhook設定手順：

1. 32バイト以上のランダムな秘密値をbase64化し、サーバー環境変数 `DAILY_STAGE_WEBHOOK_HMAC` とDailyのWebhook `hmac` に同じ値を設定する。Daily APIキーとは別の値を使う。
2. 宛先は検証デプロイの `/api/parari/live/cpp/stage/webhook`。イベントは上記2種、`retryType: exponential`。Dailyが届く公開エンドポイントであることを確認する。PreviewのDeployment Protectionを回避する設定を無断で変更しない。
3. 作成時の署名付きテスト通知が200になることを確認。実参加→退出後にDBの記録とDaily参加履歴を照合する。
4. 再送・順序逆転・再接続を確認。未保存時は503を返す。Webhook配送は有限回の再試行なので、欠損補完・Daily履歴との定期照合・映像/音声料金分類は請求実装前に別途必要。Webhookが未設定なら実参加時間は保存されない。

## 自動確認

`npm run test:cpp-live-stage`、`npm run test:cpp-live-ui`、`npm run test:cpp-live-progression`、型・ルート・リポジトリ検査、ビルド。
GitHub CIのPostgreSQL 17では、STAGE入室と閉鎖の両順序、同じversionでの質問者切替の競合を含む実接続の排他制御も検証する。ローカルPGliteはこの同時接続ケースをスキップする。

## 参照した公式仕様

- https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
- https://docs.daily.co/reference/rest-api/rooms/create-room
- https://docs.daily.co/reference/rest-api/rooms/session/eject
- https://docs.daily.co/docs/guides/privacy-and-security/meeting-tokens
- https://docs.daily.co/reference/rest-api/webhooks/index
- https://docs.daily.co/reference/rest-api/webhooks/events/participant-left
- https://docs.daily.co/docs/guides/scaling-calls/large-real-time-calls

## 新しい画面の確認範囲

SDKは `@daily-co/daily-js@0.93.0` に固定し、接続ボタンを押した時だけ読み込む。退出・アカウント変更・権限変更・状態取得失敗時にローカルトラックを停止し、SDKの破棄完了を待って再接続する。新しい参加IDの発行はDaily側の古いIDのban確認後に限る。登壇権限の変化は自動再接続やマイクONを行わない。

自動テストの49人は合成名簿・模擬SDKでの表示と購読確認であり、49本の実映像の性能検証ではない。背景ぼかし・背景選択はこの変更に含めない。
