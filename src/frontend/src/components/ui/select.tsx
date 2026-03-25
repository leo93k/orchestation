import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const selectVariants = cva(
  "bg-muted border border-border rounded outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        default: "w-full px-3 py-1.5 text-sm",
        sm: "w-full px-2 py-1 text-xs",
        inline: "px-2 py-0.5 text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(selectVariants({ size, className }))}
        {...props}
      />
    );
  },
);
Select.displayName = "Select";

export { Select, selectVariants };
