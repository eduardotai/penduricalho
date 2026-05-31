import { useCallback, useState } from "react";
import {
  formatNumber,
  hasAbbrevTier,
  type NumberDisplayStyle,
} from "../lib/formatNumber";
import { useLang, useT } from "../i18n";

type FormattedNumberProps = {
  value: number;
  /** Prepended as-is (e.g. "+"). */
  prefix?: string;
  className?: string;
  style?: NumberDisplayStyle;
};

export function FormattedNumber({
  value,
  prefix = "",
  className = "",
  style: controlledStyle,
}: FormattedNumberProps) {
  const t = useT();
  const lang = useLang();
  const [internalStyle, setInternalStyle] =
    useState<NumberDisplayStyle>("short");
  const style = controlledStyle ?? internalStyle;
  const canToggle = hasAbbrevTier(value) && controlledStyle === undefined;

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
}: {
  value: number;
  className?: string;
}) {
  return (
    <FormattedNumber
      value={value}
      className={`inline font-inherit ${className ?? ""}`}
    />
  );
}
