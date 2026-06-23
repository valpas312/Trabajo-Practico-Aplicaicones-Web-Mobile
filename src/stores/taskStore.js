import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export const TASKS_KEY_PREFIX = "@todo_app_tasks";
export const getTasksKey = (username) => `${TASKS_KEY_PREFIX}_${username}`;

const persistTasks = async (username, tasks) => {
  if (!username) return;
  await AsyncStorage.setItem(getTasksKey(username), JSON.stringify(tasks));
};

export const createTaskStore = (set, get) => ({
  username: null,
  tasks: [],
  setUsername: (username) => set({ username }),
  loadTasks: async (username) => {
    const stored = await AsyncStorage.getItem(getTasksKey(username));
    set({ username, tasks: stored ? JSON.parse(stored) : [] });
  },
  addTask: async (task) => {
    const tasks = [task, ...get().tasks];
    set({ tasks });
    await persistTasks(get().username, tasks);
  },
  updateTask: async (id, changes) => {
    const tasks = get().tasks.map((task) => (task.id === id ? { ...task, ...changes } : task));
    set({ tasks });
    await persistTasks(get().username, tasks);
  },
  replaceTasks: async (tasks) => {
    set({ tasks });
    await persistTasks(get().username, tasks);
  },
  deleteTask: async (id) => {
    const tasks = get().tasks.filter((task) => task.id !== id);
    set({ tasks });
    await persistTasks(get().username, tasks);
  },
  clearTasks: () => set({ username: null, tasks: [] })
});

export const useTaskStore = create(createTaskStore);
