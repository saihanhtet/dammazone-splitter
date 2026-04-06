import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRpc } from "./lib/electrobunContext";

type SettingsContextValue = {
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  keyFromEnv: boolean;
  refreshKey: () => Promise<void>;
  saveApiKey: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const rpc = useRpc();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyFromEnv, setKeyFromEnv] = useState(false);

  const refreshKey = useCallback(async () => {
    if (!rpc) return;
    const r = await rpc.request.getApiKey({});
    setKeyFromEnv(r.fromEnv);
    if (!r.fromEnv && r.key) setApiKeyInput(r.key);
    else if (!r.fromEnv) setApiKeyInput("");
  }, [rpc]);

  useEffect(() => {
    void refreshKey();
  }, [refreshKey]);

  const saveApiKey = useCallback(async () => {
    if (!rpc) return;
    await rpc.request.setApiKey({
      key: apiKeyInput.trim() === "" ? null : apiKeyInput.trim(),
    });
    await refreshKey();
  }, [rpc, apiKeyInput, refreshKey]);

  const value = useMemo(
    () => ({
      apiKeyInput,
      setApiKeyInput,
      keyFromEnv,
      refreshKey,
      saveApiKey,
    }),
    [apiKeyInput, keyFromEnv, refreshKey, saveApiKey],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useAppSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useAppSettings requires AppSettingsProvider");
  return ctx;
}
