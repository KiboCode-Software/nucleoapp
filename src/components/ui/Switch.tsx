import { cn } from "@/utils/cn";

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Interruptor de iOS (UISwitch): 51×31, verde al activarse, el pulgar se estira al pulsar. */
export function Switch({ label, checked, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-[var(--ease-ios)] disabled:opacity-40",
        checked ? "bg-success" : "bg-fill",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)]",
          "transition-[transform,width] duration-300 ease-[var(--ease-ios)] group-active:w-[33px]",
          checked && "translate-x-[20px] group-active:translate-x-[14px]",
        )}
      />
    </button>
  );
}
