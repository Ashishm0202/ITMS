import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getFieldCI } from "@/lib/object";
import { getCoalDetails } from "@/services/api";
import { CoalDetailsDoPo, CoalDetailsDriver, CoalDetailsVehicle, ScanData, User } from "@/types/models";

type CoalChallanContextValue = {
  user: User;
  scanData: ScanData | null;
  scanRaw: string | null;
  setScan: (data: ScanData, raw: string) => void;
  vehicle: CoalDetailsVehicle | null;
  drivers: CoalDetailsDriver[];
  dopoList: CoalDetailsDoPo[];
  loadingDetails: boolean;
  fetchCoalDetails: (params: { vehNo?: string; doPo?: string; dlNo?: string }) => Promise<boolean>;
  reset: () => void;
};

const CoalChallanContext = createContext<CoalChallanContextValue | null>(null);

export function CoalChallanProvider({ children }: PropsWithChildren) {
  const { show } = useToast();
  const { user: authUser } = useAuth();
  const user = useMemo<User>(
    () => ({
      EMAILID: getFieldCI(authUser, "EMAILID") || getFieldCI(authUser, "emailid"),
      ORGANIZATION: getFieldCI(authUser, "ORGANIZATION") || getFieldCI(authUser, "organization"),
      NAME: getFieldCI(authUser, "NAME") || getFieldCI(authUser, "fullname"),
    }),
    [authUser]
  );
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [scanRaw, setScanRaw] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<CoalDetailsVehicle | null>(null);
  const [drivers, setDrivers] = useState<CoalDetailsDriver[]>([]);
  const [dopoList, setDopoList] = useState<CoalDetailsDoPo[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchCoalDetails = useCallback(
    async (params: { vehNo?: string; doPo?: string; dlNo?: string }) => {
      if (!params.vehNo && !params.doPo) return false;
      setLoadingDetails(true);
      try {
        const data = await getCoalDetails(params);
        const success = data.return?.[0]?.message?.toLowerCase().includes("success");
        if (!success) {
          show("No matching vehicle/DO-PO found. Please check the details.", "warning");
          setVehicle(null);
          setDrivers([]);
          setDopoList([]);
          return false;
        }
        setVehicle(data.vehicle?.[0] ?? null);
        setDrivers(data.driver ?? []);
        setDopoList(data.dopo ?? []);
        return true;
      } catch (err) {
        show(err instanceof Error ? err.message : "Server error, failed to fetch details", "error");
        return false;
      } finally {
        setLoadingDetails(false);
      }
    },
    [show]
  );

  const setScan = useCallback((data: ScanData, raw: string) => {
    setScanData(data);
    setScanRaw(raw);
  }, []);

  const reset = useCallback(() => {
    setScanData(null);
    setScanRaw(null);
    setVehicle(null);
    setDrivers([]);
    setDopoList([]);
  }, []);

  const value = useMemo<CoalChallanContextValue>(
    () => ({
      user,
      scanData,
      scanRaw,
      setScan,
      vehicle,
      drivers,
      dopoList,
      loadingDetails,
      fetchCoalDetails,
      reset,
    }),
    [user, scanData, scanRaw, vehicle, drivers, dopoList, loadingDetails, fetchCoalDetails, setScan, reset]
  );

  return <CoalChallanContext.Provider value={value}>{children}</CoalChallanContext.Provider>;
}

export function useCoalChallan() {
  const ctx = useContext(CoalChallanContext);
  if (!ctx) throw new Error("useCoalChallan must be used within CoalChallanProvider");
  return ctx;
}
