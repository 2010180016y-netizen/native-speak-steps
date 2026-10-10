import { ENGLISH_VARIETIES } from "@/lib/constants";

type Props = {
  /** profiles.target_variety; null means American English. */
  value: string | null;
  onChange: (variety: string) => void;
};

/** American or British English, for learners of English. */
const EnglishVarietyPicker = ({ value, onChange }: Props) => {
  const selected = value ?? "en-US";
  return (
    <div className="grid grid-cols-2 gap-2">
      {ENGLISH_VARIETIES.map((variety) => (
        <button
          key={variety.code}
          type="button"
          aria-pressed={selected === variety.code}
          onClick={() => onChange(variety.code)}
          className={`duo-card flex items-center justify-center gap-2 p-3 text-sm font-bold text-foreground cursor-pointer transition-all ${
            selected === variety.code ? "border-primary" : ""
          }`}
        >
          <span className="text-xl">{variety.flag}</span>
          {variety.label}
        </button>
      ))}
    </div>
  );
};

export default EnglishVarietyPicker;
