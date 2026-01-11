import * as React from "react";
import { cn } from "@/lib/utils";

interface AlertDialogProps
  extends React.DialogHTMLAttributes<HTMLDialogElement> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({
  open,
  onOpenChange,
  children,
  ...props
}: AlertDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  return open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-background border shadow-lg rounded-lg p-6 z-10 w-full max-w-lg gap-4 sm:rounded-lg"
        onClick={(e) => {
          e.stopPropagation();
        }}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    </div>
  ) : null;
}

export function AlertDialogTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <span onClick={props.onClick} style={{ display: "inline-block" }}>
      {children}
    </span>
  );
}

export function AlertDialogContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}

export function AlertDialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col space-y-2 text-center sm:text-left">
      {children}
    </div>
  );
}

export function AlertDialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function AlertDialogDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function AlertDialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
      {children}
    </div>
  );
}

export function AlertDialogCancel({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2 sm:mt-0 cursor-pointer"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-white hover:bg-destructive/90 h-10 px-4 py-2 cursor-pointer"
      onClick={onClick}
      autoFocus
      type="button"
    >
      {children}
    </button>
  );
}
