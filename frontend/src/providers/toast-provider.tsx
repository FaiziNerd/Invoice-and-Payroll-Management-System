"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "border-border/80 bg-card/95 backdrop-blur-md shadow-card font-sans",
          title: "font-medium text-foreground",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}
