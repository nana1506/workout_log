function estOneRM(weight, reps) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function generateCSVContent(logs) {
  const headers = ["Date", "Exercise Title", "Muscle Group", "Weight (kg)", "Reps", "RPE", "Est. 1RM (kg)"];
  if (!logs || !logs.length) return headers.join(",");

  const rows = logs.map(r => [
    r.completed_at ? r.completed_at.slice(0, 10) : "",
    r.title || r.work_id || "",
    r.muscle_group || "",
    r.weight_kg ?? "",
    r.reps ?? "",
    r.rpe ?? "",
    r.best_1rm || estOneRM(r.weight_kg, r.reps)
  ]);
  
  return [
    headers.join(","),
    ...rows.map(row => row.map(val => {
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(","))
  ].join("\n");
}

export function exportToCSV(logs, activeExerciseTitle) {
  if (!logs || !logs.length) return;

  const csvContent = generateCSVContent(logs);
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const cleanExercise = (activeExerciseTitle || "all-workouts")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
    
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `workout-log_${cleanExercise}_${dateStr}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
