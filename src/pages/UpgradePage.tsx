import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { AiError, invokeAi } from "@/lib/ai";
import { isPro, PLAN_LIMITS, PRO_DAYS, PRO_PRICE_KRW } from "@/lib/plan";

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

type TossPayments = (clientKey: string) => {
  payment: (options: { customerKey: string }) => {
    requestPayment: (request: Record<string, unknown>) => Promise<void>;
  };
};

function loadTossPayments(): Promise<TossPayments> {
  const w = window as unknown as { TossPayments?: TossPayments };
  if (w.TossPayments) return Promise.resolve(w.TossPayments);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error("TossPayments not loaded")));
    script.onerror = () => reject(new Error("TossPayments script failed to load"));
    document.head.appendChild(script);
  });
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

/** Plans and the Pro checkout. `result` renders the Toss Payments success/fail redirect. */
const UpgradePage = ({ result }: { result?: "success" | "fail" }) => {
  const { profile, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const confirmed = useRef(false);
  const pro = isPro(profile);

  useEffect(() => {
    if (!result) track("upgrade_viewed");
  }, [result]);

  // Safe to repeat: the server grants each order once and recovers orders Toss already charged.
  const confirmPayment = useCallback(async () => {
    setBusy(true);
    setConfirmError(null);
    const { error } = await supabase.functions.invoke("confirm-payment", {
      body: { paymentKey: params.get("paymentKey"), orderId: params.get("orderId"), amount: params.get("amount") },
    });
    if (error) {
      setConfirmError("결제를 확인하지 못했어요. 다시 확인해도 안 되면 문의해 주세요.");
    } else {
      track("upgrade_completed");
      await refreshProfile();
    }
    setBusy(false);
  }, [params, refreshProfile]);

  useEffect(() => {
    if (result !== "success" || confirmed.current) return;
    confirmed.current = true;
    confirmPayment();
  }, [result, confirmPayment]);

  const handleCheckout = async () => {
    track("checkout_started");
    if (!TOSS_CLIENT_KEY) {
      // Payments not configured yet: the click itself is the demand signal.
      toast.success("Pro는 곧 출시돼요. 관심 가져주셔서 감사해요!");
      return;
    }
    setBusy(true);
    try {
      const { data: order, error } = await invokeAi<{ orderId: string; amount: number; orderName: string; customerKey: string }>("create-order");
      if (error || !order) throw error ?? new Error("order not created");
      const tossPayments = await loadTossPayments();
      await tossPayments(TOSS_CLIENT_KEY).payment({ customerKey: order.customerKey }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/upgrade/success`,
        failUrl: `${window.location.origin}/upgrade/fail`,
      });
    } catch (e) {
      console.error("checkout failed:", e);
      toast.error(e instanceof AiError ? e.message : "결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-foreground mb-1 flex items-center gap-2">
        <Crown className="text-duo-orange" size={24} /> LangSync Pro
      </h1>
      <p className="text-sm text-muted-foreground font-semibold mb-5">매일 더 많이 대화하고, 더 많은 내 표현을 카드로 만들어요</p>

      {result === "success" && (
        <div className="duo-card mb-4 text-sm font-semibold">
          {busy ? (
            <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> 결제를 확인하고 있어요...</span>
          ) : confirmError ? (
            <span className="flex items-center justify-between gap-2 text-destructive">
              {confirmError}
              <button onClick={confirmPayment} className="shrink-0 underline">다시 확인</button>
            </span>
          ) : (
            <span className="text-primary">🎉 Pro가 활성화됐어요!</span>
          )}
        </div>
      )}
      {result === "fail" && (
        <div className="duo-card mb-4 text-sm font-semibold text-destructive">
          결제가 완료되지 않았어요. {params.get("message") ?? ""}
        </div>
      )}

      {pro && profile?.pro_until && (
        <div className="duo-card mb-4 text-sm font-bold text-primary">
          Pro 이용 중 · {formatDate(profile.pro_until)}까지
        </div>
      )}

      <div className="duo-card mb-4">
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-muted-foreground mb-2">
          <span />
          <span className="text-center">무료</span>
          <span className="text-center text-primary">Pro</span>
        </div>
        {PLAN_LIMITS.map((row) => (
          <div key={row.label} className="grid grid-cols-3 gap-2 text-xs py-2 border-t border-border">
            <span className="font-bold text-foreground">{row.label}</span>
            <span className="text-center text-muted-foreground">{row.free}</span>
            <span className="text-center font-bold text-primary flex items-center justify-center gap-1">
              <Check size={12} /> {row.pro}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={handleCheckout}
        disabled={busy}
        className="duo-btn-primary w-full text-sm disabled:opacity-50"
      >
        {pro ? `Pro ${PRO_DAYS}일 연장` : `Pro ${PRO_DAYS}일 이용권`} · ₩{PRO_PRICE_KRW.toLocaleString()}
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        자동 결제되지 않아요. 결제 후 {PRO_DAYS}일 동안 이용할 수 있어요.{" "}
        <Link to="/terms" className="underline">이용약관</Link>
      </p>
    </AppLayout>
  );
};

export default UpgradePage;
