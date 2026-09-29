# 운영 배포 절차 (무료 구성)

운영은 Lovable **무료 플랜**의 Lovable Cloud를 그대로 씁니다. 구독 없이도 아래가 무료입니다.

| 역할 | 서비스 | 무료 한도 |
| --- | --- | --- |
| DB, 로그인, 엣지 함수 | Lovable Cloud (Supabase `wdkqzqcmqblzqglwjyqv`) | Cloud 사용량 월 $25 |
| 웹 호스팅 | `native-speak-steps.lovable.app` | 게시는 무료 플랜에서도 됩니다 |
| AI | Lovable AI 게이트웨이 | 월 $1 |
| AI (선택) | Gemini API 무료 등급 | 모델별 하루 요청 수 제한 |
| 코드 수정 요청 | Lovable 에이전트 | 하루 5크레딧 (월 30) |

AI 무료 사용량 월 $1을 다 쓰면 AI 기능이 "AI 크레딧이 부족합니다"로 멈춥니다. 그때는 **나중에**의 Gemini 항목을 진행합니다.

순서는 반드시 **마이그레이션 → 엣지 함수 → 프런트엔드**입니다.

- 새 엣지 함수는 새 테이블과 함수(`consume_ai_quota`, `profiles.pro_until`)를 읽습니다.
- 새 프런트엔드는 새 DB 함수(`record_activity` 등)를 부릅니다.
- 마이그레이션부터 게시까지는 옛 화면이 새 DB와 만납니다. 그동안 가져오기와 XP 저장이 실패할 수 있으니 한 번에 이어서 진행합니다.

## 1. 마이그레이션 (Claude가 Lovable MCP로 진행)

`query_database`로 `20260928160000_…`부터 `20260929220000_…`까지 13개 파일을 파일명 순서대로 적용합니다. 이 도구는 크레딧을 쓰지 않습니다.

각 파일은 아래 틀에 넣어 한 문장으로 보냅니다.

```sql
do $wrap$
declare sql text := $mig$<파일 내용 그대로>$mig$;
begin
  execute sql;
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('<버전>', '<이름>', array[sql]);
end $wrap$;
```

- 한 블록이라 전부 적용되거나 전부 취소됩니다.
- 응답이 499나 시간 초과로 끊겨도 적용됐을 수 있습니다. 아래 쿼리로 확인하고, 없는 버전만 다시 보냅니다.
- `md5`는 로컬 파일의 `md5sum`과 같아야 합니다. 보낸 내용이 파일과 한 글자도 다르지 않다는 확인입니다.

```sql
select version, md5(statements[1]) from supabase_migrations.schema_migrations
where version >= '20260928' order by version;
```

적용 전에 아래 **사전 점검 SQL**을, 적용 후에 **확인 SQL**을 실행합니다.

## 2. 엣지 함수와 프런트엔드

1. PR을 머지합니다. Lovable이 GitHub `main`을 가져옵니다.
2. Lovable 채팅에 아래를 보냅니다. 무료 일일 크레딧을 씁니다.

   ```text
   코드는 수정하지 마. supabase/functions의 엣지 함수 11개(analyze-text, chat, chat-feedback,
   confirm-payment, create-order, delete-account, generate-cards, send-reminders, speaking,
   speaking-feedback, split-dialogue)를 지금 코드 그대로 배포하고, 폴더가 없어진 함수
   (generate-examples, generate-pet-image, personalized-recommendations, pet-diary,
   sync-gap-analysis, weekly-report)는 삭제해줘.
   ```

3. Claude가 Lovable MCP `deploy_project`로 게시합니다. 또는 Lovable에서 **Publish → Update**를 누릅니다.
4. 휴대폰에서 확인합니다.
   1. 로그인해서 대시보드가 뜨는지 봅니다.
   2. 카드를 하나 복습합니다.
   3. 채팅을 한 번 보냅니다.
   4. 프로필에 "무료 플랜"이 보이는지 봅니다.
   5. `/upgrade`에서 요금제 표가 보이는지 봅니다.

## 사전 점검 SQL (읽기 전용)

```sql
select (select count(*) from supabase_migrations.schema_migrations) as applied_migrations, -- 12
  to_regclass('public.activity_events') as activity_events,                               -- null
  to_regclass('public.payments') as payments,                                             -- null
  to_regclass('backup.srs_cards_removed_prd1') as card_backup,                            -- null
  (select count(*) filter (where context in ('빈도 기반 단어 학습', '문장 구조 학습')
     and target_text in ('[' || native_text || ']', native_text)) from public.srs_cards) as placeholder_cards,
  (select count(*) - count(distinct (user_id, native_text)) from public.srs_cards) as duplicate_cards,
  (select count(*) from public.language_imports where content is not null) as imports_with_raw_text,
  (select count(*) from pg_stat_activity where state = 'active' and pid <> pg_backend_pid()) as active_sessions;
```

## 확인 SQL

```sql
-- 새 테이블 7개가 있어야 합니다.
select count(*) as new_tables from pg_tables where schemaname = 'public' and tablename in
  ('activity_events', 'ai_usage_daily', 'ai_usage_log', 'client_errors', 'analytics_events', 'push_subscriptions', 'payments');

-- 서버 함수 6개가 있어야 합니다.
select string_agg(proname, ', ' order by proname) as functions from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('record_activity', 'consume_ai_quota', 'complete_payment', 'create_order', 'claim_due_reminders', 'is_valid_timezone');

-- 행 단위 보안이 꺼진 public 테이블. 0행이어야 합니다.
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;

-- 옮겨 둔 카드 수. 사전 점검의 placeholder_cards와 duplicate_cards를 더한 값과 같아야 합니다.
select count(*) as backed_up_cards from backup.srs_cards_removed_prd1;

-- 알림 예약. pg_cron이 있으면 1행이 나옵니다.
select jobname, schedule from cron.job where jobname = 'send-reminders';
```

## 나중에 (필요할 때)

- **Gemini 무료 등급으로 AI 옮기기:** aistudio.google.com/apikey 에서 키를 만듭니다. 결제 정보는 넣지 않습니다. Lovable 프로젝트의 Cloud → Secrets에 `GEMINI_API_KEY`로 넣습니다. 그러면 엣지 함수가 게이트웨이 대신 Google을 직접 부릅니다. 무료 등급에서는 Google이 입력 내용을 서비스 개선에 쓸 수 있으며, 개인정보처리방침에 적어 두었습니다.
- **문의 이메일:** `VITE_SUPPORT_EMAIL`을 `.env`에 넣고 다시 게시합니다. 비어 있으면 개인정보처리방침과 약관에 "(문의 이메일 미설정)"으로 나옵니다.
- **학습 알림:** docs/reminders.md 절차대로 설정합니다.
- **결제:** docs/monetization.md 절차대로 설정합니다.
- **카드 백업 정리:** 2026-10-29 이후에도 카드를 되돌려 달라는 요청이 없으면 `drop schema backup cascade;`를 실행합니다.

## 문제가 생기면

- **프런트엔드:** Lovable의 버전 기록에서 이전 버전을 다시 게시합니다.
- **엣지 함수:** main의 이전 커밋에서 해당 함수를 다시 배포합니다.
- **마이그레이션:** 자동으로 되돌리는 스크립트는 없습니다.
  - 삭제된 카드는 `backup.srs_cards_removed_prd1`에서 `insert into public.srs_cards select * from backup.srs_cards_removed_prd1 where …`로 되살립니다.
  - 가져오기 원문(`language_imports.content`)은 개인정보 보호 목적으로 지운 것이라 복구하지 않습니다.
