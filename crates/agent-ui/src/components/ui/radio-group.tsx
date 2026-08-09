import { RadioGroup as RadioGroupPrimitive, Radio as RadioPrimitive } from "@base-ui/react";
import * as React from "react";

import { cn } from "../../lib/shared/utils";

export const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive
    ref={ref}
    data-slot="radio-group"
    className={cn("grid gap-2", className)}
    {...props}
  />
));
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof RadioPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Root
    ref={ref}
    data-slot="radio-group-item"
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
RadioGroupItem.displayName = "RadioGroupItem";
