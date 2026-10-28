"use client";

import { useState } from "react";

import { formatDate, parseDisplayDate } from "@/lib/club/week";

export function DateField({
  value,
  onChange,
  className = "",
  "data-field": dataField,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  "data-field"?: string;
}) {
  const [edit, setEdit] = useState<{ source: string; text: string; invalid: boolean } | null>(null);
  const editing = edit?.source === value ? edit : null;
  const text = editing ? editing.text : value ? formatDate(value) : "";
  const invalid = editing?.invalid ?? false;

  return (
    <span className="block">
      <input
        value={text}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        aria-invalid={invalid || undefined}
        data-field={dataField}
        onChange={(event) => {
          const next = event.target.value;
          if (!next.trim()) {
            setEdit(null);
            onChange("");
            return;
          }
          const iso = parseDisplayDate(next);
          if (!iso) {
            setEdit({ source: value, text: next, invalid: true });
            return;
          }
          setEdit(null);
          onChange(iso);
        }}
        className={className}
      />
      {invalid ? <span className="mt-1 block text-sm font-semibold text-rose-700">Use dd/mm/yyyy.</span> : null}
    </span>
  );
}
