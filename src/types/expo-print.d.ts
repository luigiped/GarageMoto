declare module 'expo-print' {
  export interface PrintToFileOptions {
    html?: string
    base64?: boolean
  }

  export interface PrintToFileResult {
    uri: string
    base64?: string
  }

  export function printToFileAsync(options?: PrintToFileOptions): Promise<PrintToFileResult>
}
