"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ConfirmDialog as ConfirmDialogComponent } from "./ConfirmDialog";

const Content = dynamic(() => import("./ConfirmDialog").then((m) => m.ConfirmDialog), { ssr: false });

/** Closed confirmations must not load the dialog implementation on every page. */
export function ConfirmDialog(props: ComponentProps<typeof ConfirmDialogComponent>) {
  return props.open ? <Content {...props} /> : null;
}
