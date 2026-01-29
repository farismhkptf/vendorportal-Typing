import { useEffect } from "react";
import { FieldErrors } from "react-hook-form";

export function useScrollToError<T extends Record<string, unknown>>(
  errors: FieldErrors<T>,
  isSubmitted: boolean
) {
  useEffect(() => {
    if (!isSubmitted) return;
    
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return;

    const firstErrorKey = errorKeys[0];
    const errorElement = document.querySelector(
      `[name="${firstErrorKey}"], [data-name="${firstErrorKey}"]`
    );

    if (errorElement) {
      errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      if (errorElement instanceof HTMLElement) {
        setTimeout(() => errorElement.focus(), 300);
      }
    }
  }, [errors, isSubmitted]);
}
