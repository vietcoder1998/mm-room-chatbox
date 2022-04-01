export class ChatResponse {
  code: number = 100
  error_code: number = -1
  data: any = {}
  error: string = ''
  constructor(data?: any, error_code?: number, error?: string, code?: number) {
    if (code) {
      this.code = code
    }

    if (data) {
      this.data = data
    }

    if (error_code) {
      this.error_code = error_code
    }

    if (error) {
      this.error = error
    }
  }
}
