/**
 * @module extension-host/rpc
 *
 * Barrel exports for the RPC layer.
 */

export { RPCChannel } from "./rpc-protocol";
export type { RPCTransport } from "./rpc-protocol";
export {
    RPC_INTERNAL_ERROR,
    RPC_INVALID_REQUEST,
    RPC_METHOD_NOT_FOUND,
    RPC_PARSE_ERROR,
    RPC_TIMEOUT,
} from "./rpc-protocol";
export { WorkerTransport, WorkerSelfTransport } from "./worker-transport";
