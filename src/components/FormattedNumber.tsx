import { useCallback, useState } from "react";
import {
  formatNumber,
  hasAbbrevTier,
  type NumberDisplayStyle,
} from "../lib/formatNumber";

type FormattedNumberProps = {
  value: number;
  /** Prepended as-is (e.g. "+"). */
  prefix?: string;
  className?: string;
  style?: NumberDisplayStyle;
};

const TOGGLE_TITLE = "Click to toggle short / full number name";

export function FormattedNumber({
  value,
  prefix = "",
  className = "",
  style: controlledStyle,
}: FormattedNumberProps) {
  const [internalStyle, setInternalStyle] =
    useState<NumberDisplayStyle>("short");
  const style = controlledStyle ?? internalStyle;
  const canToggle = hasAbbrevTier(value) && controlledStyle === undefined;

  const toggle = useCallback(() => {
    if (!canToggle) return;
    setInternalStyle((s) => (s === "short" ? "words" : "short"));
  }, [canToggle]);

  const text = prefix + formatNumber(value, style);

  if (!canToggle) {
    return <span className={className}>{text}</span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={TOGGLE_TITLE}
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
