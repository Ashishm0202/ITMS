export type User = {
  EMAILID: string;
  ORGANIZATION: string;
  NAME: string;
};

/** Fields parsed out of the pipe-delimited weighbridge QR/barcode payload. */
export type ScanData = {
  tpNo: string;
  tpValidityDateRaw: string; // "M/d/yyyy h:mm:ss tt" or "dd-MM-yyyy HH:mm:ss" as encoded in the QR
  vehicle: string;
  grossWeight: string;
  tareWeight: string;
  netWeight: string;
  coalGrade: string; // e.g. "G12"
  processType: string; // e.g. "Coal"
  minesCode: string;
  doNoRaw: string; // e.g. "1310005288-5300056487"
  doNo: string; // the part before the "-"
};

/**
 * Response shapes for POST IO_CoalChallan/GETCOALDETAILS - field names/casing here mirror the
 * real backend JSON exactly (mixed case is the API's own convention, not a typo).
 */
export type CoalDetailsDriver = {
  dregno: string;
  name: string;
  address: string;
  mobilE_NO: string;
  adhrno: string;
  licexpdate: string;
  hcvexpdate: string;
  polexpdate: string;
  medexpdate: string;
  kskexpdate: string;
};

export type CoalDetailsVehicle = {
  regno: string;
  inS_NO: string;
  insvaliddate: string;
  pucno: string;
  pucexpdate: string;
  fitnessno: string;
  fiT_EXP_DATE: string;
  rcno: string;
  rC_EXP_DATE: string;
  transporter: string;
};

export type CoalDetailsDoPo = {
  dO_NUM: string;
  pO_NUM: string;
  pO_LIN_ITM: string;
  bukrs: string;
  plant: string;
  materI_NUM: string;
  mateR_DESC: string;
  mineS_CODE: string;
  mineS_NAME: string;
  grade: string;
  coaL_TYPE: string;
  pO_QUAN: string;
  tranS_CODE: string;
  tranS_NAM: string;
  lifnr: string;
};

export type CoalDetailsData = {
  driver: CoalDetailsDriver[];
  e_DLNO: string;
  vehicle: CoalDetailsVehicle[];
  dopo: CoalDetailsDoPo[];
  return: { message: string }[];
};

/** Generic envelope shape used across the IO_CoalChallan API. */
export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
};

export type CoalDetailsResponse = ApiEnvelope<CoalDetailsData>;

/** The "postDetails" sub-object posted to IO_CoalChallan - field casing mirrors the API exactly. */
export type CoalChallanPostDetails = {
  gatepassno: string;
  bukrs: string;
  werks: string;
  process: string;
  subprocess: string;
  vclreG_NO: string;
  inS_NO: string;
  insvaliddate: string;
  fitnessno: string;
  fiT_EXP_DATE: string;
  rcno: string;
  rC_EXP_DATE: string;
  pucno: string;
  pucexpdate: string;
  licenceno: string;
  drivername: string;
  driveraddress: string;
  licexpdate: string;
  dhcV_VLD_DT: string;
  dpoL_VLD_DT: string;
  dmeD_VLD_DT: string;
  dksK_VLD_DT: string;
  adhrno: string;
  mobilE_NO: string;
  ebeln: string;
  ebelp: string;
  mineS_CODE: string;
  mineS_NAME: string;
  dO_NO: string;
  transporter: string;
  tranS_CODE: string;
  lifnr: string;
  grade: string;
  cT_WGHT: string;
  cG_WGHT: string;
  cN_WGHT: string;
  matnr: string;
  maktx: string;
  coaL_TYPE: string;
  pO_QTY: string;
  stepney: string;
  jack: string;
  jacK_ROD: string;
  tooL_BOX: string;
  tarpuline: string;
  rasa: string;
  balti: string;
  gutkha: string;
  otheR_MATERIAL: string;
  tP_VLD_DT: string;
  tP_NO: string;
  tP_DT: string;
  lR_NO: string;
  lR_DT: string;
  imG_1: string;
  imG_2: string;
  imG_3: string;
  imG_4: string;
};

/** The full request body posted to both GETCOALDETAILS (lookup) and IO_CoalChallan (submit). */
export type CoalChallanRequest = {
  oP_TYPE: string;
  tranS_CODE: string;
  p_DLNO: string;
  p_VEHNO: string;
  p_DOPO: string;
  p_ROLE: string;
  postDetails: CoalChallanPostDetails;
};
