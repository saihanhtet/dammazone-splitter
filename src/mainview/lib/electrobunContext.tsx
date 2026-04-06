import Electrobun, { Electroview } from "electrobun/view";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { BunSideRpc } from "../bunRequestApi";
import type { AnalysisStagePayload } from "@shared/rpcTypes";

const RpcContext = createContext<BunSideRpc | null>(null);
const StageContext = createContext<AnalysisStagePayload | null>(null);

export function ElectrobunRootProvider({ children }: { children: ReactNode }) {
  const [rpc, setRpc] = useState<BunSideRpc | null>(null);
  const [stage, setStage] = useState<AnalysisStagePayload | null>(null);

  useEffect(() => {
    const rpcInstance = Electroview.defineRPC({
      maxRequestTime: 300_000,
      handlers: {
        requests: {},
        messages: {
          analysisStage: (payload: AnalysisStagePayload) => {
            setStage(payload);
          },
        },
      },
    } as Parameters<typeof Electroview.defineRPC>[0]);

    const view = new Electrobun.Electroview({ rpc: rpcInstance });
    setRpc(view.rpc as unknown as BunSideRpc);

    return () => {
      setRpc(null);
    };
  }, []);

  return (
    <RpcContext.Provider value={rpc}>
      <StageContext.Provider value={stage}>{children}</StageContext.Provider>
    </RpcContext.Provider>
  );
}

export function useRpc(): BunSideRpc | null {
  return useContext(RpcContext);
}

export function useAnalysisStage(): AnalysisStagePayload | null {
  return useContext(StageContext);
}
