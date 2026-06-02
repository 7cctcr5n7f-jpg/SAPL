import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-white.png"
      alt="TENROUNDS"
      width={2297}
      height={307}
      priority
      sizes="525px"
      className={cn('h-7 w-auto', className)}
    />
  )
}
