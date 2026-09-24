import * as React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0F1014] group-[.toaster]:text-white/50 group-[.toaster]:border-[#20222a] border border-[#20222a] group-[.toaster]:rounded backdrop-blur-sm text-white/30",
          description: "group-[.toast]:text-white/30 text-white/30",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
