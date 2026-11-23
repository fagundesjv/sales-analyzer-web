"use client";

import type { ComponentProps } from "react";
import { Tooltip } from "@content-ventures/design-system/v3";

export function IconAction({ title, ...props }: ComponentProps<"button">) {
  return (
    <Tooltip bare content={title ?? props["aria-label"] ?? ""}>
      <button {...props} />
    </Tooltip>
  );
}

export function IconLink({ title, ...props }: ComponentProps<"a">) {
  return (
    <Tooltip bare content={title ?? props["aria-label"] ?? ""}>
      <a {...props} />
    </Tooltip>
  );
}
