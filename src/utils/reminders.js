export const REPEAT_OPTIONS = [
  { label: "Una vez", seconds: 0 },
  { label: "Cada 10 seg", seconds: 10 },
  { label: "Cada 30 seg", seconds: 30 },
  { label: "Cada 60 seg", seconds: 60 },
  { label: "Cada 5 min", seconds: 300 },
  { label: "Cada 15 min", seconds: 900 },
  { label: "Cada 30 min", seconds: 1800 },
  { label: "Cada hora", seconds: 3600 },
  { label: "Diario", seconds: 86400 }
];

export function getTaskRepeatSeconds(task) {
  if (task.repeatSeconds !== undefined && task.repeatSeconds !== null) return task.repeatSeconds;
  if (task.repeatMinutes !== undefined && task.repeatMinutes !== null) return task.repeatMinutes * 60;
  return null;
}

export function getRepeatLabel(seconds) {
  if (seconds === undefined || seconds === null) return "Sin repeticion";
  const option = REPEAT_OPTIONS.find((item) => item.seconds === seconds);
  if (option) return option.label;
  if (seconds < 60) return `Cada ${seconds} seg`;
  return `Cada ${Math.round(seconds / 60)} min`;
}

export function validateTaskForm(title, reminder, nextReminderAt, now = Date.now()) {
  if (!title.trim() || !reminder.trim()) return { valid: false, message: "La tarea necesita titulo, recordatorio, fecha y horario." };
  if (nextReminderAt <= now) return { valid: false, message: "Elegir una fecha y hora futura." };
  return { valid: true, message: "" };
}
