import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { LabeledInput } from "@/components/ui/LabeledInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SelectField } from "@/components/ui/SelectField";
import { useCoalChallan } from "@/context/CoalChallanContext";
import { useToast } from "@/context/ToastContext";
import { formatDateForApi, formatYyyyMmDd, parseMasterDate } from "@/lib/date";
import { absoluteUrl, buildFolderName, toUploadRequest, validateFolderName } from "@/lib/imageUpload";
import { parseSubmitMessage } from "@/lib/submitMessage";
import {
  aadharNoError,
  expiryError,
  isExpired,
  isFutureDate,
  isPositiveNumber,
  isValidAadharNo,
  isValidMobileNo,
  mobileNoError,
} from "@/lib/validation";
import { getImageUrl, modifiedCoalChallan, uploadImage } from "@/services/api";
import { CoalChallanPostDetails, CoalDetailsDriver, ImageResponse } from "@/types/models";

// Keys match each photo's on-screen label so the payload's imG_1..4 mapping stays traceable.
type ChallanImages = {
  transitPass: string | null;
  mclWeighment: string | null;
  transporterChallan: string | null;
  ewayBill: string | null;
};
const emptyImages = (): ChallanImages => ({
  transitPass: null,
  mclWeighment: null,
  transporterChallan: null,
  ewayBill: null,
});

/** Per-photo upload flags/errors, keyed the same way as ChallanImages. */
type ImageFlags = Partial<Record<keyof ChallanImages, boolean>>;
type ImageErrors = Partial<Record<keyof ChallanImages, string>>;

/** Photo keys in on-screen order, paired with the payload field each one feeds. */
const PHOTO_FIELDS: [keyof ChallanImages, keyof CoalChallanPostDetails, string][] = [
  ["transitPass", "imG_1", "Transit Pass"],
  ["mclWeighment", "imG_2", "MCL Weighment-cum-Challan"],
  ["transporterChallan", "imG_3", "Transporter Delivery Challan"],
  ["ewayBill", "imG_4", "E-Way Bill"],
];

/** The existing challan's imG_1..4, mapped back onto the photo keys. Blank fields stay null. */
function imagesFromRow(row: CoalChallanPostDetails): ChallanImages {
  const next = emptyImages();
  for (const [key, field] of PHOTO_FIELDS) {
    const stored = row[field]?.trim();
    next[key] = stored ? stored : null;
  }
  return next;
}

type VehicleForm = {
  regNo: string;
  rcNo: string;
  rcExpDate: Date | null;
  fitnessNo: string;
  fitExpDate: Date | null;
  insNo: string;
  insValidDate: Date | null;
  pucNo: string;
  pucExpDate: Date | null;
};

type DriverForm = {
  licenceNo: string;
  name: string;
  address: string;
  licExpDate: Date | null;
  medExpDate: Date | null;
  kskExpDate: Date | null;
  hcvExpDate: Date | null;
  polExpDate: Date | null;
  mobileNo: string;
  adhrNo: string;
};

type DoPoForm = {
  doNo: string;
  poNo: string;
  poLineItem: string;
  plant: string;
  materialNo: string;
  materialDesc: string;
  minesCode: string;
  minesName: string;
  coalType: string;
  companyCode: string;
  vendorCode: string;
  poQty: string;
};

const emptyVehicleForm = (): VehicleForm => ({
  regNo: "", rcNo: "", rcExpDate: null, fitnessNo: "", fitExpDate: null,
  insNo: "", insValidDate: null, pucNo: "", pucExpDate: null,
});

const emptyDriverForm = (): DriverForm => ({
  licenceNo: "", name: "", address: "", licExpDate: null, medExpDate: null,
  kskExpDate: null, hcvExpDate: null, polExpDate: null, mobileNo: "", adhrNo: "",
});

const emptyDoPoForm = (): DoPoForm => ({
  doNo: "", poNo: "", poLineItem: "", plant: "", materialNo: "", materialDesc: "",
  minesCode: "", minesName: "", coalType: "Coal", companyCode: "", vendorCode: "", poQty: "",
});

const CURRENT_YEAR_START = new Date(new Date().getFullYear(), 0, 1);

/** Loose registration-number shape - letters/digits only, no separators, e.g. OD35E4339. */
const VEHICLE_NO_PATTERN = /^[A-Z0-9]{6,15}$/;

/** Rounding slack allowed on "net = gross - tare", in MT. */
const WEIGHT_TOLERANCE_MT = 0.05;

/** Breathing room under the Submit button, before the device's bottom inset is added on top. */
const SCROLL_BOTTOM_PADDING = 32;

export default function PreviewChallanScreen() {
  const {
    user,
    vehicle,
    drivers,
    loadingDetails,
    fetchVehicleDetails,
    reset,
    vehicleNoList,
    vehicleNoOptions,
    loadingVehicleNos,
    fetchVehicleNoList,
    poOptionsForDoNo,
    findDopoMasterRow,
    loadingDopoMaster,
    fetchDopoMasterList,
    challanDetails,
  } = useCoalChallan();
  const { show } = useToast();
  // The hero owns the top inset via SafeAreaView; the scroll content has to carry the bottom one,
  // otherwise the Submit button sits under the home indicator / gesture bar.
  const insets = useSafeAreaInsets();

  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm());
  const [driverForm, setDriverForm] = useState<DriverForm>(emptyDriverForm());
  const [doPoForm, setDoPoForm] = useState<DoPoForm>(emptyDoPoForm());
  const [driverLocked, setDriverLocked] = useState(false);
  /** Shown when the vehicle lookup returns nothing for the selected number. */
  const [vehicleAlert, setVehicleAlert] = useState(false);
  /** Validation toast held back until that dialog is dismissed. */
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [doPoLocked, setDoPoLocked] = useState(false);
  const [selectedDoPoKey, setSelectedDoPoKey] = useState("");

  /**
   * Gatepass no of the challan being changed, carried over from the selected vehicle's
   * GETVEHICLECHNG row - MODIFYCOALDETAILS needs it to know which challan to update.
   */
  const [existingGatepassNo, setExistingGatepassNo] = useState("");

  const [tpNo, setTpNo] = useState("");
  /** True only while TP No holds a value GETVEHICLE's "challan" block supplied. */
  const [tpNoLocked, setTpNoLocked] = useState(false);
  const [tpDate, setTpDate] = useState<Date | null>(null);
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState<Date | null>(null);
  const [grossWeight, setGrossWeight] = useState("");
  const [tareWeight, setTareWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [coalGrade, setCoalGrade] = useState("");
  const [tpValidity, setTpValidity] = useState<Date | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  /**
   * What the thumbnails render - the URL ShortenUrl resolved for a prefilled photo, or a local data
   * URI after a re-pick. Never submitted.
   */
  const [images, setImages] = useState<ChallanImages>(emptyImages());
  /** What imG_1..4 carry - the existing challan's bucket path, or the path a re-pick stored to. */
  const [imagePaths, setImagePaths] = useState<ChallanImages>(emptyImages());
  const [imageUploading, setImageUploading] = useState<ImageFlags>({});
  const [imageErrors, setImageErrors] = useState<ImageErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<
    { type: "success" | "error"; message: string; gatepassNo: string | null } | null
  >(null);

  /**
   * Re-picking a photo previews it locally and pushes it to the bucket - the response's "data" is
   * the stored path, which replaces whatever imG_1..4 carried for this slot. ShortenUrl is called
   * after that purely as a check that the stored image is retrievable; its URL is logged, not
   * submitted. The field key doubles as the file name stem, so the bucket path reads
   * "QRChallan/transitPass<yyyymmdd><mm><ss>.png".
   */
  async function onPickImage(key: keyof ChallanImages, dataUri: string | null) {
    setImages((prev) => ({ ...prev, [key]: dataUri }));
    // The prefilled path no longer describes what is on screen.
    setImagePaths((prev) => ({ ...prev, [key]: null }));
    setImageErrors((prev) => ({ ...prev, [key]: undefined }));
    if (!dataUri) return;

    const folderName = buildFolderName(key, new Date());
    const invalid = validateFolderName(folderName);
    if (invalid) {
      setImageErrors((prev) => ({ ...prev, [key]: invalid }));
      return;
    }

    setImageUploading((prev) => ({ ...prev, [key]: true }));
    try {
      console.log(`[preview-challan] uploading ${key} to bucket path "${folderName}"...`);

      const uploaded: ImageResponse = await uploadImage(toUploadRequest(dataUri, folderName));
      if (!uploaded.success || !uploaded.data) {
        setImageErrors((prev) => ({ ...prev, [key]: uploaded.message || "Upload failed" }));
        return;
      }

      console.log(`[preview-challan] resolving viewable URL for ${key} path: ${uploaded.data}`);

      const viewable: ImageResponse = await getImageUrl(uploaded.data);
      if (!viewable.success || !viewable.data) {
        setImageErrors((prev) => ({
          ...prev,
          [key]: viewable.message || "Could not resolve the image URL",
        }));
        return;
      }

      console.log(`[preview-challan] viewable ${key} URL: ${absoluteUrl(viewable.data)}`);

      // The bucket path, not the resolved URL - that is what the backend expects in imG_1..4.
      setImagePaths((prev) => ({ ...prev, [key]: uploaded.data }));
    } catch (e) {
      setImageErrors((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : "Upload failed" }));
    } finally {
      setImageUploading((prev) => ({ ...prev, [key]: false }));
    }
  }

  useEffect(() => {
    // This screen is manual-entry only - guarantee a blank form even if stale vehicle/driver
    // data from a previous session lingers in context.
    setVehicleForm(emptyVehicleForm());
    setDriverForm(emptyDriverForm());
    setDoPoForm(emptyDoPoForm());
    setDriverLocked(false);
    setDoPoLocked(false);
    setSelectedDoPoKey("");
    setExistingGatepassNo("");
    setTpNo("");
    setTpNoLocked(false);
    setTpDate(null);
    setLrNo("");
    setLrDate(null);
    setGrossWeight("");
    setTareWeight("");
    setNetWeight("");
    setCoalGrade("");
    setTpValidity(null);
    setImages(emptyImages());
    setImagePaths(emptyImages());
    setImageUploading({});
    setImageErrors({});
    setSubmitted(false);
    reset();
    // Only run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the transporter's vehicle numbers and DO-PO master list for the dropdowns. Both
  // callbacks are only re-created when the user's organization resolves, so this refetches
  // once auth lands.
  useEffect(() => {
    fetchVehicleNoList();
  }, [fetchVehicleNoList]);

  useEffect(() => {
    fetchDopoMasterList();
  }, [fetchDopoMasterList]);

  useEffect(() => {
    if (!vehicle) return;
    setVehicleForm((prev) => ({
      ...prev,
      regNo: vehicle.regno || prev.regNo,
      rcNo: vehicle.rcno,
      rcExpDate: parseMasterDate(vehicle.rC_EXP_DATE),
      fitnessNo: vehicle.fitnessno,
      fitExpDate: parseMasterDate(vehicle.fiT_EXP_DATE),
      insNo: vehicle.inS_NO,
      insValidDate: parseMasterDate(vehicle.insvaliddate),
      pucNo: vehicle.pucno,
      pucExpDate: parseMasterDate(vehicle.pucexpdate),
    }));
  }, [vehicle]);

  useEffect(() => {
    // TP No / TP Date and the photo paths all come from GETVEHICLE's "challan" block, not the
    // GETVEHICLECHNG row that feeds the rest of Trip Details. The block can hold several rows with
    // only one of them carrying the transit-pass fields, so search for that row instead of taking
    // index 0: prefer a row with a TP No, else settle for one with a real TP date ("00000000" is
    // the backend's "not set" placeholder, which parseMasterDate reads as null).
    const rows = challanDetails ?? [];
    const challan =
      rows.find((row) => !!row?.tP_NO?.trim()) ?? rows.find((row) => !!parseMasterDate(row?.tP_DT));

      console.log(challan);

    setTpNo(challan?.tP_NO ?? "");
    // Read-only when a row actually carried a TP No; hand-entered when none did.
    setTpNoLocked(!!challan?.tP_NO?.trim());
    setTpDate(parseMasterDate(challan?.tP_DT));

    // -- Photos --
    // The row that carried TP No carries imG_1..4 too, as the bucket paths the create screen
    // stored. Those paths are what the payload sends back for any photo the user does not re-pick,
    // but they are not renderable - each one has to go through ShortenUrl first, below.
    const stored = challan ? imagesFromRow(challan) : emptyImages();
    setImagePaths(stored);
    setImages(emptyImages());
    setImageErrors({});

    const pending = PHOTO_FIELDS.filter(([key]) => !!stored[key]);
    if (!pending.length) {
      setImageUploading({});
      return;
    }
    // Reuses the per-photo busy flag, so each slot shows a spinner until its URL lands.
    setImageUploading(pending.reduce<ImageFlags>((acc, [key]) => ({ ...acc, [key]: true }), {}));

    // A newly selected vehicle re-runs this effect; anything still in flight for the previous one
    // must not land on the new photos.
    let cancelled = false;
    for (const [key, , label] of pending) {
      const path = stored[key] as string;
      (async () => {
        try {
          console.log(`[preview-challan] resolving viewable URL for stored ${key} path: ${path}`);

          const viewable: ImageResponse = await getImageUrl(path);
          if (cancelled) return;
          if (!viewable.success || !viewable.data) {
            setImageErrors((prev) => ({
              ...prev,
              [key]: viewable.message || `Could not load the stored ${label} photo`,
            }));
            return;
          }

          console.log(`[preview-challan] stored ${key} URL: ${absoluteUrl(viewable.data)}`);

          setImages((prev) => ({ ...prev, [key]: absoluteUrl(viewable.data) }));
        } catch (e) {
          if (cancelled) return;
          setImageErrors((prev) => ({
            ...prev,
            [key]: e instanceof Error ? e.message : `Could not load the stored ${label} photo`,
          }));
        } finally {
          if (!cancelled) setImageUploading((prev) => ({ ...prev, [key]: false }));
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [challanDetails]);

  /**
   * PO No / line-item choices for the DO No currently in the form, taken from the GETDOPO master
   * list. Deliberately NOT the context's `dopoList` - that one is filled by GETCOALDETAILS /
   * GETVEHICLE and is scoped to a single vehicle lookup.
   */
  const doPoOptions = useMemo(
    () => poOptionsForDoNo(doPoForm.doNo),
    [poOptionsForDoNo, doPoForm.doNo]
  );

  function onSelectDoPo(key: string) {
    const match = findDopoMasterRow(key);
    if (!match) return;
    setDoPoForm((prev) => ({
      ...prev,
      doNo: match.dO_NUM || prev.doNo,
      poNo: match.pO_NUM,
      poLineItem: match.pO_LIN_ITM,
      plant: match.plant,
      materialNo: match.materI_NUM,
      materialDesc: match.mateR_DESC,
      minesCode: match.mineS_CODE,
      minesName: match.mineS_NAME,
      coalType: match.coaL_TYPE || prev.coalType,
      companyCode: match.bukrs,
      vendorCode: match.lifnr,
      poQty: match.pO_QUAN,
    }));
    setSelectedDoPoKey(key);
    setDoPoLocked(true);
  }

  useEffect(() => {
    // A new DO No means a new PO list, which invalidates whatever was picked before. Auto-select
    // when the DO No leaves only one PO line, otherwise make the user choose.
    if (doPoOptions.length === 1) {
      onSelectDoPo(doPoOptions[0].value);
    } else if (!doPoOptions.some((o) => o.value === selectedDoPoKey)) {
      setDoPoLocked(false);
      setSelectedDoPoKey("");
    }
    // Only react when the DO No (or the master list behind it) changes the available options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doPoOptions]);

  const driverOptions = useMemo(
    () => drivers.map((d) => ({ label: `${d.dregno} - ${d.name}`, value: d.dregno })),
    [drivers]
  );

  function applyDriver(match: CoalDetailsDriver) {
    setDriverForm({
      licenceNo: match.dregno,
      name: match.name,
      address: match.address,
      licExpDate: parseMasterDate(match.licexpdate),
      medExpDate: parseMasterDate(match.medexpdate),
      kskExpDate: parseMasterDate(match.kskexpdate),
      hcvExpDate: parseMasterDate(match.hcvexpdate),
      polExpDate: parseMasterDate(match.polexpdate),
      mobileNo: match.mobilE_NO,
      adhrNo: match.adhrno,
    });
    setDriverLocked(true);
  }

  function onSelectDriver(dregno: string) {
    const match = drivers.find((d) => d.dregno === dregno);
    if (!match) return;
    applyDriver(match);
  }

  useEffect(() => {
    // Driver Details defaults to the vehicle's first driver; the dropdown still lets the user
    // switch to any of the others. Only re-runs when a new lookup brings in a new driver list,
    // so it never overwrites a manual pick.
    if (!drivers.length) return;
    applyDriver(drivers[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers]);

  function setVehicleField<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setVehicleForm((prev) => ({ ...prev, [key]: value }));
  }

  function setDoPoField<K extends keyof DoPoForm>(key: K, value: DoPoForm[K]) {
    setDoPoForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * GETVEHICLECHNG returns each vehicle's existing challan as a CoalChallanPostDetails row, so
   * picking a vehicle number prefills the DO-PO and Trip Details sections straight from that row -
   * this mapping is the exact inverse of the payload built in onSubmit. Selecting also kicks off
   * the GETVEHICLE lookup, which is what fills the Vehicle and Driver sections plus TP No / TP
   * Date and the photos from its "challan" block.
   */
  async function onSelectVehicleNo(regNo: string) {
    setVehicleField("regNo", regNo);

    // The previous vehicle's photos are stale immediately; the lookup below refills them from the
    // "challan" block rather than from the GETVEHICLECHNG row.
    setImages(emptyImages());
    setImagePaths(emptyImages());
    setImageUploading({});
    setImageErrors({});

    const row = vehicleNoList.find((r) => r.vclreG_NO?.trim() === regNo);
    if (!row) {
      setExistingGatepassNo("");
    } else {
      setExistingGatepassNo(row.gatepassno ?? "");

      // -- DO-PO --
      setDoPoForm((prev) => ({
        doNo: row.dO_NO,
        poNo: row.ebeln,
        poLineItem: row.ebelp,
        plant: row.werks,
        materialNo: row.matnr,
        materialDesc: row.maktx,
        minesCode: row.mineS_CODE,
        minesName: row.mineS_NAME,
        coalType: row.coaL_TYPE || prev.coalType,
        companyCode: row.bukrs,
        vendorCode: row.lifnr,
        poQty: row.pO_QTY,
      }));

      // -- Trip Details --
      // TP No / TP Date are deliberately absent here - they come from GETVEHICLE's "challan"
      // block instead, in the effect below.
      setLrNo(row.lR_NO);
      setLrDate(parseMasterDate(row.lR_DT));
      setGrossWeight(row.cG_WGHT);
      setTareWeight(row.cT_WGHT);
      setNetWeight(row.cN_WGHT);
      setCoalGrade(row.grade);
      setTpValidity(parseMasterDate(row.tP_VLD_DT));
    }

    // GETVEHICLE is what fills Vehicle Details (and Driver Details). When it comes back empty the
    // vehicle is not on the master, so clear whatever the previous selection left behind rather
    // than leaving stale data on screen; Submit is where the user gets told about it.
    const found = await fetchVehicleDetails(regNo.trim().toUpperCase());
    if (!found) {
      setVehicleForm({ ...emptyVehicleForm(), regNo });
      setDriverForm(emptyDriverForm());
      setDriverLocked(false);
    }
  }

  function onBack() {
    reset();
    router.back();
  }

  /**
   * Every field on the screen, validated in on-screen order so the toast can name the first
   * problem the user will actually scroll to. Keys match the FIELD_* ids used by the inputs.
   */
  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    // -- Vehicle Number --
    const regNo = vehicleForm.regNo.trim();
    if (!regNo) e.regNo = "Vehicle number is required";
    else if (!VEHICLE_NO_PATTERN.test(regNo)) e.regNo = "Enter a valid vehicle number (6-15 letters/digits)";

    // -- DO-PO --
    if (!doPoForm.doNo.trim()) e.doNo = "DO No is required";
    // The dropdown only constrains input when a lookup actually returned options.
    if (doPoOptions.length > 0 && !selectedDoPoKey) e.doPoSelect = "Select a PO / line item";
    if (!doPoForm.poNo.trim()) e.poNo = "PO No is required";
    if (!doPoForm.poLineItem.trim()) e.poLineItem = "PO Line Item is required";
    if (!doPoForm.plant.trim()) e.plant = "Plant is required";
    if (!doPoForm.materialNo.trim()) e.materialNo = "Material No is required";
    if (!doPoForm.materialDesc.trim()) e.materialDesc = "Material Desc is required";
    if (!doPoForm.minesCode.trim()) e.minesCode = "Mines Code is required";
    if (!doPoForm.coalType.trim()) e.coalType = "Type is required";
    if (!doPoForm.companyCode.trim()) e.companyCode = "Company Code is required";
    if (!doPoForm.vendorCode.trim()) e.vendorCode = "Vendor Code is required";
    if (!doPoForm.poQty.trim()) e.poQty = "PO Quantity is required";
    else if (!isPositiveNumber(doPoForm.poQty)) e.poQty = "PO Quantity must be a number greater than 0";

    // -- Trip Details --
    if (!tpNo.trim()) e.tpNo = "TP No is required";
    if (!tpDate) e.tpDate = "TP Date is required";
    else if (isFutureDate(tpDate)) e.tpDate = "TP Date cannot be in the future";
    if (!lrNo.trim()) e.lrNo = "LR No is required";
    if (!lrDate) e.lrDate = "LR Date is required";
    else if (isFutureDate(lrDate)) e.lrDate = "LR Date cannot be in the future";

    if (!grossWeight.trim()) e.grossWeight = "Gross weight is required";
    else if (!isPositiveNumber(grossWeight)) e.grossWeight = "Gross must be a number greater than 0";
    if (!tareWeight.trim()) e.tareWeight = "Tare weight is required";
    else if (!isPositiveNumber(tareWeight)) e.tareWeight = "Tare must be a number greater than 0";
    if (!netWeight.trim()) e.netWeight = "Net weight is required";
    else if (!isPositiveNumber(netWeight)) e.netWeight = "Net must be a number greater than 0";
    if (!e.grossWeight && !e.tareWeight && !e.netWeight) {
      const gross = Number(grossWeight);
      const tare = Number(tareWeight);
      const net = Number(netWeight);
      if (tare >= gross) e.tareWeight = "Tare must be less than gross";
      else if (Math.abs(gross - tare - net) > WEIGHT_TOLERANCE_MT) {
        e.netWeight = `Net should be gross - tare (${(gross - tare).toFixed(3)})`;
      }
    }

    if (!coalGrade.trim()) e.coalGrade = "Coal Grade is required";
    if (!tpValidity) e.tpValidity = "TP Validity Date is required";
    else if (isExpired(tpValidity)) e.tpValidity = "TP validity has expired";

    // -- Vehicle Details --
    if (!vehicleForm.rcNo.trim()) e.rcNo = "RC No is required";
    if (!vehicleForm.rcExpDate) e.rcExpDate = "RC Expiry is required";
    else if (isExpired(vehicleForm.rcExpDate)) e.rcExpDate = "RC has expired";
    if (!vehicleForm.fitnessNo.trim()) e.fitnessNo = "Fitness No is required";
    if (!vehicleForm.fitExpDate) e.fitExpDate = "Fitness Expiry is required";
    else if (isExpired(vehicleForm.fitExpDate)) e.fitExpDate = "Fitness has expired";
    if (!vehicleForm.insNo.trim()) e.insNo = "Insurance No is required";
    if (!vehicleForm.insValidDate) e.insValidDate = "Insurance Expiry is required";
    else if (isExpired(vehicleForm.insValidDate)) e.insValidDate = "Insurance has expired";
    if (!vehicleForm.pucNo.trim()) e.pucNo = "PUC No is required";
    if (!vehicleForm.pucExpDate) e.pucExpDate = "PUC Expiry is required";
    else if (isExpired(vehicleForm.pucExpDate)) e.pucExpDate = "PUC has expired";

    // -- Driver Details --
    if (!driverForm.licenceNo.trim()) e.licenceNo = "DL No is required";
    if (!driverForm.name.trim()) e.driverName = "Driver Name is required";
    if (!driverForm.address.trim()) e.driverAddress = "Address is required";
    if (!driverForm.licExpDate) e.licExpDate = "License Expiry is required";
    else if (isExpired(driverForm.licExpDate)) e.licExpDate = "License has expired";
    if (!driverForm.medExpDate) e.medExpDate = "Medical Expiry is required";
    else if (isExpired(driverForm.medExpDate)) e.medExpDate = "Medical certificate has expired";
    if (!driverForm.kskExpDate) e.kskExpDate = "Kiosk Expiry is required";
    else if (isExpired(driverForm.kskExpDate)) e.kskExpDate = "Kiosk certificate has expired";
    if (!driverForm.hcvExpDate) e.hcvExpDate = "HCV Expiry is required";
    else if (isExpired(driverForm.hcvExpDate)) e.hcvExpDate = "HCV license has expired";
    if (!driverForm.polExpDate) e.polExpDate = "Police Verification Expiry is required";
    else if (isExpired(driverForm.polExpDate)) e.polExpDate = "Police verification has expired";
    if (!driverForm.mobileNo.trim()) e.mobileNo = "Mobile No is required";
    else if (!isValidMobileNo(driverForm.mobileNo)) e.mobileNo = "Mobile number must be 10 digits";
    if (!driverForm.adhrNo.trim()) e.adhrNo = "Aadhar No is required";
    else if (!isValidAadharNo(driverForm.adhrNo)) e.adhrNo = "Aadhar number must be 12 digits";

    // -- Photos --
    // Keyed off the paths, not the thumbnails: a re-picked photo whose upload is still running or
    // failed has a preview but nothing the payload can carry.
    for (const [key, , label] of PHOTO_FIELDS) {
      if (imagePaths[key]) continue;
      if (imageUploading[key]) e[key] = `The ${label} photo is still uploading`;
      else if (images[key]) e[key] = "Upload failed - please re-attach";
      else e[key] = "Required";
    }

    return e;
  }, [
    vehicleForm,
    driverForm,
    doPoForm,
    doPoOptions,
    selectedDoPoKey,
    tpNo,
    tpDate,
    lrNo,
    lrDate,
    grossWeight,
    tareWeight,
    netWeight,
    coalGrade,
    tpValidity,
    images,
    imagePaths,
    imageUploading,
  ]);

  /** Required-field messages stay quiet until the first submit attempt; format/expiry show live. */
  function fieldError(key: string): string | undefined {
    return submitted ? errors[key] : undefined;
  }

  console.log(imagePaths);

  /**
   * True when the Vehicle Details card renders blank. Checked on the form rather than on the
   * `vehicle` object, because GETVEHICLE also answers "success" with a row whose fields are all
   * empty - the card looks just as empty then as it does after an outright miss.
   */
  const vehicleDetailsEmpty = useMemo(
    () =>
      !vehicleForm.rcNo.trim() &&
      !vehicleForm.fitnessNo.trim() &&
      !vehicleForm.insNo.trim() &&
      !vehicleForm.pucNo.trim() &&
      !vehicleForm.rcExpDate &&
      !vehicleForm.fitExpDate &&
      !vehicleForm.insValidDate &&
      !vehicleForm.pucExpDate,
    [vehicleForm]
  );

  /** The first validation problem, worded for the toast - null when the form is clean. */
  function validationWarning(): string | null {
    const messages = Object.values(errors);
    if (!messages.length) return null;
    const more = messages.length > 1 ? ` (+${messages.length - 1} more)` : "";
    return `${messages[0]}${more}`;
  }

  function showValidationWarning(message: string) {
    show(message, "warning");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  /** OK on the vehicle dialog - the field errors and the queued toast follow it. */
  function onVehicleAlertDismiss() {
    setVehicleAlert(false);
    // Held back until now so the dialog is the only thing on screen while it is up.
    setSubmitted(true);
    if (!pendingWarning) return;
    showValidationWarning(pendingWarning);
    setPendingWarning(null);
  }

  async function onSubmit() {
    const warning = validationWarning();

    // A number was picked but GETVEHICLE had no record for it, so Vehicle Details is empty and
    // there is nothing to change. The dialog goes up alone - the red field errors and the toast
    // only appear once the user taps OK, so the two never land on top of each other.
    if (vehicleForm.regNo.trim() && vehicleDetailsEmpty) {
      setPendingWarning(warning);
      setVehicleAlert(true);
      return;
    }

    setSubmitted(true);
    if (warning) {
      showValidationWarning(warning);
      return;
    }
    // Narrowing only - the errors map above already guarantees a TP validity date.
    if (!tpValidity) return;
    setBusy(true);
    try {
      const postDetails: CoalChallanPostDetails = {
        gatepassno: existingGatepassNo,
        bukrs: doPoForm.companyCode,
        werks: doPoForm.plant,
        process: "INWARD",
        subprocess: "COAL",

        vclreG_NO: vehicleForm.regNo,
        inS_NO: vehicleForm.insNo,
        insvaliddate: formatDateForApi(vehicleForm.insValidDate),
        fitnessno: vehicleForm.fitnessNo,
        fiT_EXP_DATE: formatDateForApi(vehicleForm.fitExpDate),
        rcno: vehicleForm.rcNo,
        rC_EXP_DATE: formatDateForApi(vehicleForm.rcExpDate),
        pucno: vehicleForm.pucNo,
        pucexpdate: formatDateForApi(vehicleForm.pucExpDate),
        licenceno: driverForm.licenceNo,
        drivername: driverForm.name,
        driveraddress: driverForm.address,
        licexpdate: formatDateForApi(driverForm.licExpDate),
        dhcV_VLD_DT: formatDateForApi(driverForm.hcvExpDate),
        dpoL_VLD_DT: formatDateForApi(driverForm.polExpDate),
        
        dmeD_VLD_DT: formatDateForApi(driverForm.medExpDate),
        dksK_VLD_DT: formatDateForApi(driverForm.kskExpDate),
        adhrno: driverForm.adhrNo,
        mobilE_NO: driverForm.mobileNo,
        ebeln: doPoForm.poNo,
        ebelp: doPoForm.poLineItem,
        mineS_CODE: doPoForm.minesCode,
        mineS_NAME: doPoForm.minesName,
        dO_NO: doPoForm.doNo,
        transporter: user.ORGANIZATION,
        tranS_CODE: user.ORGANIZATION,
        lifnr: doPoForm.vendorCode,
        grade: coalGrade,
        cT_WGHT: tareWeight,
        cG_WGHT: grossWeight,
        cN_WGHT: netWeight,
        matnr: doPoForm.materialNo,
        maktx: doPoForm.materialDesc,
        coaL_TYPE: doPoForm.coalType,
        pO_QTY: doPoForm.poQty,
        stepney: "0",
        jack: "0",
        jacK_ROD: "0",
        tooL_BOX: "0",
        tarpuline: "0",
        rasa: "0",
        balti: "0",
        gutkha: "0",
        otheR_MATERIAL: "0",
        tP_VLD_DT: formatYyyyMmDd(tpValidity),
        tP_NO: tpNo,
        tP_DT: formatDateForApi(tpDate),
        lR_NO: lrNo,
        lR_DT: formatDateForApi(lrDate),
        // Either the path the existing challan came with, or the one a re-picked photo stored to.
        imG_1: imagePaths.transitPass ?? "",
        imG_2: imagePaths.mclWeighment ?? "",
        imG_3: imagePaths.transporterChallan ?? "",
        imG_4: imagePaths.ewayBill ?? "",
      };

      console.log("[coal-challan] submitting postDetails:", JSON.stringify(postDetails, null, 2));
      const apiResult = await modifiedCoalChallan(postDetails);
      const { summary, gatepassNo } = parseSubmitMessage(apiResult.message);
      setResult({
        type: apiResult.success ? "success" : "error",
        message: apiResult.success ? "Your challan has been updated successfully." : summary,
        gatepassNo,
      });
    } catch {
      setResult({ type: "error", message: "Server error, failed to submit data", gatepassNo: null });
    } finally {
      setBusy(false);
    }
  }

  function onDialogPrimaryPress() {
    if (result?.type === "success") {
      setResult(null);
      reset();
      router.back();
    } else {
      setResult(null);
    }
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#1E88E5", "#125EA6"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroRow}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                Coal Challan Change
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: SCROLL_BOTTOM_PADDING + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <Card accentColor="#1976D2">
            <SectionHeader icon="local-shipping" title="Vehicle Number" color="#1976D2" />
            <SelectField
              label="Vehicle Number"
              icon="fire-truck"
              value={vehicleForm.regNo}
              options={vehicleNoOptions}
              onChange={onSelectVehicleNo}
              disabled={loadingVehicleNos}
              placeholder="Select vehicle number"
              searchable
              helperText="Selecting a vehicle loads its vehicle, driver and DO-PO details"
              error={fieldError("regNo")}
            />
          </Card>

          <Card accentColor="#FB8C00" style={styles.cardGap}>
            <SectionHeader icon="shopping-cart" title="DO-PO" color="#FB8C00" />
            {/* Stays editable even when the rest of the section is locked - the DO No is what
                drives the PO / line-item options below it. */}
            <LabeledInput label="DO No" icon="shopping-cart" value={doPoForm.doNo} onChangeText={(t) => setDoPoField("doNo", t)} error={fieldError("doNo")} />
            <SelectField
              label="PO No / Line Item"
              icon="list-alt"
              value={selectedDoPoKey}
              options={doPoOptions}
              onChange={onSelectDoPo}
              placeholder={doPoForm.doNo.trim() ? "Select PO / line item" : "Enter a DO No first"}
              disabled={!doPoForm.doNo.trim()}
              searchable
              error={fieldError("doPoSelect")}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="PO No" value={doPoForm.poNo} editable={!doPoLocked} onChangeText={(t) => setDoPoField("poNo", t)} error={fieldError("poNo")} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="PO Line Item" value={doPoForm.poLineItem} editable={!doPoLocked} onChangeText={(t) => setDoPoField("poLineItem", t)} error={fieldError("poLineItem")} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Plant" value={doPoForm.plant} editable={!doPoLocked} onChangeText={(t) => setDoPoField("plant", t)} error={fieldError("plant")} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Material No" value={doPoForm.materialNo} editable={!doPoLocked} onChangeText={(t) => setDoPoField("materialNo", t)} error={fieldError("materialNo")} />
              </View>
            </View>
            <LabeledInput label="Material Desc" value={doPoForm.materialDesc} editable={!doPoLocked} onChangeText={(t) => setDoPoField("materialDesc", t)} error={fieldError("materialDesc")} />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Mines Code" value={doPoForm.minesCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("minesCode", t)} error={fieldError("minesCode")} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Type" value={doPoForm.coalType} editable={!doPoLocked} onChangeText={(t) => setDoPoField("coalType", t)} error={fieldError("coalType")} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Company Code" value={doPoForm.companyCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("companyCode", t)} error={fieldError("companyCode")} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Vendor Code" value={doPoForm.vendorCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("vendorCode", t)} error={fieldError("vendorCode")} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Transporter Code" value={user.ORGANIZATION} editable={false} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="PO Quantity" value={doPoForm.poQty} keyboardType="decimal-pad" editable={!doPoLocked} onChangeText={(t) => setDoPoField("poQty", t)} error={fieldError("poQty")} />
              </View>
            </View>
          </Card>

          <Card accentColor="#9C27B0" style={styles.cardGap}>
            <SectionHeader icon="assignment" title="Trip Details" color="#9C27B0" />
            <LabeledInput
              label="TP No"
              icon="confirmation-number"
              value={tpNo}
              editable={!tpNoLocked}
              onChangeText={setTpNo}
              error={fieldError("tpNo")}
            />
            <DateField
              label="TP Date"
              value={tpDate}
              onChange={setTpDate}
              minimumDate={CURRENT_YEAR_START}
              maximumDate={new Date()}
              error={fieldError("tpDate")}
            />
            <LabeledInput
              label="LR No"
              icon="receipt-long"
              value={lrNo}
              onChangeText={setLrNo}
              error={fieldError("lrNo")}
            />
            <DateField
              label="LR Date"
              value={lrDate}
              onChange={setLrDate}
              minimumDate={CURRENT_YEAR_START}
              maximumDate={new Date()}
              error={fieldError("lrDate")}
            />
            <View style={styles.row}>
              <View style={styles.third}>
                <LabeledInput label="Gross (MT)" value={grossWeight} keyboardType="decimal-pad" onChangeText={setGrossWeight} error={fieldError("grossWeight")} />
              </View>
              <View style={styles.third}>
                <LabeledInput label="Tare (MT)" value={tareWeight} keyboardType="decimal-pad" onChangeText={setTareWeight} error={fieldError("tareWeight")} />
              </View>
              <View style={styles.third}>
                <LabeledInput label="Net (MT)" value={netWeight} keyboardType="decimal-pad" onChangeText={setNetWeight} error={fieldError("netWeight")} />
              </View>
            </View>
            <LabeledInput label="Coal Grade" icon="grade" value={coalGrade} onChangeText={setCoalGrade} error={fieldError("coalGrade")} />
            <DateField
              label="TP Validity Date"
              value={tpValidity}
              onChange={setTpValidity}
              error={expiryError(tpValidity, "TP validity") ?? fieldError("tpValidity")}
            />
          </Card>

          <Card accentColor="#1976D2" style={styles.cardGap}>
            <SectionHeader icon="directions-car" title="Vehicle Details" color="#1976D2" />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="RC No" value={vehicleForm.rcNo} editable={!vehicle} onChangeText={(t) => setVehicleField("rcNo", t)} error={fieldError("rcNo")} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="RC Expiry"
                  value={vehicleForm.rcExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("rcExpDate", d)}
                  error={expiryError(vehicleForm.rcExpDate, "RC") ?? fieldError("rcExpDate")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Fitness No" value={vehicleForm.fitnessNo} editable={!vehicle} onChangeText={(t) => setVehicleField("fitnessNo", t)} error={fieldError("fitnessNo")} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Fitness Expiry"
                  value={vehicleForm.fitExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("fitExpDate", d)}
                  error={expiryError(vehicleForm.fitExpDate, "Fitness") ?? fieldError("fitExpDate")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Insurance No" value={vehicleForm.insNo} editable={!vehicle} onChangeText={(t) => setVehicleField("insNo", t)} error={fieldError("insNo")} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Insurance Expiry"
                  value={vehicleForm.insValidDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("insValidDate", d)}
                  error={expiryError(vehicleForm.insValidDate, "Insurance") ?? fieldError("insValidDate")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="PUC No" value={vehicleForm.pucNo} editable={!vehicle} onChangeText={(t) => setVehicleField("pucNo", t)} error={fieldError("pucNo")} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="PUC Expiry"
                  value={vehicleForm.pucExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("pucExpDate", d)}
                  error={expiryError(vehicleForm.pucExpDate, "PUC") ?? fieldError("pucExpDate")}
                />
              </View>
            </View>
          </Card>

          <Card accentColor="#43A047" style={styles.cardGap}>
            <SectionHeader icon="person" title="Driver Details" color="#43A047" />
            <SelectField
              label="DL No"
              icon="badge"
              value={driverForm.licenceNo}
              options={driverOptions}
              onChange={onSelectDriver}
              placeholder="Select driver by DL No"
              searchable
              error={fieldError("licenceNo")}
            />
            <LabeledInput label="Driver Name" icon="badge" value={driverForm.name} editable={!driverLocked} onChangeText={(t) => setDriverForm((p) => ({ ...p, name: t }))} error={fieldError("driverName")} />
            <LabeledInput label="Address" icon="place" value={driverForm.address} editable={!driverLocked} onChangeText={(t) => setDriverForm((p) => ({ ...p, address: t }))} error={fieldError("driverAddress")} />
            <View style={styles.row}>
              <View style={styles.half}>
                <DateField
                  label="License Expiry"
                  value={driverForm.licExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, licExpDate: d }))}
                  error={expiryError(driverForm.licExpDate, "License") ?? fieldError("licExpDate")}
                />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Medical Expiry"
                  value={driverForm.medExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, medExpDate: d }))}
                  error={expiryError(driverForm.medExpDate, "Medical certificate") ?? fieldError("medExpDate")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <DateField
                  label="Kiosk Expiry"
                  value={driverForm.kskExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, kskExpDate: d }))}
                  error={expiryError(driverForm.kskExpDate, "Kiosk certificate") ?? fieldError("kskExpDate")}
                />
              </View>
              <View style={styles.half}>
                <DateField
                  label="HCV Expiry"
                  value={driverForm.hcvExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, hcvExpDate: d }))}
                  error={expiryError(driverForm.hcvExpDate, "HCV license") ?? fieldError("hcvExpDate")}
                />
              </View>
            </View>
            <DateField
              label="Police Verification Expiry"
              value={driverForm.polExpDate}
              disabled={driverLocked}
              onChange={(d) => setDriverForm((p) => ({ ...p, polExpDate: d }))}
              error={expiryError(driverForm.polExpDate, "Police verification") ?? fieldError("polExpDate")}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput
                  label="Mobile No"
                  value={driverForm.mobileNo}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!driverLocked}
                  error={mobileNoError(driverForm.mobileNo) ?? fieldError("mobileNo")}
                  onChangeText={(t) => setDriverForm((p) => ({ ...p, mobileNo: t }))}
                />
              </View>
              <View style={styles.half}>
                <LabeledInput
                  label="Aadhar No"
                  value={driverForm.adhrNo}
                  keyboardType="number-pad"
                  maxLength={12}
                  editable={!driverLocked}
                  error={aadharNoError(driverForm.adhrNo) ?? fieldError("adhrNo")}
                  onChangeText={(t) => setDriverForm((p) => ({ ...p, adhrNo: t }))}
                />
              </View>
            </View>
          </Card>

          <Card style={styles.cardGap}>
            <SectionHeader icon="photo-camera" title="Photos" color="#607D8B" />
            <View style={styles.imageGrid}>
              <ImageUploadField
                label="Transit Pass"
                uri={images.transitPass}
                uploading={imageUploading.transitPass}
                onChange={(uri) => onPickImage("transitPass", uri)}
                error={imageErrors.transitPass ?? fieldError("transitPass")}
              />
              <ImageUploadField
                label="MCL Weighment-cum-Challan"
                uri={images.mclWeighment}
                uploading={imageUploading.mclWeighment}
                onChange={(uri) => onPickImage("mclWeighment", uri)}
                error={imageErrors.mclWeighment ?? fieldError("mclWeighment")}
              />
              <ImageUploadField
                label="Transporter Delivery Challan"
                uri={images.transporterChallan}
                uploading={imageUploading.transporterChallan}
                onChange={(uri) => onPickImage("transporterChallan", uri)}
                error={imageErrors.transporterChallan ?? fieldError("transporterChallan")}
              />
              <ImageUploadField
                label="E-Way Bill"
                uri={images.ewayBill}
                uploading={imageUploading.ewayBill}
                onChange={(uri) => onPickImage("ewayBill", uri)}
                error={imageErrors.ewayBill ?? fieldError("ewayBill")}
              />
            </View>
          </Card>

          <PrimaryButton
            label="Submit"
            icon="save"
            variant="primary"
            loading={busy}
            onPress={onSubmit}
            style={styles.cardGap}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingOverlay
        visible={loadingVehicleNos || loadingDopoMaster || loadingDetails}
        message={loadingVehicleNos || loadingDopoMaster ? "Loading vehicles..." : "Fetching details..."}
      />

      <ResultDialog
        visible={vehicleAlert}
        type="error"
        title="Vehicle Not Registered"
        message="Please register a vehicle first"
        primaryLabel="OK"
        onPrimaryPress={onVehicleAlertDismiss}
      />

      <ResultDialog
        visible={!!result}
        type={result?.type ?? "success"}
        title={result?.type === "success" ? "Challan Submitted!" : "Submission Failed"}
        message={result?.message ?? ""}
        primaryLabel={result?.type === "success" ? "Done" : "Try Again"}
        onPrimaryPress={onDialogPrimaryPress}
        highlightLabel="Gatepass No"
        highlightValue={result?.gatepassNo ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F6F8" },
  hero: { paddingBottom: 14, paddingTop: 4, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  // paddingBottom is overridden per-render with the device's bottom inset added on.
  scroll: { padding: 16, paddingTop: 20, paddingBottom: SCROLL_BOTTOM_PADDING },
  cardGap: { marginTop: 16 },
  row: { flexDirection: "row", gap: 12 },
  third: { flex: 1 },
  half: { flex: 1 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
