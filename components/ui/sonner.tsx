"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-right"
      closeButton
      offset={76}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-ink group-[.toaster]:border-line group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-ink-2",
          actionButton:
            "group-[.toast]:bg-orange group-[.toast]:text-white group-[.toast]:rounded-md",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:rounded-md",
          closeButton:
            "group-[.toast]:border-line group-[.toast]:bg-card group-[.toast]:text-ink-2",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--ink)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
