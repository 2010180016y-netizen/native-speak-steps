import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "(문의 이메일 미설정)";
const EFFECTIVE_DATE = "2026년 9월 29일";

type Section = { title: string; body: string[] };

const DOCS: Record<"privacy" | "terms", { title: string; sections: Section[] }> = {
  privacy: {
    title: "개인정보처리방침",
    sections: [
      {
        title: "1. 수집하는 개인정보",
        body: [
          "회원가입: 이메일, 비밀번호(암호화 저장), 닉네임. Google 로그인 시 Google 계정 이메일.",
          "학습 설정과 기록: 모국어·학습 언어, 레벨, 학습 목표, 알림 설정, 복습 카드, AI 회화·스피킹 메시지와 피드백 점수, 학습 활동 기록(XP, 연속 학습일, 이용 시간).",
          "모국어 분석: 입력한 텍스트의 분석 결과(단어 빈도, 문장 구조, 핵심 표현 등). 입력한 원문 텍스트는 저장하지 않습니다.",
          "서비스 운영: AI 기능 사용량(요청 횟수, 토큰 수), 앱 오류 정보(오류 메시지, 발생 화면 주소, 브라우저 정보), 서비스 이용 기록(앱 방문일, 온보딩·분석·카드 저장·복습·회화 완료 여부), 학습 알림을 켠 경우 브라우저 푸시 구독 정보.",
          "유료 결제: 주문번호, 결제 금액, 결제 일시, 결제 승인 키. 카드번호 등 결제수단 정보는 결제대행사가 처리하며 LangSync는 받지 않습니다.",
        ],
      },
      {
        title: "2. 이용 목적",
        body: [
          "학습 서비스 제공(카드 생성, AI 회화·스피킹, 피드백, 통계), 계정 관리, 오류 수정과 서비스 개선, AI 기능 남용 방지.",
        ],
      },
      {
        title: "3. 처리 위탁 및 국외 이전",
        body: [
          "Supabase Inc.: 데이터베이스, 인증, 파일 저장소 호스팅.",
          "Lovable: 앱 호스팅 및 AI 게이트웨이 운영.",
          "(주)토스페이먼츠: Pro 이용권 결제 처리.",
          "브라우저 푸시 서비스(Google, Apple, Mozilla 등): 학습 알림을 켠 경우 알림 전달.",
          "Google LLC (Gemini): AI 회화, 스피킹, 피드백, 모국어 텍스트 분석, 카드 생성. 해당 기능 사용 시 입력한 대화와 텍스트가 전송됩니다.",
          "위 업체의 서버는 대한민국 외(미국 등)에 있을 수 있으며, 서비스 이용 시점에 네트워크를 통해 전송됩니다. 이전을 원하지 않으면 해당 AI 기능을 사용하지 않거나 계정을 삭제할 수 있습니다.",
        ],
      },
      {
        title: "4. 보관 및 파기",
        body: [
          "개인정보는 회원 탈퇴(계정 삭제) 시 지체 없이 모두 파기합니다. 모국어 분석에 입력한 원문은 분석 직후 폐기되며 저장하지 않습니다.",
          "단, 결제 기록(주문번호, 금액, 일시)은 전자상거래법에 따라 계정 삭제 후에도 5년간 보관하며, 이때 계정과의 연결은 끊습니다.",
        ],
      },
      {
        title: "5. 이용자의 권리",
        body: [
          "프로필 화면에서 닉네임과 학습 설정을 조회·수정할 수 있습니다.",
          "프로필 > 계정 삭제에서 언제든지 계정과 모든 데이터를 삭제할 수 있습니다.",
          "그 밖의 열람·정정·삭제·처리정지 요청은 아래 문의처로 연락해 주세요.",
        ],
      },
      {
        title: "6. 다른 사람의 정보",
        body: [
          "카카오톡 대화 등 다른 사람의 메시지가 포함된 텍스트는 그 사람의 동의를 받은 경우에만 입력해 주세요. 전화번호·이메일 등은 전송 전에 자동으로 가려지지만 이름 등 모든 정보를 가릴 수는 없습니다.",
        ],
      },
      {
        title: "7. 문의처",
        body: [`개인정보 보호 관련 문의: ${SUPPORT_EMAIL}`],
      },
    ],
  },
  terms: {
    title: "이용약관",
    sections: [
      {
        title: "1. 서비스",
        body: [
          "LangSync는 사용자가 입력한 모국어 텍스트와 AI 회화를 바탕으로 외국어 학습 카드와 연습을 제공하는 서비스입니다.",
        ],
      },
      {
        title: "2. 계정",
        body: [
          "이용자는 정확한 정보로 가입하고 계정을 안전하게 관리해야 합니다. 계정은 프로필 화면에서 언제든지 삭제할 수 있습니다.",
        ],
      },
      {
        title: "3. 금지 행위",
        body: [
          "동의 없이 다른 사람의 개인정보를 입력하는 행위, AI 기능을 학습 외 목적으로 대량 사용하는 행위, 서비스의 정상 운영을 방해하거나 보안을 우회하는 행위, 법령을 위반하는 행위.",
        ],
      },
      {
        title: "4. AI 기능",
        body: [
          "AI가 생성한 번역, 교정, 피드백, 점수는 부정확할 수 있으며 학습 참고용입니다. AI 기능에는 하루 사용 한도가 있습니다.",
        ],
      },
      {
        title: "5. 유료 이용권 (Pro)",
        body: [
          "Pro 30일 이용권은 결제 즉시 30일 동안 더 높은 AI 사용 한도를 제공합니다. 이용 중 다시 구매하면 남은 기간에 30일이 더해집니다.",
          "자동 결제(정기 결제)되지 않으며, 기간이 끝나면 무료 플랜으로 돌아갑니다.",
          "결제 후 7일 이내이고 Pro 한도를 사용하지 않았다면 전액 환불을 요청할 수 있습니다. 환불 요청은 아래 문의처로 연락해 주세요.",
        ],
      },
      {
        title: "6. 서비스 변경 및 중단",
        body: [
          "서비스 내용은 개선을 위해 변경되거나 중단될 수 있으며, 중요한 변경은 앱 내에서 미리 안내합니다.",
        ],
      },
      {
        title: "7. 책임의 제한",
        body: [
          "회사는 고의 또는 중대한 과실이 없는 한 무료로 제공되는 서비스 이용과 관련하여 발생한 손해에 책임을 지지 않습니다.",
        ],
      },
      {
        title: "8. 준거법 및 문의",
        body: [`이 약관은 대한민국 법을 따릅니다. 문의: ${SUPPORT_EMAIL}`],
      },
    ],
  },
};

const LegalPage = ({ doc }: { doc: "privacy" | "terms" }) => {
  const { title, sections } = DOCS[doc];
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> 돌아가기
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">{title}</h1>
        <p className="text-xs text-muted-foreground mb-6">시행일: {EFFECTIVE_DATE}</p>
        {sections.map((section) => (
          <section key={section.title} className="mb-5">
            <h2 className="font-bold text-foreground mb-2">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed mb-1.5">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

export default LegalPage;
