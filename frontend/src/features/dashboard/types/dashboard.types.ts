export type StepStatus = 'done' | 'warn' | 'error' | 'idle' | 'locked'

export interface WorkflowStep {
  number: number
  name: string
  subtitle: string
  status: StepStatus
  detail: string
  href?: string
  isLocked: boolean
}
