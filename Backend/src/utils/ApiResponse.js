class ApiResponse {
  constructor(statusCode, data, message = "Success", meta = null) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    if (meta) this.meta = meta; // pagination, totals, etc.
  }
}

export default ApiResponse;