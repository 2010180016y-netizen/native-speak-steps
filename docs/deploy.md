# 운영 배포 절차 (무료 구성)

초기 운영은 비용 없이 아래 구성으로 합니다.

| 역할 | 서비스 | 무료 한도와 주의점 |
| --- | --- | --- |
| DB, 로그인, 엣지 함수 | Supabase Free (서울, `ap-northeast-2`) | 계정당 활성 프로젝트 2개. 7일 동안 요청이 없으면 일시 중지됩니다. `.github/workflows/keepalive.yml`이 3일마다 요청을 보냅니다. |
| AI | Gemini API 무료 등급 | 하루 요청 수가 모델별로 정해져 있습니다(2.5 Flash는 약 250회). Google이 입력 내용을 서비스 개선에 쓰고 검토자가 읽을 수 있습니다. 개인정보처리방침에 적어 두었습니다. |
| 웹 호스팅 | Vercel Hobby | 비상업적 용도만 허용됩니다. 유료 결제를 켜기 전에 Cloudflare Pages(무료, 상업 이용 가능) 또는 Vercel Pro로 옮깁니다. |

Lovable Cloud의 기존 백엔드(`wdkqzqcmqblzqglwjyqv`)와 가입자 12명은 옮기지 않고 새로 시작합니다.

순서는 반드시 **마이그레이션 → 엣지 함수 → 프런트엔드**입니다. 새 프런트엔드와 엣지 함수는 새 테이블과 DB 함수를 부릅니다.

## 1. Supabase 프로젝트 (Claude가 진행)

1. `create_project`로 `langsync` 프로젝트를 `ap-northeast-2`에 만들고 `get_project`로 `ACTIVE_HEALTHY`가 될 때까지 기다립니다.
   - "2 project limit" 오류가 나면 supabase.com/dashboard/projects 에서 쓰지 않는 프로젝트를 일시 중지(Pause)합니다. 일시 중지한 프로젝트는 90일 안에 다시 켤 수 있습니다.
2. `supabase/migrations`의 **모든** 파일을 파일명 순서대로 `apply_migration`으로 적용합니다.
   - 내용은 그대로 적용하고, `name`은 파일명에서 확장자를 뺀 것입니다.
   - 하나라도 실패하면 멈추고 보고합니다.
3. `deploy_edge_function`으로 함수 11개를 배포합니다.
   - 대상: analyze-text, chat, chat-feedback, confirm-payment, create-order, delete-account, generate-cards, send-reminders, speaking, speaking-feedback, split-dialogue
   - 각 함수에 `_shared/ai.ts`를 함께 올립니다.
   - `verify_jwt`는 `supabase/config.toml`을 따릅니다. 목록에 없는 함수는 `true`입니다.
4. 아래 **확인 SQL**을 실행합니다.
5. `get_publishable_keys`로 받은 값으로 `.env`의 세 값과 `supabase/config.toml`의 `project_id`를 바꿔 커밋합니다.

MCP로 적용하면 `supabase_migrations.schema_migrations`의 버전이 파일명과 달라집니다. 나중에 CLI의 `supabase db push`를 쓰려면 먼저 `supabase migration repair`로 맞춥니다.

## 2. 휴대폰에서 할 일 (사용자)

MCP에 해당 기능이 없어 대시보드에서 직접 합니다.

1. **Gemini API 키:** aistudio.google.com/apikey 에서 **Create API key**를 누르고 키를 복사합니다. 결제 정보는 넣지 않습니다.
2. **엣지 함수 시크릿:** Supabase 대시보드 → Edge Functions → Secrets에서 `GEMINI_API_KEY`에 1번 키를 넣습니다.
3. **이메일 인증 끄기:** Authentication → Sign In / Providers → Email에서 **Confirm email**을 끕니다.
   - Supabase 기본 메일 서버는 프로젝트 팀원 주소로만 메일을 보냅니다. 켜 두면 일반 사용자는 가입을 마칠 수 없습니다.
   - 비밀번호 재설정 메일도 같은 이유로 가지 않습니다. 필요해지면 **나중에**의 SMTP 항목을 진행합니다.
4. **주소 설정:** Authentication → URL Configuration
   - Site URL: Vercel 주소 (예: `https://langsync.vercel.app`)
   - Redirect URLs: 같은 주소에 `/**`를 붙여 추가 (예: `https://langsync.vercel.app/**`)

## 3. 프런트엔드 (Claude가 진행)

1. PR을 머지합니다.
2. Vercel에서 GitHub 저장소를 가져와 프로젝트를 만들고 `main`을 배포합니다.
   - 빌드 명령 `npm run build`, 출력 폴더 `dist`. `vercel.json`이 모든 경로를 `index.html`로 보냅니다.
   - 환경 변수는 저장소의 `.env`를 그대로 씁니다. Vercel에 따로 넣지 않습니다.
3. 휴대폰에서 이렇게 확인합니다.
   1. 회원가입 후 바로 대시보드가 뜨는지 봅니다.
   2. 카드를 하나 복습합니다.
   3. 채팅을 한 번 보냅니다.
   4. 프로필에 "무료 플랜"이 보이는지 봅니다.
   5. `/upgrade`에서 요금제 표가 보이는지 봅니다.

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

-- 로그인한 사용자가 테이블을 읽을 수 있어야 합니다. true여야 합니다.
select has_table_privilege('authenticated', 'public.profiles', 'select') as api_can_read;

-- 알림 예약. pg_cron이 있으면 1행이 나옵니다.
select jobname, schedule from cron.job where jobname = 'send-reminders';
```

## 나중에 (필요할 때)

- **문의 이메일:** `VITE_SUPPORT_EMAIL`을 `.env`에 넣고 커밋합니다. 비어 있으면 개인정보처리방침과 약관에 "(문의 이메일 미설정)"으로 나옵니다.
- **Google 로그인:** Google Cloud Console에서 OAuth 클라이언트를 만들고, Supabase → Authentication → Providers → Google에 클라이언트 ID와 시크릿을 넣습니다. 그다음 `.env`에 `VITE_GOOGLE_AUTH="true"`를 넣고 커밋합니다.
- **메일 발송(SMTP):** Brevo 무료(하루 300통) 같은 SMTP를 Authentication → Emails → SMTP Settings에 넣습니다. 그다음 Confirm email을 다시 켜도 됩니다.
- **AI 사용량이 늘면:** Google AI Studio에서 결제를 연결해 유료 등급으로 올립니다. 유료 등급에서는 Google이 입력 내용을 서비스 개선에 쓰지 않으니 개인정보처리방침의 해당 문장을 지웁니다. 모델만 바꾸려면 엣지 함수 시크릿 `AI_MODEL_DEFAULT`를 넣습니다.
- **학습 알림:** docs/reminders.md 절차대로 설정합니다.
- **결제:** docs/monetization.md 절차대로 설정합니다. 켜기 전에 호스팅을 상업 이용이 가능한 곳으로 옮깁니다.
- **keepalive:** GitHub는 저장소에 60일 동안 커밋이 없으면 예약 워크플로를 끕니다. 그러면 Actions 탭에서 다시 켭니다.

## 문제가 생기면

- **프런트엔드:** Vercel의 Deployments에서 이전 배포를 **Promote**합니다.
- **엣지 함수:** main의 이전 커밋에서 해당 함수를 다시 배포합니다.
- **마이그레이션:** 자동으로 되돌리는 스크립트는 없습니다. 새 프로젝트라 데이터가 적을 때는 프로젝트를 지우고 처음부터 다시 적용하는 편이 빠릅니다.
