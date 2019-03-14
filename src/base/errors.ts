import ExtendableError from "es6-error";

class UserError extends ExtendableError {}
class GatewayError extends ExtendableError {}

export { UserError, GatewayError }
