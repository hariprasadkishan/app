class ApiResponse {
  constructor(statusCode, data, message = "Success", meta = null) {
    this.statusCode = statusCode;
    this.data       = data;
    this.message    = message;
    this.success    = statusCode < 400;
    if (meta) this.meta = meta;
  }

  static ok(data, message = "Success", meta = null) {
    return new ApiResponse(200, data, message, meta);
  }

  static created(data, message = "Created successfully") {
    return new ApiResponse(201, data, message);
  }

  static noContent() {
    return new ApiResponse(204, null, "No content");
  }
}

export default ApiResponse;
