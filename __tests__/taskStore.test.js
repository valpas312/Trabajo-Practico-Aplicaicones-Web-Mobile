import { createTaskStore } from "../src/stores/taskStore";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => null)
}));

const buildStore = () => {
  let state;
  const get = () => state;
  const set = (update) => {
    state = { ...state, ...(typeof update === "function" ? update(state) : update) };
  };
  state = createTaskStore(set, get);
  return { get, set };
};

test("task store actions add, update and delete tasks", async () => {
  const { get } = buildStore();
  get().setUsername("ana");
  await get().addTask({ id: "1", title: "Comprar", done: false, location: { latitude: -34.6, longitude: -58.3 } });
  expect(get().tasks).toHaveLength(1);
  expect(get().tasks[0].location).toEqual({ latitude: -34.6, longitude: -58.3 });
  await get().updateTask("1", { done: true });
  expect(get().tasks[0].done).toBe(true);
  await get().deleteTask("1");
  expect(get().tasks).toHaveLength(0);
});
