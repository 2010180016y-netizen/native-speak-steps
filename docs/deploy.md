# 운영 배포 절차 (Neon + Vercel)

Lovable과 Supabase는 쓰지 않습니다. 모두 무료 등급으로 돌아갑니다.

| 역할 | 서비스 | 무료 한도 |
| --- | --- | --- |
| DB, 로그인, Data API | Neon Free | 월 100 CU-시간, 로그인 월 6만 명. 저장 용량 한도는 콘솔 Usage에서 확인 |
| 웹 호스팅, 서버 함수(`api/`) | Vercel Hobby | 비상업용만 허용. 유료 결제를 열면 Pro 플랜이 필요합니다 |
| AI | Gemini API 무료 등급 | 모델별 하루 요청 수 제한 |
| 학습 알림 예약 | GitHub Actions (`reminders.yml`) | 공개/비공개 저장소 무료 분량 안 |

구성:

- 브라우저는 `@neondatabase/neon-js`로 Neon Auth(로그인)와 Data API(테이블 읽기·쓰기)를 직접 부릅니다. 행 단위 보안(RLS)이 사용자별로 막습니다.
- AI, 결제, 계정 삭제, 알림 발송은 Vercel 함수(`api/*.ts`)가 처리합니다. 로그인 토큰(JWT)을 Neon Auth의 JWKS로 확인하고, `DATABASE_URL`(소유자 권한)로 DB에 접속합니다.
- DB 구조는 `db/migrations/0001_init.sql` 한 파일입니다. 로컬 검사: `npm run test:db`.

## 1. Neon 프로젝트

1. Neon 콘솔에서 프로젝트를 만듭니다. 지역은 사용자와 가까운 곳(예: AWS Asia Pacific)을 고릅니다.
2. **Auth**를 켭니다. `neon_auth` 스키마와 `neon_auth."user"` 테이블이 생깁니다.
3. **Data API**를 켜고 인증 공급자로 Neon Auth를 고릅니다.
4. SQL Editor에서 `db/migrations/0001_init.sql` 전체를 실행합니다.
5. 아래 **확인 SQL**을 실행합니다.
6. 아래 값을 적어 둡니다.
   - Auth URL → `VITE_NEON_AUTH_URL`
   - Data API URL → `VITE_NEON_DATA_API_URL`
   - JWKS URL(Auth 설정 화면) → `NEON_AUTH_JWKS_URL`
   - 연결 문자열(Connection string, 풀러 사용) → `DATABASE_URL`

Auth 설정에서 함께 확인합니다.

- **이메일 인증:** 가입 후 인증 메일을 보내도록 켭니다. 가입 화면이 "인증 메일을 보냈어요"를 보여 줍니다.
- **비밀번호 재설정:** 메일의 링크가 `/reset-password?token=…`으로 돌아옵니다. 앱 주소를 허용 도메인(Trusted origins)에 넣습니다.
- **Google 로그인(선택):** Google 공급자를 켠 뒤 `VITE_GOOGLE_AUTH=true`를 넣습니다.

## 2. Vercel 프로젝트

1. GitHub 저장소를 Vercel에 연결합니다. 프레임워크는 Vite, 빌드 명령은 `npm run build`, 출력은 `dist`입니다. `vercel.json`이 `/api/` 밖의 모든 경로를 `index.html`로 보냅니다.
2. 환경 변수를 넣습니다. 비밀 값은 Vercel 대시보드에만 넣고, 채팅이나 저장소에 붙여 넣지 않습니다.

| 이름 | 예시/출처 | 비밀 |
| --- | --- | --- |
| `VITE_NEON_AUTH_URL` | Neon Auth URL | 아니요 |
| `VITE_NEON_DATA_API_URL` | Neon Data API URL | 아니요 |
| `NEON_AUTH_JWKS_URL` | Neon Auth JWKS URL | 아니요 |
| `DATABASE_URL` | Neon 연결 문자열 | **예** |
| `GEMINI_API_KEY` | aistudio.google.com/apikey (결제 정보 없이) | **예** |
| `VITE_SUPPORT_EMAIL` | 문의 이메일. 비면 "(문의 이메일 미설정)" | 아니요 |
| `VITE_GOOGLE_AUTH` | `true`면 Google 로그인 버튼 표시 | 아니요 |
| `VITE_VAPID_PUBLIC_KEY`, `VAPID_*`, `REMINDER_CRON_SECRET` | docs/reminders.md | 개인 키·비밀은 **예** |
| `VITE_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` | docs/monetization.md | 비밀 키는 **예** |

3. `main`에 머지하면 Vercel이 배포합니다. PR마다 미리보기 배포가 생깁니다.

`VITE_`로 시작하는 값은 빌드 때 화면 코드에 들어가므로, 바꾼 뒤에는 다시 배포해야 합니다.

## 3. 학습 알림 예약

docs/reminders.md 절차대로 GitHub 저장소에 `APP_URL` 변수와 `REMINDER_CRON_SECRET` 비밀을 넣습니다. 넣기 전에는 워크플로가 건너뜁니다.

## 확인 SQL

```sql
-- 행 단위 보안이 꺼진 public 테이블. 0행이어야 합니다.
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;

-- 로그인 사용자가 부를 수 있는 함수. current_user_id, ensure_profile, is_valid_timezone, record_activity 넷이어야 합니다.
select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute');

-- 로그인 사용자 id의 타입. uuid여야 합니다.
select data_type from information_schema.columns
where table_schema = 'neon_auth' and table_name = 'user' and column_name = 'id';
```

## 배포 후 점검

1. 가입 → 인증 메일 → 로그인 → 온보딩이 끝까지 됩니다.
2. 대화 연습 한 번이 응답합니다(`/api/chat`). 실패하면 Vercel 함수 로그를 봅니다.
3. 카드 복습 후 통계에 반영됩니다.
4. 비밀번호 재설정 메일의 링크로 비밀번호를 바꿀 수 있습니다.
5. 프로필 → 계정 삭제 후 같은 이메일로 로그인되지 않습니다.

## 문제가 생기면

- **화면이나 서버 함수:** Vercel의 Deployments에서 이전 배포를 Promote(Instant Rollback)합니다.
- **DB:** Neon의 Restore로 이전 시점으로 되돌립니다. 무료 플랜은 되돌릴 수 있는 기간이 짧습니다. 되돌리기 전에 현재 상태를 브랜치로 남겨 둡니다.
