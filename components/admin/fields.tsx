import type { ReactNode } from 'react'

const inputCls =
  'w-full rounded-md border border-steel bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-neon-blue'

export function TextField({
  label,
  name,
  defaultValue,
  required,
  placeholder,
  type = 'text',
}: {
  label: string
  name: string
  defaultValue?: string
  required?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-light-grey">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  )
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string
  name: string
  defaultValue?: string
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-light-grey">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={rows} className={inputCls} />
    </label>
  )
}

export function CheckField({
  label,
  name,
  defaultChecked,
}: {
  label: string
  name: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--color-neon-blue)]"
      />
      {label}
    </label>
  )
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}
