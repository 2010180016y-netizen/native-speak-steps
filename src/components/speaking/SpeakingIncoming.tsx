import { motion } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";

interface Props {
  persona: Persona;
  callerName: string;
  scenario: ChatScenario;
  onAccept: () => void;
  onDecline: () => void;
}

const SpeakingIncoming = ({ persona, callerName, scenario, onAccept, onDecline }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] relative">
      <div className="relative mb-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            style={{ width: 120 + i * 40, height: 120 + i * 40, left: -(10 + i * 20), top: -(10 + i * 20) }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-24 h-24 rounded-full bg-primary/10 border-4 border-primary flex items-center justify-center"
        >
          <span className="text-4xl">{persona.gender === "male" ? "👨" : "👩"}</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="duo-card w-full max-w-[280px] p-4 mb-4"
      >
        <div className="text-center">
          <p className="text-xl font-extrabold text-foreground mb-0.5">{callerName}</p>
          <p className="text-sm font-bold text-primary">{persona.occupation}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-bold text-muted-foreground">
              {persona.personality}
            </span>
          </div>
        </div>
        <div className="border-t border-border mt-3 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-semibold">상황</span>
            <span className="font-bold text-foreground">{scenario.emoji} {scenario.label}</span>
          </div>
        </div>
      </motion.div>

      <motion.p
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-sm font-bold text-primary mb-6"
      >
        📞 전화가 오고 있어요...
      </motion.p>

      <div className="flex items-center gap-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onDecline}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
        >
          <PhoneOff size={28} className="text-destructive-foreground" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          onClick={onAccept}
          className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg"
        >
          <Phone size={32} className="text-primary-foreground" />
        </motion.button>
      </div>
    </div>
  );
};

export default SpeakingIncoming;
