import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { LabeledInput } from "@/components/ui/LabeledInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ResultDialog } from "@/components/ui/ResultDialog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SelectField } from "@/components/ui/SelectField";
import { useCoalChallan } from "@/context/CoalChallanContext";
import { useToast } from "@/context/ToastContext";
import { formatDateForApi, formatYyyyMmDd, parseMasterDate, parseScanDateTime } from "@/lib/date";
import { parseSubmitMessage } from "@/lib/submitMessage";
import { aadharNoError, expiryError, isExpired, isValidAadharNo, isValidMobileNo, mobileNoError } from "@/lib/validation";
import { submitCoalChallan, TRANS_CODE_MAST } from "@/services/api";
import { CoalChallanPostDetails } from "@/types/models";

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

export default function CoalChallanScreen() {
  const { user, scanData, scanRaw, vehicle, drivers, dopoList, loadingDetails, fetchCoalDetails, reset } =
    useCoalChallan();
  const { show } = useToast();

  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm());
  const [driverForm, setDriverForm] = useState<DriverForm>(emptyDriverForm());
  const [doPoForm, setDoPoForm] = useState<DoPoForm>(emptyDoPoForm());
  const [driverLocked, setDriverLocked] = useState(false);
  const [doPoLocked, setDoPoLocked] = useState(false);
  const [selectedDoPoKey, setSelectedDoPoKey] = useState("");

  const [tpNo, setTpNo] = useState("");
  const [tpDate, setTpDate] = useState<Date | null>(null);
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState<Date | null>(null);
  const [grossWeight, setGrossWeight] = useState("");
  const [tareWeight, setTareWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [coalGrade, setCoalGrade] = useState("");
  const [tpValidity, setTpValidity] = useState<Date | null>(null);

  const [images, setImages] = useState<ChallanImages>(emptyImages());
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<
    { type: "success" | "error"; message: string; gatepassNo: string | null } | null
  >(null);

  function setImage(key: keyof ChallanImages, uri: string | null) {
    setImages((prev) => ({ ...prev, [key]: uri }));
  }

  useEffect(() => {
    if (scanData) return;
    // Arrived without scan data (manual entry) - guarantee a blank form even if
    // stale vehicle/driver data from a previous session lingers in context.
    setVehicleForm(emptyVehicleForm());
    setDriverForm(emptyDriverForm());
    setDoPoForm(emptyDoPoForm());
    setDriverLocked(false);
    setDoPoLocked(false);
    setSelectedDoPoKey("");
    setTpNo("");
    setTpDate(null);
    setLrNo("");
    setLrDate(null);
    setGrossWeight("");
    setTareWeight("");
    setNetWeight("");
    setCoalGrade("");
    setTpValidity(null);
    setImages(emptyImages());
    setSubmitted(false);
    reset();
    // Only run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scanData) return;
    setTpNo(scanData.tpNo);
    setGrossWeight(scanData.grossWeight);
    setTareWeight(scanData.tareWeight);
    setNetWeight(scanData.netWeight);
    setCoalGrade(scanData.coalGrade);
    setVehicleForm((prev) => ({ ...prev, regNo: scanData.vehicle }));
    setDoPoForm((prev) => ({ ...prev, doNo: scanData.doNo }));
    const parsed = parseScanDateTime(scanData.tpValidityDateRaw);
    if (parsed) setTpValidity(parsed);
    // Fetch itself is handled by the auto-fetch effect below, once regNo/doNo land in state.
  }, [scanData]);

  useEffect(() => {
    const vehNo = vehicleForm.regNo.trim();
    const doPo = doPoForm.doNo.trim();
    if (!vehNo || !doPo) return;
    const timer = setTimeout(() => {
      fetchCoalDetails({ vehNo: vehNo.toUpperCase(), doPo });
    }, 600);
    return () => clearTimeout(timer);
    // Re-fetch whenever the vehicle no or DO no settle on a new value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleForm.regNo, doPoForm.doNo]);

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

  const doPoKey = (p: { pO_NUM: string; pO_LIN_ITM: string }) => `${p.pO_NUM}|${p.pO_LIN_ITM}`;

  const doPoOptions = useMemo(
    () => dopoList.map((p) => ({ label: `${p.pO_NUM} - Line ${p.pO_LIN_ITM}`, value: doPoKey(p) })),
    [dopoList]
  );

  function onSelectDoPo(key: string) {
    const match = dopoList.find((p) => doPoKey(p) === key);
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
    if (dopoList.length === 1) {
      onSelectDoPo(doPoKey(dopoList[0]));
    } else {
      setDoPoLocked(false);
      setSelectedDoPoKey("");
    }
    // Only react when a fresh fetch hands off a new DO-PO list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dopoList]);

  const driverOptions = useMemo(
    () => drivers.map((d) => ({ label: `${d.dregno} - ${d.name}`, value: d.dregno })),
    [drivers]
  );

  function onSelectDriver(dregno: string) {
    const match = drivers.find((d) => d.dregno === dregno);
    if (!match) return;
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

  function setVehicleField<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setVehicleForm((prev) => ({ ...prev, [key]: value }));
  }

  function setDoPoField<K extends keyof DoPoForm>(key: K, value: DoPoForm[K]) {
    setDoPoForm((prev) => ({ ...prev, [key]: value }));
  }

  function onBack() {
    reset();
    router.back();
  }

  function onViewRawQr() {
    if (scanRaw) Alert.alert("Scanned QR Data", scanRaw);
  }

  async function onSubmit() {
    setSubmitted(true);
    if (!vehicleForm.regNo || !tpNo || !grossWeight || !tareWeight || !netWeight) {
      show("Please fill vehicle number, TP No and weight details", "warning");
      return;
    }
    if (!lrNo.trim()) {
      show("Please enter LR No", "warning");
      return;
    }
    if (!tpDate) {
      show("Please select TP Date", "warning");
      return;
    }
    if (!lrDate) {
      show("Please select LR Date", "warning");
      return;
    }
    if (!images.transitPass || !images.mclWeighment || !images.transporterChallan || !images.ewayBill) {
      show("Please upload all 4 photos", "warning");
      return;
    }
    if (!tpValidity) {
      show("Please select TP validity date", "warning");
      return;
    }
    if (!driverForm.name || !driverForm.licenceNo || !driverForm.mobileNo) {
      show("Please select a driver and fill in mobile number", "warning");
      return;
    }
    if (!isValidMobileNo(driverForm.mobileNo)) {
      show("Mobile number must be 10 digits", "warning");
      return;
    }
    if (driverForm.adhrNo && !isValidAadharNo(driverForm.adhrNo)) {
      show("Aadhar number must be 12 digits", "warning");
      return;
    }
    if (!doPoForm.doNo || !doPoForm.poNo) {
      show("Please fill DO number and PO number", "warning");
      return;
    }
    const expiryChecks: [string, Date | null][] = [
      ["RC Expiry", vehicleForm.rcExpDate],
      ["Fitness Expiry", vehicleForm.fitExpDate],
      ["Insurance Expiry", vehicleForm.insValidDate],
      ["PUC Expiry", vehicleForm.pucExpDate],
      ["License Expiry", driverForm.licExpDate],
      ["Medical Expiry", driverForm.medExpDate],
      ["Kiosk Expiry", driverForm.kskExpDate],
      ["HCV Expiry", driverForm.hcvExpDate],
      ["Police Verification Expiry", driverForm.polExpDate],
      ["TP Validity Date", tpValidity],
    ];
    const expired = expiryChecks.find(([, date]) => isExpired(date));
    if (expired) {
      show(`${expired[0]} has expired`, "warning");
      return;
    }
    setBusy(true);
    try {
      const postDetails: CoalChallanPostDetails = {
        gatepassno: "",
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
        tranS_CODE: TRANS_CODE_MAST,
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
        imG_1: images.transitPass ?? "",
        imG_2: images.mclWeighment ?? "",
        imG_3: images.transporterChallan ?? "",
        imG_4: images.ewayBill ?? "",
      };

      console.log("[coal-challan] submitting postDetails:", JSON.stringify(postDetails, null, 2));
      const apiResult = await submitCoalChallan(postDetails);
      const { summary, gatepassNo } = parseSubmitMessage(apiResult.message);
      setResult({
        type: apiResult.success ? "success" : "error",
        message: apiResult.success ? "Your challan has been submitted successfully." : summary,
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
                Coal Challan Creation
              </Text>
            </View>
            {scanData ? (
              <View style={styles.headerActions}>
                {scanRaw ? (
                  <TouchableOpacity onPress={onViewRawQr} style={styles.iconBtn}>
                    <MaterialIcons name="visibility" size={17} color="#fff" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => router.push("/scanner")} style={styles.iconBtn}>
                  <MaterialIcons name="qr-code-scanner" size={17} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card accentColor="#1976D2">
            <SectionHeader icon="local-shipping" title="Vehicle Number" color="#1976D2" />
            <LabeledInput
              label="Vehicle Number"
              icon="fire-truck"
              value={vehicleForm.regNo}
              editable={!vehicle}
              onChangeText={(t) => setVehicleField("regNo", t.toUpperCase())}
              autoCapitalize="characters"
              placeholder="Enter vehicle registration number"
              helperText="Details fetch automatically once vehicle number and DO No (below) are entered"
            />
            {loadingDetails ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#1976D2" />
                <Text style={styles.loadingText}>Fetching details...</Text>
              </View>
            ) : null}
          </Card>

          <Card accentColor="#FB8C00" style={styles.cardGap}>
            <SectionHeader icon="shopping-cart" title="DO-PO" color="#FB8C00" />
            <LabeledInput label="DO No" icon="shopping-cart" value={doPoForm.doNo} editable={!doPoLocked} onChangeText={(t) => setDoPoField("doNo", t)} />
            <SelectField
              label="PO No / Line Item"
              icon="list-alt"
              value={selectedDoPoKey}
              options={doPoOptions}
              onChange={onSelectDoPo}
              placeholder="Select PO / line item"
              searchable
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="PO No" value={doPoForm.poNo} editable={!doPoLocked} onChangeText={(t) => setDoPoField("poNo", t)} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="PO Line Item" value={doPoForm.poLineItem} editable={!doPoLocked} onChangeText={(t) => setDoPoField("poLineItem", t)} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Plant" value={doPoForm.plant} editable={!doPoLocked} onChangeText={(t) => setDoPoField("plant", t)} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Material No" value={doPoForm.materialNo} editable={!doPoLocked} onChangeText={(t) => setDoPoField("materialNo", t)} />
              </View>
            </View>
            <LabeledInput label="Material Desc" value={doPoForm.materialDesc} editable={!doPoLocked} onChangeText={(t) => setDoPoField("materialDesc", t)} />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Mines Code" value={doPoForm.minesCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("minesCode", t)} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Type" value={doPoForm.coalType} editable={!doPoLocked} onChangeText={(t) => setDoPoField("coalType", t)} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Company Code" value={doPoForm.companyCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("companyCode", t)} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="Vendor Code" value={doPoForm.vendorCode} editable={!doPoLocked} onChangeText={(t) => setDoPoField("vendorCode", t)} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Transporter Code" value={TRANS_CODE_MAST} editable={false} />
              </View>
              <View style={styles.half}>
                <LabeledInput label="PO Quantity" value={doPoForm.poQty} keyboardType="decimal-pad" editable={!doPoLocked} onChangeText={(t) => setDoPoField("poQty", t)} />
              </View>
            </View>
          </Card>

          <Card accentColor="#9C27B0" style={styles.cardGap}>
            <SectionHeader icon="assignment" title="Trip Details" color="#9C27B0" />
            <LabeledInput
              label="TP No"
              icon="confirmation-number"
              value={tpNo}
              editable={!scanData}
              onChangeText={setTpNo}
              error={submitted && !tpNo.trim() ? "TP No is required" : undefined}
            />
            <DateField
              label="TP Date"
              value={tpDate}
              onChange={setTpDate}
              minimumDate={CURRENT_YEAR_START}
              error={submitted && !tpDate ? "TP Date is required" : undefined}
            />
            <LabeledInput
              label="LR No"
              icon="receipt-long"
              value={lrNo}
              onChangeText={setLrNo}
              error={submitted && !lrNo.trim() ? "LR No is required" : undefined}
            />
            <DateField
              label="LR Date"
              value={lrDate}
              onChange={setLrDate}
              minimumDate={CURRENT_YEAR_START}
              error={submitted && !lrDate ? "LR Date is required" : undefined}
            />
            <View style={styles.row}>
              <View style={styles.third}>
                <LabeledInput label="Gross (MT)" value={grossWeight} keyboardType="decimal-pad" editable={!scanData} onChangeText={setGrossWeight} />
              </View>
              <View style={styles.third}>
                <LabeledInput label="Tare (MT)" value={tareWeight} keyboardType="decimal-pad" editable={!scanData} onChangeText={setTareWeight} />
              </View>
              <View style={styles.third}>
                <LabeledInput label="Net (MT)" value={netWeight} keyboardType="decimal-pad" editable={!scanData} onChangeText={setNetWeight} />
              </View>
            </View>
            <LabeledInput label="Coal Grade" icon="grade" value={coalGrade} onChangeText={setCoalGrade} />
            <DateField
              label="TP Validity Date"
              value={tpValidity}
              onChange={setTpValidity}
              error={expiryError(tpValidity, "TP validity")}
            />
          </Card>

          <Card accentColor="#1976D2" style={styles.cardGap}>
            <SectionHeader icon="directions-car" title="Vehicle Details" color="#1976D2" />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="RC No" value={vehicleForm.rcNo} editable={!vehicle} onChangeText={(t) => setVehicleField("rcNo", t)} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="RC Expiry"
                  value={vehicleForm.rcExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("rcExpDate", d)}
                  error={expiryError(vehicleForm.rcExpDate, "RC")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Fitness No" value={vehicleForm.fitnessNo} editable={!vehicle} onChangeText={(t) => setVehicleField("fitnessNo", t)} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Fitness Expiry"
                  value={vehicleForm.fitExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("fitExpDate", d)}
                  error={expiryError(vehicleForm.fitExpDate, "Fitness")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="Insurance No" value={vehicleForm.insNo} editable={!vehicle} onChangeText={(t) => setVehicleField("insNo", t)} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Insurance Expiry"
                  value={vehicleForm.insValidDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("insValidDate", d)}
                  error={expiryError(vehicleForm.insValidDate, "Insurance")}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput label="PUC No" value={vehicleForm.pucNo} editable={!vehicle} onChangeText={(t) => setVehicleField("pucNo", t)} />
              </View>
              <View style={styles.half}>
                <DateField
                  label="PUC Expiry"
                  value={vehicleForm.pucExpDate}
                  disabled={!!vehicle}
                  onChange={(d) => setVehicleField("pucExpDate", d)}
                  error={expiryError(vehicleForm.pucExpDate, "PUC")}
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
            />
            <LabeledInput label="Driver Name" icon="badge" value={driverForm.name} editable={!driverLocked} onChangeText={(t) => setDriverForm((p) => ({ ...p, name: t }))} />
            <LabeledInput label="Address" icon="place" value={driverForm.address} editable={!driverLocked} onChangeText={(t) => setDriverForm((p) => ({ ...p, address: t }))} />
            <View style={styles.row}>
              <View style={styles.half}>
                <DateField
                  label="License Expiry"
                  value={driverForm.licExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, licExpDate: d }))}
                  error={expiryError(driverForm.licExpDate, "License")}
                />
              </View>
              <View style={styles.half}>
                <DateField
                  label="Medical Expiry"
                  value={driverForm.medExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, medExpDate: d }))}
                  error={expiryError(driverForm.medExpDate, "Medical certificate")}
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
                  error={expiryError(driverForm.kskExpDate, "Kiosk certificate")}
                />
              </View>
              <View style={styles.half}>
                <DateField
                  label="HCV Expiry"
                  value={driverForm.hcvExpDate}
                  disabled={driverLocked}
                  onChange={(d) => setDriverForm((p) => ({ ...p, hcvExpDate: d }))}
                  error={expiryError(driverForm.hcvExpDate, "HCV license")}
                />
              </View>
            </View>
            <DateField
              label="Police Verification Expiry"
              value={driverForm.polExpDate}
              disabled={driverLocked}
              onChange={(d) => setDriverForm((p) => ({ ...p, polExpDate: d }))}
              error={expiryError(driverForm.polExpDate, "Police verification")}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <LabeledInput
                  label="Mobile No"
                  value={driverForm.mobileNo}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!driverLocked}
                  error={mobileNoError(driverForm.mobileNo)}
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
                  error={aadharNoError(driverForm.adhrNo)}
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
                onChange={(uri) => setImage("transitPass", uri)}
                error={submitted && !images.transitPass ? "Required" : undefined}
              />
              <ImageUploadField
                label="MCL Weighment-cum-Challan"
                uri={images.mclWeighment}
                onChange={(uri) => setImage("mclWeighment", uri)}
                error={submitted && !images.mclWeighment ? "Required" : undefined}
              />
              <ImageUploadField
                label="Transporter Delivery Challan"
                uri={images.transporterChallan}
                onChange={(uri) => setImage("transporterChallan", uri)}
                error={submitted && !images.transporterChallan ? "Required" : undefined}
              />
              <ImageUploadField
                label="E-Way Bill"
                uri={images.ewayBill}
                onChange={(uri) => setImage("ewayBill", uri)}
                error={submitted && !images.ewayBill ? "Required" : undefined}
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
  scroll: { padding: 16, paddingTop: 20, paddingBottom: 32 },
  cardGap: { marginTop: 16 },
  row: { flexDirection: "row", gap: 12 },
  third: { flex: 1 },
  half: { flex: 1 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  loadingText: { fontSize: 13, color: "#546E7A" },
});
