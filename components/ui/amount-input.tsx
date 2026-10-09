import * as React from "react";

import { Input } from "@/components/ui/input";

/**
 * A money field. It starts EMPTY (the muted "0" is only a placeholder, never a value,
 * so staff are not left deleting a zero before typing) and accepts digits only: letters,
 * spaces, signs and decimal points are stripped as they are typed or pasted. Whole
 * francs, so there is nothing after the point to keep.
 *
 * Leaving it empty is valid and means 0; whether 0 is acceptable is the form's rule.
 * Drop-in for react-hook-form's `register(...)`: the cleaned value is written back to
 * the event target before the handler sees it.
 */
function AmountInput({ onChange, ...props }: Omit<React.ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      {...props}
      onChange={(event) => {
        const cleaned = event.target.value.replace(/\D+/g, "");
        if (cleaned !== event.target.value) event.target.value = cleaned;
        onChange?.(event);
      }}
    />
  );
}

export { AmountInput };
