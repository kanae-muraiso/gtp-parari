# CPP LIVE STAGE 少人数テスト

2026-10-13 JST。対象ブランチ `feat/cpp-live-stage-media`。依存順は #134 → #135 → この変更。

## 現在の到達点

STAGE専用Daily通信、司会者・講演者・質問者・視聴者の権限、画面共有、挙手、接続解除、利用記録の受信を実装。
自動テストは模擬Daily応答と隔離DBを使用する。実端末の媒体取得、Dailyのban適用・再入室拒否、長時間接続、100人規模は未確認。
**Previewのビルド成功だけでは実機テスト準備完了ではない。下記の環境確認が必要。**

## 検証環境の準備

1. Vercelの対象は `kanae-muraisos-projects / gtp-parari`、このブランチのPreview。Productionを対象にしない。
2. 既存CPPスキーマと検証用のSupabase Auth・CPP登録者を持つ隔離DBを用意する。テスト用SQL fixtureは実ユーザー用環境へ適用しない。
3. 既存スキーマの上に、次の順でmigrationを適用し、Supabase advisorsとRPC権限を確認する。
   - `20261013055737_cpp_live_event_progression.sql`
   - `20261013063642_cpp_live_control_ui.sql`
   - `20261013072254_cpp_live_stage_media.sql`
4. PreviewのSupabase URL・anon key・service role keyを同じ検証DBへ向ける。値はVercelの環境設定で扱い、チャット・PR・ログに貼らない。
5. 当該ブランチのPreviewだけに `CPP_DAILY_STAGE_ENABLED=true` とサーバー用 `DAILY_API_KEY` を設定する。PRIVATE TALKも試す場合は既存の `CPP_DAILY_AUDIO_TEST_ENABLED=true` を設定する。再ビルド後、`GET /api/parari/live/cpp/stage` が `enabled:true` を返すことを確認する。
6. 管理者と通常参加者、できれば講演者を加えた3アカウントを用意。管理者が「CPP LIVE開催管理」→「STAGE・LOUNGEの進行確認」で開発用イベントを作る。短い試験では通常CPP形式、交流時間20分、開会項目各1分、クロージング1分に設定できる。全員が同じ会場URLを開く。

2026-10-13の環境確認では、Vercel連携は対象チームへの読取で403となり、CLI認証も利用できなかった。Supabaseの既存開発ブランチは0件。したがって、この変更作成時点では上記の接続先切替・migration適用・配信有効化は未実施。本番DBは変更していない。新規Supabaseブランチを使用する場合は利用料と組織を確認してから作成する。

## 最初の実機確認（2〜3端末）

| 操作 | 確認する結果 |
| --- | --- |
| 司会者が「オープニングを始める」→確認→実行 | 全員が同じSTAGEとプログラムを表示 |
| 全員が「STAGEに接続する」 | 全員のマイク・カメラがOFF。視聴者は送信できない |
| 司会者が映像内のマイク・カメラを自分でON | 他の端末で司会者の声と顔を確認。聞こえない場合は映像内の再生操作を試す |
| 司会者または許可された講演者が画面共有 | 他端末で共有画面が見え、共有停止で元に戻る |
| 参加者が「質問を希望する」 | 司会者の登壇者一覧に挙手を表示 |
| 司会者が参加者を選び「質問を許可」 | 質問者は接続し直してから、自分でマイク・カメラをON。顔と声が全員に届く。質問者に進行操作・他人の媒体操作・画面共有の権限はない |
| 司会者が「登壇を終了」 | 質問者の送信が止まる。再接続すると視聴者に戻る |
| 司会者が一時切断→再接続 | イベントは進まず、同じプログラムを復元。マイク・カメラはOFFから再開 |
| 管理者が司会を引き継ぐ | 古い接続を停止。全員が再接続。元の司会へ再び戻しても新しい部屋で接続できる |
| 「自由交流を始める」 | STAGE接続解除が成功した後にLOUNGEへ。待機だけではDaily接続を作らない |
| 2人でPRIVATE TALK→退出・振り返り | 既存の会話・カメラ操作・チャット・非公開メモが動く |
| 受付停止→クロージング | 新規申し込み・承諾が止まり、元の通話有効期限まで待ってからSTAGEへ。未保存メモを保持 |

## 公開前に必須の追加確認

- 取得済みの古い登壇トークンで、降壇直後・全員退出後・再入室後に送信を再開できないこと。検証中のトークンも共有・ログ保存しない。
- 入室用トークンは60秒で失効するが、接続中の配信は部屋の終了期限まで継続する。トークンのeject設定は送らず、部屋の `eject_at_room_exp` を継承する。少なくとも60秒超の接続と、短い専用イベントの終了時刻で実際の切断を確認する。
- Daily/APIが失敗した状態では降壇・進行の完了扱いにならず、同じ操作を再試行できること。DBの直接RPCでも未解除のSTAGEを飛び越えて進行できないこと。
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
GitHub CIのPostgreSQL 17では、STAGE入室と閉鎖の両順序を含む実接続の排他制御も検証する。ローカルPGliteはこの同時接続ケースをスキップする。

## 参照した公式仕様

- https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
- https://docs.daily.co/reference/rest-api/rooms/create-room
- https://docs.daily.co/reference/rest-api/rooms/session/eject
- https://docs.daily.co/docs/guides/privacy-and-security/meeting-tokens
- https://docs.daily.co/reference/rest-api/webhooks/index
- https://docs.daily.co/reference/rest-api/webhooks/events/participant-left
- https://docs.daily.co/docs/guides/scaling-calls/large-real-time-calls
