import { HelpCircle } from 'lucide-react'

export function FieldHint({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-gray-500 leading-snug flex gap-1 mt-0.5">
      <HelpCircle size={12} className="shrink-0 mt-0.5 text-gray-400" />
      <span>{text}</span>
    </p>
  )
}
