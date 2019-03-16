import { GatewayError } from "../base";

class AceApiError extends GatewayError {}
class RequestTimeoutAceApiError extends AceApiError {}

export { AceApiError, RequestTimeoutAceApiError }
