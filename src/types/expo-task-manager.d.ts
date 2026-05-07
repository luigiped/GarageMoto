declare module 'expo-task-manager' {
  export interface TaskManagerTaskBody<T = unknown> {
    data?: T
    error?: Error | null
    executionInfo?: unknown
  }

  export function defineTask<T = unknown>(
    taskName: string,
    taskExecutor: (body: TaskManagerTaskBody<T>) => void | Promise<void>,
  ): void

  export function isTaskDefined(taskName: string): boolean
}
