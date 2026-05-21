import type { ReactNode } from 'react'
import { apTheme } from '../ap-payments.theme'

interface Props {
  children: ReactNode
  className?: string
  fullHeight?: boolean
}

export function ApPaymentsShell({ children, className = '', fullHeight }: Props) {
  return (
    <div
      className={`${fullHeight ? apTheme.pageHScreen : `${apTheme.page} ${apTheme.pagePb}`} ${apTheme.decorWrap} ${className}`}
    >
      <div className={apTheme.decorBlob1} aria-hidden />
      <div className={apTheme.decorBlob2} aria-hidden />
      <div
        className={`${apTheme.content}${fullHeight ? ' flex flex-col flex-1 min-h-0' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}
