import { getCurrentUser } from "@/lib/authStore";
import { getFieldCI } from "@/lib/object";
import {
  ApiEnvelope,
  CoalChallanPostDetails,
  CoalChallanRequest,
  CoalDetailsData,
  CoalDetailsDoPo,
  CoalDetailsResult,
  GETDOPOResponse,
  ImageUploadRequest,
  ImageResponse,
  VehicleChange,
} from "@/types/models";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** Fixed transporter code used across the app - always "MAST" per the backend contract. */
// export const TRANS_CODE_MAST = "MAST";

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

/**
 * Both coal-details endpoints answer with either the ApiEnvelope or a bare string (a JSON-quoted
 * "error-: ..." / "no data found" text, and occasionally plain text that isn't JSON at all), and
 * the envelope's own "data" has been seen carrying that string in place of the object. This funnels
 * every shape into one result: real data, or a message worth showing the user.
 */
function parseCoalDetailsResponse(text: string, endpoint: string): CoalDetailsResult {
  const fallback = `No details returned by ${endpoint}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: text.trim() || fallback };
  }

  if (typeof parsed === "string") {
    return { ok: false, message: parsed.trim() || fallback };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, message: fallback };
  }

  const obj = parsed as Record<string, unknown>;
  const data = obj.data ?? obj.Data;
  if (data && typeof data === "object") {
    return { ok: true, data: data as CoalDetailsData };
  }

  const message = [data, obj.message ?? obj.Message].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
  );
  return { ok: false, message: message?.trim() ?? fallback };
}

/** Looks up vehicle/driver/DO-PO master data for a vehicle no and/or DO-PO no in one call. */
export async function   getCoalDetails(params: {
  vehNo?: string;
  doPo?: string;
  dlNo?: string;
}): Promise<CoalDetailsResult> {
  const user = getCurrentUser();
  const body: CoalChallanRequest = {
    oP_TYPE: "",
    // AuthUser is an untyped bag and the API has returned both ORGANIZATION and
    // organization, so read it case-insensitively as a string.
    tranS_CODE: getFieldCI(user, "organization"),
    p_DLNO: params.dlNo ?? "",
    p_VEHNO: params.vehNo ?? "",
    p_DOPO: params.doPo ?? "",
    p_ROLE: "",
    postDetails: createEmptyPostDetails(),
  };

  console.log(body);
  
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/GETCOALDETAILS`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Read as text, not res.json() - a non-JSON error body would otherwise throw an opaque
  // parse error and lose the server's own message.
  const text = await res.text();
  const result = parseCoalDetailsResponse(text, "GETCOALDETAILS");
  if (!res.ok && result.ok) {
    throw new Error(`Request failed (${res.status}): GETCOALDETAILS`);
  }
  return result;
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
  // const res = await fetch(`${BASE_URL}/IO_CoalChallan`, {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/POSTDETAILCOAL`, {
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

export async function modifiedCoalChallan(
  postDetails: CoalChallanPostDetails
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/MODIFYCOALDETAILS`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postDetails),
  });
  const text = await res.text();
  const { message, success } = interpretSubmitResponse(text, res.ok);
  return {
    success,
    message: message || (success ? "Challan updated successfully" : "Failed to update challan"),
  };
}

/**
 * GETVEHICLECHNG / GETDOPO answer with the same loose envelope as the other endpoints - PascalCase
 * or lowercase keys, and on failure a bare string in place of the object - so this funnels every
 * shape into one envelope and keeps "data" an array even when the server sends a single object,
 * null, or an error string. The caller names the row type; nothing here inspects the rows.
 */
function parseListEnvelope<T>(text: string, httpOk: boolean, endpoint: string): ApiEnvelope<T[]> {
  const fallback = `No data returned by ${endpoint}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, statusCode: 0, message: text.trim() || fallback, data: [] };
  }

  if (typeof parsed === "string") {
    return { success: false, statusCode: 0, message: parsed.trim() || fallback, data: [] };
  }
  if (!parsed || typeof parsed !== "object") {
    return { success: false, statusCode: 0, message: fallback, data: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const rawData = obj.data ?? obj.Data;
  const rawMessage = obj.message ?? obj.Message;
  const statusCode = Number(obj.statusCode ?? obj.StatusCode);
  const successFlag = obj.success ?? obj.Success;

  const data: T[] = Array.isArray(rawData)
    ? (rawData as T[])
    : rawData && typeof rawData === "object"
      ? [rawData as T]
      : [];

  // "data" carrying a string means the server put its error text there instead of the rows.
  const message = [rawData, rawMessage].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
  );

  const success = !Number.isNaN(statusCode)
    ? statusCode >= 200 && statusCode < 300 && data.length > 0
    : successFlag !== false && httpOk && data.length > 0;

  return {
    success,
    statusCode: Number.isNaN(statusCode) ? 0 : statusCode,
    message: message?.trim() ?? (success ? "" : fallback),
    data,
  };
}

export const getVehicleNoList = async (transCode: string): Promise<VehicleChange> => {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/GETVEHICLECHNG/${encodeURIComponent(transCode)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await res.text();
  const result = parseListEnvelope<CoalChallanPostDetails>(text, res.ok, "GETVEHICLECHNG");
  if (!res.ok && result.success) {
    throw new Error(`Request failed (${res.status}): GETVEHICLECHNG`);
  }
  return result;
};

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


/**
 * Looks up vehicle + driver master data for a single vehicle no - no DO-PO required. Returns the
 * same envelope as GETCOALDETAILS; note the live endpoint sends back an empty "dopo" block, so
 * DO-PO details are not populated by this call.
 */
export async function getVehicleDetails(vehicleNo: string): Promise<CoalDetailsResult> {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/GETVEHICLE/${encodeURIComponent(vehicleNo)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  // The body can only be read once - a second read throws "Already read".
  const text = await res.text();
  const result = parseCoalDetailsResponse(text, "GETVEHICLE");
  if (!res.ok && result.ok) {
    throw new Error(`Request failed (${res.status}): GETVEHICLE`);
  }
  return result;
}

/** Every DO-PO row open against a transporter code - the master list behind the DO/PO dropdowns. */
export const getDOPObyTransCode = async (transCode: string): Promise<GETDOPOResponse> => {
  const res = await fetch(`${BASE_URL}/IO_CoalChallan/GETDOPO/${encodeURIComponent(transCode)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await res.text();
  const result = parseListEnvelope<CoalDetailsDoPo>(text, res.ok, "GETDOPO");
  if (!res.ok && result.success) {
    throw new Error(`Request failed (${res.status}): GETDOPO`);
  }
  return result;
};


// Image upload Api-----
export const uploadImage = async (data: ImageUploadRequest): Promise<ImageResponse> => {
  const res = await fetch(`${BASE_URL}/LocalBucket`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  const result: ImageResponse = text
    ? (JSON.parse(text) as ImageResponse)
    : { success: false, statusCode: res.status, message: "No response from server", data: "" };
  if (!res.ok && result.success) {
    throw new Error(`Request failed (${res.status}): UPLOADIMAGE`);
  }
  return result;
};

export const getImageUrl = async (imageUrl: string) => {
  const res = await fetch(`${BASE_URL}/LocalBucket/ShortenUrl?originalUrl=${encodeURIComponent(imageUrl)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await res.text();
  console.log(text);
  
  const result: ImageResponse = text
    ? (JSON.parse(text) as ImageResponse)
    : { success: false, statusCode: res.status, message: "No response from server", data: "" };
  if (!res.ok && result.success) {
    throw new Error(`Request failed (${res.status}): GETIMAGEURL`);
  }
  return result;
}