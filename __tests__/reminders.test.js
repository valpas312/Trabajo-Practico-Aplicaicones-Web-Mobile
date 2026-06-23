import { getRepeatLabel, validateTaskForm } from "../src/utils/reminders";

test("format custom repeat labels", () => {
  expect(getRepeatLabel(45)).toBe("Cada 45 seg");
  expect(getRepeatLabel(300)).toBe("Cada 5 min");
});

test("validates task form business rules", () => {
  expect(validateTaskForm("", "Aviso", Date.now() + 1000).valid).toBe(false);
  expect(validateTaskForm("Tarea", "Aviso", Date.now() - 1000).valid).toBe(false);
  expect(validateTaskForm("Tarea", "Aviso", Date.now() + 1000).valid).toBe(true);
});
