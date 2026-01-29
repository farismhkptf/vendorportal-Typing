import * as React from "react"
import { cn } from "@/lib/utils"

export type MaskType = "phone" | "emiratesId" | "passport" | "woNumber"

interface MaskedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  mask?: MaskType
  onChange?: (value: string) => void
}

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 15)
  if (digits.length === 0) return ""
  if (digits.startsWith("971")) {
    if (digits.length <= 3) return `+${digits}`
    if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
  }
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

const formatEmiratesId = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 15)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 14) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`
}

const formatPassport = (value: string): string => {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
}

const formatWoNumber = (value: string): string => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (cleaned.length === 0) return ""
  const letter = cleaned.charAt(0).replace(/[^A-Z]/g, "")
  const digits = cleaned.slice(1).replace(/\D/g, "").slice(0, 6)
  return letter + digits
}

const formatters: Record<MaskType, (value: string) => string> = {
  phone: formatPhone,
  emiratesId: formatEmiratesId,
  passport: formatPassport,
  woNumber: formatWoNumber,
}

const inputModes: Record<MaskType, React.HTMLAttributes<HTMLInputElement>["inputMode"]> = {
  phone: "tel",
  emiratesId: "numeric",
  passport: "text",
  woNumber: "text",
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ className, mask, onChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value
      if (mask && formatters[mask]) {
        newValue = formatters[mask](newValue)
      }
      onChange?.(newValue)
    }

    return (
      <input
        type="text"
        inputMode={mask ? inputModes[mask] : undefined}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={value}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
MaskedInput.displayName = "MaskedInput"

export { MaskedInput }
