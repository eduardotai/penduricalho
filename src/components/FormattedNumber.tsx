import { useCallback, useState } from "react";
import {
  formatNumber,
  numberCanToggle,
  type NumberDisplayStyle,
} from "../lib/formatNumber";
import { useLang, useT } from "../i18n";

type FormattedNumberProps = {
  value: number;
  /** Prepended as-is (e.g. "+"). */
  prefix?: string;
  className?: string;
  style?: NumberDisplayStyle;
  /**
   * When false, always render a <span> even if the value can toggle
   * between short/words. Use this when the number sits inside a <button>
   * (React forbids a button nested in another button).
   */
  interactive?: boolean;
};

export function FormattedNumber({
  value,
  prefix = "",
  className = "",
  style: controlledStyle,
  interactive = true,
}: FormattedNumberProps) {
  const t = useT();
  const lang = useLang();
  const [internalStyle, setInternalStyle] =
    useState<NumberDisplayStyle>("short");
  const style = controlledStyle ?? internalStyle;
  const canToggle = numberCanToggle(value, { style: controlledStyle, interactive });

  const toggle = useCallback(() => {
    if (!canToggle) return;
    setInternalStyle((s) => (s === "short" ? "words" : "short"));
  }, [canToggle]);

  const text = prefix + formatNumber(value, style, lang);

  if (!canToggle) {
    return <span className={className}>{text}</span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={t.formattedNumber.toggleTitle}
      className={`pointer-events-auto cursor-pointer text-left transition-opacity hover:opacity-80 ${className}`}
    >
      {text}
    </button>
  );
}

/** Inline "Best {n} · …" with a clickable best value. */
export function FormattedNumberInline({
  value,
  className,
  interactive,
}: {
  value: number;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <FormattedNumber
      value={value}
      className={`inline font-inherit ${className ?? ""}`}
      interactive={interactive}
    />
  );
}
