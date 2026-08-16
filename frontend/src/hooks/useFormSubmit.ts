import { useCallback, useState } from "react";
import { toast } from "sonner";
import { parseValidationErrors } from "../lib/validation";

/**
 * Formalizes the submit-guard pattern already used in RisksPage/ScopePage
 * (a `saving` boolean disabling the submit button) and adds field-level
 * 422 error handling on top of it.
 *
 * ```tsx
 * const { saving, fieldErrors, submit } = useFormSubmit();
 * const save = () => submit(async () => {
 *   await api.post("/things", payload);
 *   toast.success("Created");
 *   setDialogOpen(false);
 * });
 * ...
 * <Input ... />
 * <FieldError message={fieldErrors.name} />
 * <Button disabled={saving}>{saving ? t("app.saving") : t("app.save")}</Button>
 * ```
 */
export function useFormSubmit() {
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    setFieldErrors({});
    try {
      await fn();
      return true;
    } catch (e: any) {
      const errors = parseValidationErrors(e);
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
      } else {
        toast.error(e?.message || "Something went wrong");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, fieldErrors, setFieldErrors, submit };
}
