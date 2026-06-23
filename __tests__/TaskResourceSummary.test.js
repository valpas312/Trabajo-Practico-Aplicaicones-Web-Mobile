import React from "react";
import { render } from "@testing-library/react-native";
import TaskResourceSummary from "../src/components/TaskResourceSummary";

const styles = { taskImage: {}, reminderMeta: {} };

test("renders associated task resources", () => {
  const task = {
    imageUri: "file://foto.jpg",
    location: { latitude: -34.6037, longitude: -58.3816 },
    contact: { name: "Ada" },
    calendarEventId: "evt-1"
  };
  const { getByText, getByTestId } = render(<TaskResourceSummary task={task} styles={styles} />);
  expect(getByTestId("task-image")).toBeTruthy();
  expect(getByText(/Ubicacion:/)).toBeTruthy();
  expect(getByText("Responsable: Ada")).toBeTruthy();
  expect(getByText("Evento calendario: creado")).toBeTruthy();
});
