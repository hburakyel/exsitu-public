import { UpdateIcon } from "@radix-ui/react-icons"

export function Spinner({ className }: { className?: string }) {
  return <UpdateIcon className={`h-5 w-5 animate-spin ${className}`} />
}
