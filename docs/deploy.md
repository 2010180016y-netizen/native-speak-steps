# 운영 배포 절차 (PR #1)

운영 프로젝트: Supabase `wdkqzqcmqblzqglwjyqv`, 프런트엔드 `native-speak-steps.lovable.app`.

순서는 반드시 **마이그레이션 → 엣지 함수 → 프런트엔드**입니다.

- 새 엣지 함수는 새 테이블과 함수(`consume_ai_quota`, `profiles.pro_until`)를 읽습니다. 마이그레이션 전에 올라가면 AI 기능이 전부 실패합니다.
- 새 프런트엔드는 새 DB 함수(`record_activity` 등)를 부릅니다.
- 마이그레이션부터 프런트엔드 게시까지 몇 분 동안은 옛 화면이 새 DB와 만납니다. 그동안 가져오기와 XP 저장이 실패할 수 있으니 세 단계를 한 번에 이어서 진행합니다.

## 0. 어느 경로인지 확인

- Lovable 프로젝트 화면에 **Cloud** 탭이 있으면 Lovable Cloud입니다. **경로 B**로 진행합니다.
- supabase.com/dashboard에서 `wdkqzqcmqblzqglwjyqv` 프로젝트가 보이면 **경로 A**로 진행합니다.

## 경로 A: Supabase 계정이 있을 때 (Claude가 진행)

1. claude.ai/customize/connectors 에서 Supabase 연결을 이 프로젝트가 있는 계정과 조직으로 다시 연결합니다.
2. 새 세션을 열고 이렇게 요청합니다. "PR #1 브랜치 `claude/awesome-sagan-b3oed0`의 docs/deploy.md 경로 A대로 운영 배포해줘"

Claude가 진행하는 절차:

1. `get_project`로 프로젝트가 활성 상태인지 확인하고, 아래 **사전 점검 SQL**을 `execute_sql`로 실행해 결과를 보고합니다.
2. `supabase/migrations`에서 `20260928160000_…`부터 `20260929220000_…`까지 13개 파일을 파일명 순서대로 `apply_migration`으로 적용합니다.
   - 내용은 그대로 적용하고, `name`은 파일명에서 확장자를 뺀 것입니다.
   - 하나라도 실패하면 멈추고 보고합니다.
3. `deploy_edge_function`으로 함수 11개를 배포합니다.
   - 대상: analyze-text, chat, chat-feedback, confirm-payment, create-order, delete-account, generate-cards, send-reminders, speaking, speaking-feedback, split-dialogue
   - 각 함수에 `_shared/ai.ts`를 함께 올립니다.
   - `verify_jwt`는 `supabase/config.toml`을 따릅니다. 목록에 없는 함수는 `true`입니다.
4. 아래 **확인 SQL**을 실행합니다.
5. PR #1을 머지합니다. 그다음 사용자가 Lovable에서 **Publish → Update**를 누릅니다.
6. 옛 함수 6개는 MCP로 지울 수 없습니다. 대시보드의 Edge Functions에서 삭제하도록 안내합니다: generate-examples, generate-pet-image, personalized-recommendations, pet-diary, sync-gap-analysis, weekly-report.

MCP로 적용하면 `supabase_migrations.schema_migrations`의 버전이 파일명과 달라집니다. 나중에 CLI의 `supabase db push`를 쓰려면 먼저 `supabase migration repair`로 맞춥니다.

## 경로 B: Lovable Cloud일 때 (Lovable에서 진행)

1. PR #1을 머지합니다. 바로 다음 단계로 넘어갑니다.
2. Lovable 채팅에 아래를 그대로 붙여 넣고, 나오는 적용 요청을 모두 승인합니다.

   ```text
   GitHub에서 병합된 변경을 운영에 반영해줘. 코드는 수정하지 마.
   1) supabase/migrations의 20260928160000_sec1_leaderboard_privacy.sql부터
      20260929220000_biz1_order_limit.sql까지 13개 파일을 파일명 순서대로 내용 그대로 실행해줘.
      하나라도 실패하면 거기서 멈추고 오류 메시지를 그대로 보여줘.
   2) 그다음 supabase/functions의 함수 11개(analyze-text, chat, chat-feedback, confirm-payment,
      create-order, delete-account, generate-cards, send-reminders, speaking, speaking-feedback,
      split-dialogue)를 배포하고, 폴더가 없어진 함수(generate-examples, generate-pet-image,
      personalized-recommendations, pet-diary, sync-gap-analysis, weekly-report)는 삭제해줘.
   3) 끝나면 docs/deploy.md의 "확인 SQL"을 실행해서 결과를 보여줘.
   ```

3. 확인 결과가 기대값과 같으면 **Publish → Update**를 누릅니다.

## 사전 점검 SQL (읽기 전용)

```sql
-- 마지막으로 적용된 마이그레이션. 20260309003534 다음이 아무것도 없어야 합니다.
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;

-- 이번에 새로 만드는 객체. 모두 null이어야 합니다. 값이 있으면 멈추고 원인을 확인합니다.
select to_regclass('public.activity_events') as activity_events,
       to_regclass('public.payments') as payments,
       to_regclass('backup.srs_cards_removed_prd1') as card_backup;

-- 마이그레이션이 지우거나 바꾸는 데이터의 양
select count(*) filter (where context in ('빈도 기반 단어 학습', '문장 구조 학습')
                          and target_text in ('[' || native_text || ']', native_text)) as placeholder_cards,
       count(*) - count(distinct (user_id, native_text)) as duplicate_cards
from public.srs_cards;
select count(*) as imports_with_raw_text from public.language_imports where content is not null;
select count(*) as names_to_rewrite from public.profiles
where display_name is null or btrim(display_name) = '' or position('@' in display_name) > 0
   or char_length(btrim(display_name)) > 30;

-- 알림 예약에 필요한 확장. 없으면 예약만 건너뛰고 배포는 계속됩니다.
select name, installed_version from pg_available_extensions where name in ('pg_cron', 'pg_net', 'supabase_vault');
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

-- 옮겨 둔 카드 수. 사전 점검에서 본 placeholder_cards와 duplicate_cards를 더한 값과 비슷해야 합니다.
select count(*) as backed_up_cards from backup.srs_cards_removed_prd1;

-- 알림 예약. pg_cron이 있으면 1행이 나옵니다.
select jobname, schedule from cron.job where jobname = 'send-reminders';
```

게시 후에는 휴대폰에서 이렇게 확인합니다.

1. 로그인해서 대시보드가 뜨는지 봅니다.
2. 카드를 하나 복습합니다.
3. 채팅을 한 번 보냅니다.
4. 프로필에 "무료 플랜"이 보이는지 봅니다.
5. `/upgrade`에서 요금제 표가 보이는지 봅니다.

## 배포 후 (선택)

- **문의 이메일:** `VITE_SUPPORT_EMAIL`을 `.env`에 넣고 다시 게시합니다. 비어 있으면 개인정보처리방침과 약관에 "(문의 이메일 미설정)"으로 나옵니다.
- **학습 알림:** docs/reminders.md 절차대로 설정합니다. 필요한 것은 VAPID 키, 엣지 시크릿, Vault 시크릿 2개입니다. 설정 전에는 앱 안의 토스트 알림만 나옵니다.
- **결제:** docs/monetization.md 절차대로 `TOSS_SECRET_KEY`와 `VITE_TOSS_CLIENT_KEY`를 설정합니다. 설정 전에는 결제 버튼이 수요만 기록합니다.
- **카드 백업 정리:** 2026-10-29 이후에도 카드를 되돌려 달라는 요청이 없으면 `drop schema backup cascade;`를 실행합니다.

## 문제가 생기면

- **프런트엔드:** Lovable의 버전 기록에서 이전 버전을 다시 게시합니다.
- **엣지 함수:** main의 이전 커밋에서 해당 함수를 다시 배포합니다.
- **마이그레이션:** 자동으로 되돌리는 스크립트는 없습니다.
  - 삭제된 카드는 `backup.srs_cards_removed_prd1`에서 `insert into public.srs_cards select * from backup.srs_cards_removed_prd1 where …`로 되살립니다.
  - 가져오기 원문(`language_imports.content`)은 개인정보 보호 목적으로 지운 것이라 복구하지 않습니다.
