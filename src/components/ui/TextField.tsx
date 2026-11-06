import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";
import { fieldClass } from "./fields";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, id, className, ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-medium">
        {label}
      </label>
      <input id={id} className={cn(fieldClass, "h-10 w-full text-[14px]", className)} {...rest} />
    </div>
  );
}
