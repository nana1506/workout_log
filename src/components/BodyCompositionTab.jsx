import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Scale, UploadCloud, X, AlertTriangle, Info, CalendarCheck, Loader2, CheckCircle2, ChevronRight
} from "lucide-react";
import { supabase } from "../App";

// Helper to convert File to base64
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

// Helper to get local date in YYYY-MM-DD
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse dates extracted by Gemini
const parseDateString = (str) => {
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
};

// Custom Tooltip matching main dashboard design
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] px-3 py-2 text-xs shadow-lg">
      <div className="text-[#8A919C] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#E7E9EC]">
            {p.name}: {p.value} {p.dataKey === 'weight_kg' ? 'kg' : '%'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function BodyCompositionTab({ bodyMetrics = [], onRefresh }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);

  // Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [formNotice, setFormNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    date: getTodayDateString(),
    weight_kg: "",
    height_cm: "",
    age: "",
    body_age: "",
    bmi: "",
    fat_mass_pct: "",
    fat_mass_kg: "",
    muscle_mass_pct: "",
    muscle_mass_kg: "",
    visceral_fat: "",
    bmr: "",
    arm_left_muscle_kg: "",
    arm_right_muscle_kg: "",
    arm_left_fat_kg: "",
    arm_right_fat_kg: "",
    leg_left_muscle_kg: "",
    leg_right_muscle_kg: "",
    leg_left_fat_kg: "",
    leg_right_fat_kg: "",
    torso_muscle_kg: "",
    torso_fat_kg: "",
  });

  // Clean up object URL memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle local file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractionError(null);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "image/png" || droppedFile.type === "image/jpeg")) {
      setFile(droppedFile);
      setExtractionError(null);
      setPreviewUrl(URL.createObjectURL(droppedFile));
    }
  };

  // OCR extraction trigger
  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const base64 = await toBase64(file);
      const response = await fetch("/api/parse-body-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`);
      }

      const data = await response.json();

      setFormData({
        date: parseDateString(data.date) || getTodayDateString(),
        weight_kg: data.weight_kg ?? "",
        height_cm: data.height_cm ?? "",
        age: data.age ?? "",
        body_age: data.body_age ?? "",
        bmi: data.bmi ?? "",
        fat_mass_pct: data.fat_mass_pct ?? "",
        fat_mass_kg: data.fat_mass_kg ?? "",
        muscle_mass_pct: data.muscle_mass_pct ?? "",
        muscle_mass_kg: data.muscle_mass_kg ?? "",
        visceral_fat: data.visceral_fat ?? "",
        bmr: data.bmr ?? "",
        arm_left_muscle_kg: data.arm_left_muscle_kg ?? "",
        arm_right_muscle_kg: data.arm_right_muscle_kg ?? "",
        arm_left_fat_kg: data.arm_left_fat_kg ?? "",
        arm_right_fat_kg: data.arm_right_fat_kg ?? "",
        leg_left_muscle_kg: data.leg_left_muscle_kg ?? "",
        leg_right_muscle_kg: data.leg_right_muscle_kg ?? "",
        leg_left_fat_kg: data.leg_left_fat_kg ?? "",
        leg_right_fat_kg: data.leg_right_fat_kg ?? "",
        torso_muscle_kg: data.torso_muscle_kg ?? "",
        torso_fat_kg: data.torso_fat_kg ?? "",
      });

      // Count readable fields to notify if empty/failed
      const nonNullFields = Object.entries(data).filter(
        ([key, val]) => key !== "date" && val !== null && val !== undefined && val !== ""
      );

      if (nonNullFields.length < 3) {
        setFormNotice("Gemini couldn't confidently extract most fields. Please enter them manually below.");
      } else {
        setFormNotice("");
      }

      setFormErrors({});
      setShowFormModal(true);
    } catch (err) {
      console.error("Extraction error:", err);
      setExtractionError("Could not extract data from the image. Open form to enter manually?");
      
      // Initialize empty form with fallback today date
      setFormData({
        date: getTodayDateString(),
        weight_kg: "",
        height_cm: "",
        age: "",
        body_age: "",
        bmi: "",
        fat_mass_pct: "",
        fat_mass_kg: "",
        muscle_mass_pct: "",
        muscle_mass_kg: "",
        visceral_fat: "",
        bmr: "",
        arm_left_muscle_kg: "",
        arm_right_muscle_kg: "",
        arm_left_fat_kg: "",
        arm_right_fat_kg: "",
        leg_left_muscle_kg: "",
        leg_right_muscle_kg: "",
        leg_left_fat_kg: "",
        leg_right_fat_kg: "",
        torso_muscle_kg: "",
        torso_fat_kg: "",
      });
      setFormNotice("Extraction failed entirely. Please fill in the metrics manually.");
      setFormErrors({});
    } finally {
      setIsExtracting(false);
    }
  };

  const handleOpenEmptyForm = () => {
    setFormData({
      date: getTodayDateString(),
      weight_kg: "",
      height_cm: "",
      age: "",
      body_age: "",
      bmi: "",
      fat_mass_pct: "",
      fat_mass_kg: "",
      muscle_mass_pct: "",
      muscle_mass_kg: "",
      visceral_fat: "",
      bmr: "",
      arm_left_muscle_kg: "",
      arm_right_muscle_kg: "",
      arm_left_fat_kg: "",
      arm_right_fat_kg: "",
      leg_left_muscle_kg: "",
      leg_right_muscle_kg: "",
      leg_left_fat_kg: "",
      leg_right_fat_kg: "",
      torso_muscle_kg: "",
      torso_fat_kg: "",
    });
    setFormNotice("Upload skipped or failed. Please fill in metrics manually.");
    setFormErrors({});
    setShowFormModal(true);
  };

  const cleanValueForInsert = (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
    // Clear error inline
    if (formErrors[key]) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  // Submit and save record to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!formData.weight_kg) {
      errors.weight_kg = "Weight is required";
    } else {
      const w = parseFloat(formData.weight_kg);
      if (isNaN(w) || w <= 0) {
        errors.weight_kg = "Weight must be positive";
      }
    }

    if (!formData.date) {
      errors.date = "Date is required";
    }

    // Validate all other inputs are positive if provided
    Object.keys(formData).forEach((key) => {
      if (key !== "date" && key !== "weight_kg") {
        const val = formData[key];
        if (val !== "" && val !== null && val !== undefined) {
          const num = parseFloat(val);
          if (isNaN(num) || num < 0) {
            errors[key] = "Must be positive";
          }
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const insertRow = {
        date: new Date(formData.date).toISOString(),
        weight_kg: parseFloat(formData.weight_kg),
        height_cm: cleanValueForInsert(formData.height_cm),
        age: cleanValueForInsert(formData.age),
        body_age: cleanValueForInsert(formData.body_age),
        bmi: cleanValueForInsert(formData.bmi),
        fat_mass_pct: cleanValueForInsert(formData.fat_mass_pct),
        fat_mass_kg: cleanValueForInsert(formData.fat_mass_kg),
        muscle_mass_pct: cleanValueForInsert(formData.muscle_mass_pct),
        muscle_mass_kg: cleanValueForInsert(formData.muscle_mass_kg),
        visceral_fat: cleanValueForInsert(formData.visceral_fat),
        bmr: cleanValueForInsert(formData.bmr),
        arm_left_muscle_kg: cleanValueForInsert(formData.arm_left_muscle_kg),
        arm_right_muscle_kg: cleanValueForInsert(formData.arm_right_muscle_kg),
        arm_left_fat_kg: cleanValueForInsert(formData.arm_left_fat_kg),
        arm_right_fat_kg: cleanValueForInsert(formData.arm_right_fat_kg),
        leg_left_muscle_kg: cleanValueForInsert(formData.leg_left_muscle_kg),
        leg_right_muscle_kg: cleanValueForInsert(formData.leg_right_muscle_kg),
        leg_left_fat_kg: cleanValueForInsert(formData.leg_left_fat_kg),
        leg_right_fat_kg: cleanValueForInsert(formData.leg_right_fat_kg),
        torso_muscle_kg: cleanValueForInsert(formData.torso_muscle_kg),
        torso_fat_kg: cleanValueForInsert(formData.torso_fat_kg),
      };

      const { error } = await supabase
        .from("body_metrics")
        .insert([insertRow]);

      if (error) throw error;

      // Close and clear upload state
      setShowFormModal(false);
      setFile(null);
      setPreviewUrl("");
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("Supabase insert failed:", err);
      setFormErrors({ submit: err.message || "Failed to save record to Supabase." });
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare chart data (ascending by date)
  const chartData = useMemo(() => {
    return [...bodyMetrics]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((m) => ({
        ...m,
        dateLabel: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }));
  }, [bodyMetrics]);

  // Latest entry insights
  const latestMetric = useMemo(() => {
    if (!bodyMetrics.length) return null;
    return bodyMetrics[0]; // Ordered DESC by date
  }, [bodyMetrics]);

  // History visible limit (cap at 20)
  const historyLogs = useMemo(() => {
    return bodyMetrics.slice(0, 20);
  }, [bodyMetrics]);

  return (
    <div className="space-y-6">
      {/* Upload Zone & Highlights Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Container */}
        <div className="lg:col-span-2 rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold mb-1">Upload Body Composition Scale Screenshot</h2>
            <p className="text-xs text-[#8A919C]">
              Upload a screenshot from your scale's app (Renpho, Huawei Health, etc.) to extract metrics automatically using Gemini.
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer min-h-[160px] ${
              file ? "border-[#4FD1C5]/40 bg-[#1B1F26]" : "border-[#232830] hover:border-[#F4B740]/40 bg-[#0C0E12]"
            }`}
          >
            <input
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleFileChange}
              id="body-composition-file-input"
              className="hidden"
            />
            <label htmlFor="body-composition-file-input" className="cursor-pointer space-y-2 flex flex-col items-center">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="h-20 w-auto rounded object-contain border border-[#232830]"
                  />
                  <div className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white p-0.5" onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    setPreviewUrl("");
                  }}>
                    <X size={12} />
                  </div>
                </div>
              ) : (
                <UploadCloud size={32} className="text-[#8A919C] mb-1" />
              )}
              <span className="text-xs text-[#E7E9EC] block font-medium">
                {file ? file.name : "Drag & drop screenshot or click to browse"}
              </span>
              <span className="text-[10px] text-[#8A919C] block">Supports PNG, JPG</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExtract}
              disabled={!file || isExtracting}
              className="flex-1 py-2 px-4 rounded-lg bg-[#F4B740] hover:bg-[#d89f30] text-[#0C0E12] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-[#F4B740]"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Extracting with Gemini...
                </>
              ) : (
                <>
                  <Scale size={14} /> Extract Data
                </>
              )}
            </button>

            {extractionError && (
              <button
                onClick={handleOpenEmptyForm}
                className="py-2 px-3 rounded-lg border border-[#232830] hover:border-[#3A414C] bg-[#15181D] text-xs text-[#8A919C] hover:text-[#E7E9EC] transition-colors"
              >
                Skip to Manual Form
              </button>
            )}
          </div>

          {extractionError && (
            <div className="rounded border border-[#EF7B57]/30 bg-[#EF7B57]/5 p-2.5 flex items-start gap-2 text-xs text-[#EF7B57]">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div>
                <span>{extractionError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Highlights Side Panel */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
          <h2 className="text-sm font-semibold mb-2">Latest Reading</h2>
          {latestMetric ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0C0E12] border border-[#232830] rounded-lg p-3">
                  <span className="text-[10px] uppercase text-[#8A919C] block">Weight</span>
                  <span className="text-xl font-bold font-mono text-[#F4B740]">
                    {latestMetric.weight_kg} <span className="text-xs font-normal text-[#8A919C]">kg</span>
                  </span>
                </div>
                <div className="bg-[#0C0E12] border border-[#232830] rounded-lg p-3">
                  <span className="text-[10px] uppercase text-[#8A919C] block">Muscle Mass</span>
                  <span className="text-xl font-bold font-mono text-[#4FD1C5]">
                    {latestMetric.muscle_mass_pct ?? "--"}{" "}
                    <span className="text-xs font-normal text-[#8A919C]">%</span>
                  </span>
                </div>
                <div className="bg-[#0C0E12] border border-[#232830] rounded-lg p-3">
                  <span className="text-[10px] uppercase text-[#8A919C] block">Body Fat</span>
                  <span className="text-xl font-bold font-mono text-[#EF7B57]">
                    {latestMetric.fat_mass_pct ?? "--"}{" "}
                    <span className="text-xs font-normal text-[#8A919C]">%</span>
                  </span>
                </div>
                <div className="bg-[#0C0E12] border border-[#232830] rounded-lg p-3">
                  <span className="text-[10px] uppercase text-[#8A919C] block">BMI</span>
                  <span className="text-xl font-bold font-mono text-[#7FA6FF]">
                    {latestMetric.bmi ?? "--"}
                  </span>
                </div>
              </div>
              <div className="border-t border-[#232830] pt-3 flex justify-between items-center text-xs text-[#8A919C]">
                <span>Last Updated:</span>
                <span className="font-semibold text-[#E7E9EC]">
                  {new Date(latestMetric.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex flex-col items-center justify-center border border-dashed border-[#232830] rounded-xl text-center p-4">
              <Scale size={24} className="text-[#8A919C]/40 mb-2" />
              <p className="text-xs text-[#8A919C]">No composition data logged yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Chart */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5">
        <h2 className="text-sm font-semibold mb-1">Body Composition Progress</h2>
        <p className="text-xs text-[#8A919C] mb-4">Weight track (left axis) vs skeletal muscle percentage (right axis)</p>
        <div className="h-[260px] relative z-0">
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1E222A" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: "#8A919C", fontSize: 10 }}
                  axisLine={{ stroke: "#232830" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="weight"
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tick={{ fill: "#8A919C", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="muscle"
                  orientation="right"
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "#8A919C", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  yAxisId="weight"
                  type="monotone"
                  dataKey="weight_kg"
                  name="Weight (kg)"
                  stroke="#F4B740"
                  strokeWidth={2}
                  dot={{ r: 4, stroke: "#15181D", strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="muscle"
                  type="monotone"
                  dataKey="muscle_mass_pct"
                  name="Muscle (%)"
                  stroke="#4FD1C5"
                  strokeWidth={2}
                  dot={{ r: 4, stroke: "#15181D", strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <Info size={24} className="text-[#8A919C]/40 mb-2" />
              <p className="text-xs text-[#8A919C]">Plotting requires at least 2 entries of body metrics history.</p>
            </div>
          )}
        </div>
      </div>

      {/* History Log Table */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5">
        <h2 className="text-sm font-semibold mb-3">Measurement History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8A919C] border-b border-[#232830]">
                <th className="py-2.5 pr-3 font-medium">Date</th>
                <th className="py-2.5 pr-3 font-medium text-right">Weight (kg)</th>
                <th className="py-2.5 pr-3 font-medium text-right">Body Fat %</th>
                <th className="py-2.5 pr-3 font-medium text-right">Muscle %</th>
                <th className="py-2.5 pr-3 font-medium text-right">BMI</th>
                <th className="py-2.5 pr-3 font-medium text-right">Visceral Fat</th>
                <th className="py-2.5 pr-3 font-medium text-right">BMR (kcal)</th>
              </tr>
            </thead>
            <tbody>
              {historyLogs.length > 0 ? (
                historyLogs.map((m, i) => (
                  <tr key={m.id || i} className={i % 2 ? "bg-[#0F1216]" : ""}>
                    <td className="py-2.5 pr-3 text-[#8A919C] whitespace-nowrap">
                      {new Date(m.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-right text-[#F4B740] font-mono">
                      {m.weight_kg}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-[#EF7B57]">
                      {m.fat_mass_pct !== null ? `${m.fat_mass_pct}%` : "--"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-[#4FD1C5]">
                      {m.muscle_mass_pct !== null ? `${m.muscle_mass_pct}%` : "--"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-[#7FA6FF]">
                      {m.bmi !== null ? m.bmi : "--"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">
                      {m.visceral_fat !== null ? m.visceral_fat : "--"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">
                      {m.bmr !== null ? m.bmr : "--"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#8A919C]">
                    No historical logs found. Upload a screenshot to generate your first entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Count Note */}
        {bodyMetrics.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#232830] pt-3 mt-3 text-xs text-[#8A919C]">
            <span>
              Showing {Math.min(bodyMetrics.length, 20)} of {bodyMetrics.length} records
            </span>
          </div>
        )}
      </div>

      {/* Review-and-Confirm / Manual Entry Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="max-w-3xl w-full rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4 my-8 relative max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#232830] pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck size={16} className="text-[#F4B740]" /> Review &amp; Confirm Body Metrics
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-[#8A919C] hover:text-[#E7E9EC] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
              {formNotice && (
                <div className="rounded border border-[#F4B740]/30 bg-[#F4B740]/5 p-2.5 flex items-start gap-2 text-xs text-[#F4B740]">
                  <Info size={15} className="shrink-0 mt-0.5" />
                  <span>{formNotice}</span>
                </div>
              )}

              {formErrors.submit && (
                <div className="rounded border border-red-500/30 bg-red-500/5 p-2.5 text-red-500">
                  {formErrors.submit}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* CORE Group */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#F4B740] uppercase tracking-wider text-[10px] border-b border-[#232830] pb-1">
                    Core Metrics (Required)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => handleFieldChange("date", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.date ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.date && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.date}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Weight * (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 72.5"
                        value={formData.weight_kg}
                        onChange={(e) => handleFieldChange("weight_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.weight_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.weight_kg && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.weight_kg}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Height (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 178.0"
                        value={formData.height_cm}
                        onChange={(e) => handleFieldChange("height_cm", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.height_cm ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.height_cm && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.height_cm}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Age</label>
                      <input
                        type="number"
                        placeholder="e.g. 28"
                        value={formData.age}
                        onChange={(e) => handleFieldChange("age", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.age ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.age && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.age}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Body Age</label>
                      <input
                        type="number"
                        placeholder="e.g. 26"
                        value={formData.body_age}
                        onChange={(e) => handleFieldChange("body_age", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.body_age ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.body_age && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.body_age}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">BMI</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 22.4"
                        value={formData.bmi}
                        onChange={(e) => handleFieldChange("bmi", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.bmi ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.bmi && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.bmi}</p>}
                    </div>
                  </div>
                </div>

                {/* COMPOSITION Group */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#F4B740] uppercase tracking-wider text-[10px] border-b border-[#232830] pb-1">
                    Composition
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Fat Mass %</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 15.2"
                        value={formData.fat_mass_pct}
                        onChange={(e) => handleFieldChange("fat_mass_pct", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.fat_mass_pct ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.fat_mass_pct && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.fat_mass_pct}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Fat Mass (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 11.0"
                        value={formData.fat_mass_kg}
                        onChange={(e) => handleFieldChange("fat_mass_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.fat_mass_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.fat_mass_kg && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.fat_mass_kg}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Muscle Mass %</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 79.4"
                        value={formData.muscle_mass_pct}
                        onChange={(e) => handleFieldChange("muscle_mass_pct", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.muscle_mass_pct ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.muscle_mass_pct && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.muscle_mass_pct}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Muscle Mass (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 57.2"
                        value={formData.muscle_mass_kg}
                        onChange={(e) => handleFieldChange("muscle_mass_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.muscle_mass_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.muscle_mass_kg && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.muscle_mass_kg}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Visceral Fat Index</label>
                      <input
                        type="number"
                        placeholder="e.g. 6"
                        value={formData.visceral_fat}
                        onChange={(e) => handleFieldChange("visceral_fat", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.visceral_fat ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.visceral_fat && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.visceral_fat}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">BMR (kcal)</label>
                      <input
                        type="number"
                        placeholder="e.g. 1650"
                        value={formData.bmr}
                        onChange={(e) => handleFieldChange("bmr", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.bmr ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                      {formErrors.bmr && <p className="text-[10px] text-red-500 mt-0.5">{formErrors.bmr}</p>}
                    </div>
                  </div>
                </div>

                {/* SEGMENTAL ARMS Group */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#F4B740] uppercase tracking-wider text-[10px] border-b border-[#232830] pb-1">
                    Segmental Composition — Arms
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Left Arm Muscle (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 3.25"
                        value={formData.arm_left_muscle_kg}
                        onChange={(e) => handleFieldChange("arm_left_muscle_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.arm_left_muscle_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Right Arm Muscle (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 3.30"
                        value={formData.arm_right_muscle_kg}
                        onChange={(e) => handleFieldChange("arm_right_muscle_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.arm_right_muscle_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Left Arm Fat (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0.42"
                        value={formData.arm_left_fat_kg}
                        onChange={(e) => handleFieldChange("arm_left_fat_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.arm_left_fat_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Right Arm Fat (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0.40"
                        value={formData.arm_right_fat_kg}
                        onChange={(e) => handleFieldChange("arm_right_fat_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.arm_right_fat_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* SEGMENTAL LEGS Group */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#F4B740] uppercase tracking-wider text-[10px] border-b border-[#232830] pb-1">
                    Segmental Composition — Legs
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Left Leg Muscle (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 9.12"
                        value={formData.leg_left_muscle_kg}
                        onChange={(e) => handleFieldChange("leg_left_muscle_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.leg_left_muscle_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Right Leg Muscle (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 9.20"
                        value={formData.leg_right_muscle_kg}
                        onChange={(e) => handleFieldChange("leg_right_muscle_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.leg_right_muscle_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Left Leg Fat (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 1.25"
                        value={formData.leg_left_fat_kg}
                        onChange={(e) => handleFieldChange("leg_left_fat_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.leg_left_fat_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Right Leg Fat (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 1.20"
                        value={formData.leg_right_fat_kg}
                        onChange={(e) => handleFieldChange("leg_right_fat_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.leg_right_fat_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* SEGMENTAL TORSO Group */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#F4B740] uppercase tracking-wider text-[10px] border-b border-[#232830] pb-1">
                    Segmental Composition — Torso
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Torso Muscle (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 26.50"
                        value={formData.torso_muscle_kg}
                        onChange={(e) => handleFieldChange("torso_muscle_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.torso_muscle_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A919C] mb-1 font-medium">Torso Fat (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 3.12"
                        value={formData.torso_fat_kg}
                        onChange={(e) => handleFieldChange("torso_fat_kg", e.target.value)}
                        className={`w-full bg-[#0C0E12] border rounded-lg px-2.5 py-1.5 text-[#E7E9EC] focus:ring-0 focus:outline-none ${
                          formErrors.torso_fat_kg ? "border-red-500" : "border-[#232830] focus:border-[#F4B740]"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-[#232830] pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="py-2 px-4 rounded-lg border border-[#232830] hover:border-[#3A414C] bg-transparent text-xs text-[#8A919C] hover:text-[#E7E9EC] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="py-2 px-5 rounded-lg bg-[#4FD1C5] hover:bg-[#3bb8ad] text-[#0C0E12] font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} /> Save Record
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
