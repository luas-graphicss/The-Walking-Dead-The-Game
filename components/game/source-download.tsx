'use client'

import type { MouseEvent } from 'react'
import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SOURCE_URL = '/api/source-zip'

function openOutsideFrame(event: MouseEvent<HTMLAnchorElement>) {
  if (window.self === window.top) return

  event.preventDefault()
  window.open(SOURCE_URL, '_blank', 'noopener')
}

export function SourceDownload({ className, variant = 'button' }: { className?: string; variant?: 'button' | 'link' }) {
  const link = variant === 'link'
  return (
    <a
      href={SOURCE_URL}
      download
      title="ZIP completo otimizado: código, modelos 3D, texturas, imagens fonte e inventário SHA-256"
      onClick={openOutsideFrame}
      className={link ? cn('menu-link', className) : cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 px-5', className)}
    >
      <Download data-icon={link ? undefined : 'inline-start'} aria-hidden="true" className={link ? 'size-4' : undefined} />
      Código-fonte (.zip)
    </a>
  )
}
