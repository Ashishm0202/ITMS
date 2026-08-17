import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getFieldCI } from "@/lib/object";
import {
  getCoalDetails,
  getDOPObyTransCode,
  getVehicleDetails,
  getVehicleNoList,
} from "@/services/api";
import {
  CoalChallan,
  CoalChallanPostDetails,
  CoalDetailsDoPo,
  CoalDetailsDriver,
  CoalDetailsVehicle,
  ScanData,
  User,
} from "@/types/models";

type SelectOption = { label: string; value: string };

/**
 * The "return" block of GETCOALDETAILS / GETVEHICLE is an array, and it can carry several lines at
 * once - one per sub-lookup the stored procedure ran. A single "success" line anywhere in it means
 * the payload is usable, so the whole array is scanned rather than just row 0. Only when no line
 * reports success does a failing line matter, and an explicit "error" line is the one worth
 * surfacing; the first message is the fallback so a plain "no data found" is not swallowed.
 */
function interpretReturnBlock(rows?: { message: string }[]): { success: boolean; message: string } {
  const messages = (rows ?? [])
    .map((row) => row?.message?.trim())
    .filter((message): message is string => !!message);

  if (messages.some((message) => message.toLowerCase().includes("success"))) {
    return { success: true, message: "" };
  }

  const error = messages.find((message) => message.toLowerCase().includes("error"));
  return { success: false, message: error ?? messages[0] ?? "" };
}

/** Stable identity for a DO-PO master row: a DO No can carry more than one PO line. */
export const dopoMasterKey = (row: Pick<CoalDetailsDoPo, "pO_NUM" | "pO_LIN_ITM">) =>
  `${row.pO_NUM}|${row.pO_LIN_ITM}`;

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
  /** Vehicle-only lookup (no DO-PO needed) - fills the same vehicle/drivers/dopoList state. */
  fetchVehicleDetails: (vehicleNo: string) => Promise<boolean>;
  /** Rows from GETVEHICLECHNG - the vehicles this transporter may raise a change challan for. */
  vehicleNoList: CoalChallanPostDetails[];
  /** vclreG_NO of every row above, deduped, as {label, value} pairs for a SelectField. */
  vehicleNoOptions: SelectOption[];
  loadingVehicleNos: boolean;
  fetchVehicleNoList: (transCode?: string) => Promise<boolean>;

  /**
   * Rows from GETDOPO - every DO-PO open against the transporter code. Kept separate from
   * `dopoList` on purpose: that one comes from GETCOALDETAILS/GETVEHICLE and is scoped to a
   * single vehicle lookup, whereas this is the transporter-wide master list.
   */
  dopoMasterList: CoalDetailsDoPo[];
  /** PO No / line-item options for one DO No, drawn from the master list only. */
  poOptionsForDoNo: (doNo: string) => SelectOption[];
  /** The master row a `dopoMasterKey` value refers to, or undefined if it is not in the list. */
  findDopoMasterRow: (key: string) => CoalDetailsDoPo | undefined;
  loadingDopoMaster: boolean;
  fetchDopoMasterList: (transCode?: string) => Promise<boolean>;

  challanDetails: CoalChallan | null;
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
  const [vehicleNoList, setVehicleNoList] = useState<CoalChallanPostDetails[]>([]);
  const [loadingVehicleNos, setLoadingVehicleNos] = useState(false);
  const [dopoMasterList, setDopoMasterList] = useState<CoalDetailsDoPo[]>([]);
  const [loadingDopoMaster, setLoadingDopoMaster] = useState(false);
  const [challanDetails, setChallanDetails] = useState<CoalChallan | null>(null);

  const fetchCoalDetails = useCallback(
    async (params: { vehNo?: string; doPo?: string; dlNo?: string }) => {
      if (!params.vehNo && !params.doPo) return false;
      setLoadingDetails(true);
      try {
        const result = await getCoalDetails(params);
        // The endpoint answers with a bare string instead of the envelope on a miss/error -
        // that string is the only message worth showing.
        console.log(result);
        
        if (!result.ok) {
          show(result.message, "warning");
          setVehicle(null);
          setDrivers([]);
          setDopoList([]);
          return false;
        }
        const data = result?.data;
        
        const verdict = interpretReturnBlock(data.return);
        if (!verdict.success) {
          show(verdict.message || "No matching details found.", "warning");
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

  const fetchVehicleDetails = useCallback(
    async (vehicleNo: string) => {
      if (!vehicleNo) return false;
      setLoadingDetails(true);
      try {
        const result = await getVehicleDetails(vehicleNo);
        if (!result.ok) {
          // show(result.message, "warning");
          setVehicle(null);
          setDrivers([]);
          setDopoList([]);
          setChallanDetails(null);
          return false;
        }
        const data = result.data;
        const success = data.return?.[0]?.message?.toLowerCase().includes("success");
        if (!success) {
          // show("No matching vehicle found. Please check the vehicle number.", "warning");
          setVehicle(null);
          setDrivers([]);
          setDopoList([]);
          setChallanDetails(null);
          return false;
        }
        setVehicle(data.vehicle?.[0] ?? null);
        setDrivers(data.driver ?? []);
        // GETVEHICLE returns an empty "dopo" block - DO-PO fields stay manual on this path.
        setDopoList(data.dopo ?? []);
        setChallanDetails(data.challan ?? null);
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

  const fetchVehicleNoList = useCallback(
    async (transCode?: string) => {
      // GETVEHICLECHNG is keyed by transporter code - the logged-in user's organization,
      // falling back to the fixed MAST code when the profile carries no organization.
      const code = (transCode || user.ORGANIZATION).trim();
      if (!code) return false;
      setLoadingVehicleNos(true);
      try {
        const result = await getVehicleNoList(code);
        if (!result.success) {
          show(result.message || "No vehicles available for change", "warning");
          setVehicleNoList([]);
          return false;
        }
        setVehicleNoList(result.data);
        return true;
      } catch (err) {
        show(err instanceof Error ? err.message : "Server error, failed to fetch vehicle list", "error");
        setVehicleNoList([]);
        return false;
      } finally {
        setLoadingVehicleNos(false);
      }
    },
    [show, user.ORGANIZATION]
  );

  // The endpoint has returned the same vehicle on more than one row (one per open DO-PO),
  // so dedupe before the list reaches the dropdown.
  const vehicleNoOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SelectOption[] = [];
    for (const row of vehicleNoList) {
      const regNo = (row.vclreG_NO ?? "").trim();
      if (!regNo || seen.has(regNo)) continue;
      seen.add(regNo);
      options.push({ label: regNo, value: regNo });
    }
    return options;
  }, [vehicleNoList]);

  const fetchDopoMasterList = useCallback(
    async (transCode?: string) => {
      // GETDOPO is keyed by transporter code, same as GETVEHICLECHNG.
      const code = (transCode || user.ORGANIZATION).trim();
      if (!code) return false;
      setLoadingDopoMaster(true);
      try {
        const result = await getDOPObyTransCode(code);
        if (!result.success) {
          show(result.message || "No DO-PO available for this transporter", "warning");
          setDopoMasterList([]);
          return false;
        }
        setDopoMasterList(result.data);
        return true;
      } catch (err) {
        show(err instanceof Error ? err.message : "Server error, failed to fetch DO-PO list", "error");
        setDopoMasterList([]);
        return false;
      } finally {
        setLoadingDopoMaster(false);
      }
    },
    [show, user.ORGANIZATION]
  );

  const poOptionsForDoNo = useCallback(
    (doNo: string) => {
      const wanted = doNo.trim();
      if (!wanted) return [];
      return dopoMasterList
        .filter((row) => row.dO_NUM?.trim() === wanted)
        .map((row) => ({
          label: `${row.pO_NUM} - Line ${row.pO_LIN_ITM}`,
          value: dopoMasterKey(row),
        }));
    },
    [dopoMasterList]
  );

  const findDopoMasterRow = useCallback(
    (key: string) => dopoMasterList.find((row) => dopoMasterKey(row) === key),
    [dopoMasterList]
  );

  const reset = useCallback(() => {
    setScanData(null);
    setScanRaw(null);
    setVehicle(null);
    setDrivers([]);
    setDopoList([]);
    setChallanDetails(null);
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
      fetchVehicleDetails,
      vehicleNoList,
      vehicleNoOptions,
      loadingVehicleNos,
      fetchVehicleNoList,
      dopoMasterList,
      poOptionsForDoNo,
      findDopoMasterRow,
      loadingDopoMaster,
      fetchDopoMasterList,
      challanDetails,
    }),
    [
      user,
      scanData,
      scanRaw,
      vehicle,
      drivers,
      dopoList,
      loadingDetails,
      fetchCoalDetails,
      fetchVehicleDetails,
      vehicleNoList,
      vehicleNoOptions,
      loadingVehicleNos,
      fetchVehicleNoList,
      dopoMasterList,
      poOptionsForDoNo,
      findDopoMasterRow,
      loadingDopoMaster,
      fetchDopoMasterList,
      challanDetails,
      setScan,
      reset,
    ]
  );

  return <CoalChallanContext.Provider value={value}>{children}</CoalChallanContext.Provider>;
}

export function useCoalChallan() {
  const ctx = useContext(CoalChallanContext);
  if (!ctx) throw new Error("useCoalChallan must be used within CoalChallanProvider");
  return ctx;
}
