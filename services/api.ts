import {
  CoalChallanPostDetails,
  CoalChallanRequest,
  CoalDetailsData,
  CoalDetailsResponse,
} from "@/types/models";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** Fixed transporter code used across the app - always "MAST" per the backend contract. */
export const TRANS_CODE_MAST = "MAST";

export function createEmptyPostDetails(): CoalChallanPostDetails {
  return {
    gatepassno: "", bukrs: "", werks: "", process: "", subprocess: "", vclreG_NO: "",
    inS_NO: "", insvaliddate: "", fitnessno: "", fiT_EXP_DATE: "", rcno: "", rC_EXP_DATE: "",
    pucno: "", pucexpdate: "", licenceno: "", drivername: "", driveraddress: "", licexpdate: "",
    dhcV_VLD_DT: "", dpoL_VLD_DT: "", dmeD_VLD_DT: "", dksK_VLD_DT: "", adhrno: "", mobilE_NO: "",
    ebeln: "", ebelp: "", mineS_CODE: "", mineS_NAME: "", dO_NO: "", transporter: "", tranS_CODE: "",
    lifnr: "", grade: "", cT_WGHT: "", cG_WGHT: "", cN_WGHT: "", matnr: "", maktx: "", coaL_TYPE: "",
    pO_QTY: "", stepney: "", jack: "", jacK_ROD: "", tooL_BOX: "", tarpuline: "", rasa: "", balti: "", gutkha: "",
    otheR_MATERIAL: "", tP_VLD_DT: "", tP_NO: "", tP_DT: "", lR_NO: "", lR_DT: "",
    imG_1: "", imG_2: "", imG_3: "", imG_4: "",
  };
}

export type AuthLookupResult = {
  success: boolean;
  message: string;
  user: Record<string, unknown> | null;
};

/**
 * Looks up a user by email for login. Response shape is unconfirmed against the live
 * ITMSUsers endpoint, so this tolerates either PascalCase or lowercase envelope keys and
 * either a single user object or a one-item array in "data".
 */
export async function getUserByEmail(email: string): Promise<AuthLookupResult> {
  const res = await fetch(`${BASE_URL}/ITMSUsers/${encodeURIComponent(email)}`);
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, message: text || `Request failed (${res.status})`, user: null };
  }
  if (!parsed || typeof parsed !== "object") {
    return { success: false, message: "Unexpected response from server", user: null };
  }

  const obj = parsed as Record<string, unknown>;
  const successFlag = obj.success ?? obj.Success;
  const rawData = obj.data ?? obj.Data;
  const rawMessage = obj.message ?? obj.Message;
  const message = typeof rawMessage === "string" ? rawMessage : "";
  const user = Array.isArray(rawData)
    ? ((rawData[0] as Record<string, unknown> | undefined) ?? null)
    : ((rawData as Record<string, unknown> | null | undefined) ?? null);

  const success = res.ok && successFlag !== false && !!user;
  return { success, message: message || (success ? "" : "User not found"), user: success ? user : null };
}

/** Looks up vehicle/driver/DO-PO master data for a vehicle no and/or DO-PO no in one call. */
export async function getCoalDetails(params: {
  vehNo?: string;
  doPo?: string;
  dlNo?: string;
}): Promise<CoalDetailsData> {
  const body: CoalChallanRequest = {
    oP_TYPE: "GET",
    tranS_CODE: TRANS_CODE_MAST,
    p_DLNO: params.dlNo ?? "",
    p_VEHNO: params.vehNo ?? "",
    p_DOPO: params.doPo ?? "",
    p_ROLE: "",
    postDetails: createEmptyPostDetails(),
  };
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/GETCOALDETAILS`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): GETCOALDETAILS`);
  }
  const json = (await res.json()) as CoalDetailsResponse;
  return json.data;
}

/**
 * POST /IO_CoalChallan takes the CoalChallan object directly as the body (no wrapper) - the
 * controller builds its own internal param/OP_TYPE="INS" server-side. The live server wraps its
 * response in an envelope, but the shape (and which field carries the real message) has varied
 * between observed responses - sometimes "message" is just the .NET return type name (e.g.
 * "System.String") with the actual text in "data" instead, so this prefers "data" whenever it's
 * present. The envelope's own top-level "success" is NOT trustworthy - it has been observed
 * `true` even alongside "statusCode": 400 and an "error-:..." data string - so real success is
 * decided from the embedded statusCode / the data text's own "success"/"error" prefix first,
 * falling back to the HTTP status only if neither signal is present.
 */
export async function submitCoalChallan(
  postDetails: CoalChallanPostDetails
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postDetails),
  });
  const text = await res.text();
  const { message, success } = interpretSubmitResponse(text, res.ok);
  return {
    success,
    message: message || (success ? "Challan saved successfully" : "Failed to save challan"),
  };
}

function interpretSubmitResponse(text: string, httpOk: boolean): { message: string; success: boolean } {
  if (!text) return { message: "", success: httpOk };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { message: text, success: httpOk && !/^\s*error/i.test(text) };
  }

  if (typeof parsed === "string") {
    return { message: parsed, success: httpOk && !/^\s*error/i.test(parsed) };
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const data = obj.data ?? obj.Data;
    const rawMessage = obj.message ?? obj.Message;
    const statusCode = Number(obj.statusCode ?? obj.StatusCode);
    const message = typeof data === "string" && data.trim() ? data : typeof rawMessage === "string" ? rawMessage : "";

    let success: boolean;
    if (!Number.isNaN(statusCode)) {
      success = statusCode >= 200 && statusCode < 300;
    } else if (/^\s*error/i.test(message)) {
      success = false;
    } else if (/^\s*success/i.test(message)) {
      success = true;
    } else {
      success = httpOk;
    }

    return { message: message || JSON.stringify(parsed), success };
  }

  return { message: text, success: httpOk };
}
