import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator();
const USERS_KEY = "@todo_app_users";
const SESSION_KEY = "@todo_app_session";
const TASKS_KEY_PREFIX = "@todo_app_tasks";

const REPEAT_OPTIONS = [
  { label: "Una vez", minutes: 0 },
  { label: "Cada 5 min", minutes: 5 },
  { label: "Cada 15 min", minutes: 15 },
  { label: "Cada 30 min", minutes: 30 },
  { label: "Cada hora", minutes: 60 },
  { label: "Diario", minutes: 1440 }
];

function AuthCard({ title, children, footerText, footerAction, footerActionText }) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.centered}
      >
        <View style={styles.authPanel}>
          <Text style={styles.logo}>Tareas</Text>
          <Text style={styles.authTitle}>{title}</Text>
          {children}
          <View style={styles.footerRow}>
            <Text style={styles.mutedText}>{footerText}</Text>
            <TouchableOpacity onPress={footerAction}>
              <Text style={styles.linkText}>{footerActionText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoginScreen({ navigation, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Faltan datos", "Ingresa usuario y contrasena.");
      return;
    }

    const users = await getStoredUsers();
    const user = users.find(
      (item) => item.username === username.trim() && item.password === password
    );

    if (!user) {
      Alert.alert("Datos incorrectos", "Revisa el usuario o la contrasena.");
      return;
    }

    await AsyncStorage.setItem(SESSION_KEY, user.username);
    onLogin(user.username);
  };

  return (
    <AuthCard
      title="Iniciar sesion"
      footerText="No tenes cuenta?"
      footerAction={() => navigation.navigate("Registro")}
      footerActionText="Registrate"
    >
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Usuario"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Contrasena"
        secureTextEntry
        style={styles.input}
      />
      <Button title="Entrar" onPress={login} />
    </AuthCard>
  );
}

function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const register = async () => {
    const cleanUsername = username.trim();

    if (!cleanUsername || !password.trim()) {
      Alert.alert("Faltan datos", "Completa usuario y contrasena.");
      return;
    }

    const users = await getStoredUsers();
    const exists = users.some((user) => user.username === cleanUsername);

    if (exists) {
      Alert.alert("Usuario existente", "Elegi otro nombre de usuario.");
      return;
    }

    await AsyncStorage.setItem(
      USERS_KEY,
      JSON.stringify([...users, { username: cleanUsername, password }])
    );
    Alert.alert("Registro listo", "Ya podes iniciar sesion.");
    navigation.navigate("Login");
  };

  return (
    <AuthCard
      title="Crear cuenta"
      footerText="Ya tenes cuenta?"
      footerAction={() => navigation.navigate("Login")}
      footerActionText="Ingresa"
    >
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Usuario"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Contrasena"
        secureTextEntry
        style={styles.input}
      />
      <Button title="Registrarme" onPress={register} />
    </AuthCard>
  );
}

function HomeScreen({ navigation, route, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const username = route.params?.username;

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadTasks);
    return unsubscribe;
  }, [navigation, username]);

  useEffect(() => {
    checkDueReminders();
    const timer = setInterval(checkDueReminders, 15000);
    return () => clearInterval(timer);
  }, [tasks, username]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks]
  );

  const loadTasks = async () => {
    const stored = await AsyncStorage.getItem(getTasksKey(username));
    setTasks(stored ? JSON.parse(stored) : []);
  };

  const saveTasks = async (nextTasks) => {
    setTasks(nextTasks);
    await AsyncStorage.setItem(getTasksKey(username), JSON.stringify(nextTasks));
  };

  const checkDueReminders = async () => {
    const now = Date.now();
    let changed = false;
    const dueTasks = [];

    const nextTasks = tasks.map((task) => {
      if (task.done || !task.nextReminderAt || now < task.nextReminderAt) {
        return task;
      }

      dueTasks.push(task);
      changed = true;

      if (!task.repeatMinutes) {
        return { ...task, nextReminderAt: null };
      }

      return {
        ...task,
        nextReminderAt: getNextRepeatedReminder(task.nextReminderAt, task.repeatMinutes)
      };
    });

    if (!changed) {
      return;
    }

    await saveTasks(nextTasks);
    dueTasks.forEach((task) => {
      Alert.alert("Recordatorio", `${task.title}\n${task.reminder}`);
    });
  };

  const toggleTask = async (id) => {
    const nextTasks = tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    await saveTasks(nextTasks);
  };

  const deleteTask = async (task) => {
    await saveTasks(tasks.filter((item) => item.id !== task.id));
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    onLogout();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hola, {username}</Text>
          <Text style={styles.headerTitle}>Tus tareas</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryNumber}>{pendingTasks}</Text>
        <Text style={styles.summaryText}>pendientes con recordatorios configurables</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Todavia no agregaste tareas.</Text>
        }
        renderItem={({ item }) => (
          <TaskItem task={item} onToggle={toggleTask} onDelete={deleteTask} />
        )}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("NuevaTarea", { username })}
      >
        <Text style={styles.addButtonText}>+ Nueva tarea</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  return (
    <View style={styles.taskItem}>
      <TouchableOpacity
        style={[styles.checkCircle, task.done && styles.checkCircleDone]}
        onPress={() => onToggle(task.id)}
      >
        <Text style={styles.checkText}>{task.done ? "✓" : ""}</Text>
      </TouchableOpacity>
      <View style={styles.taskBody}>
        <Text style={[styles.taskTitle, task.done && styles.taskDone]}>
          {task.title}
        </Text>
        <Text style={styles.reminderText}>Recordatorio: {task.reminder}</Text>
        <Text style={styles.reminderMeta}>
          {task.reminderTime || "Sin horario"} - {getRepeatLabel(task.repeatMinutes)}
        </Text>
        <Text style={styles.reminderMeta}>
          Proximo aviso: {formatNextReminder(task.nextReminderAt)}
        </Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(task)}>
        <Text style={styles.deleteText}>Eliminar</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateTaskScreen({ navigation, route }) {
  const [title, setTitle] = useState("");
  const [reminder, setReminder] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [repeatMinutes, setRepeatMinutes] = useState(0);
  const username = route.params?.username;

  const createTask = async () => {
    const cleanTitle = title.trim();
    const cleanReminder = reminder.trim();
    const cleanTime = reminderTime.trim();

    if (!cleanTitle || !cleanReminder || !cleanTime) {
      Alert.alert("Faltan datos", "La tarea necesita titulo, recordatorio y horario.");
      return;
    }

    const nextReminderAt = parseReminderTime(cleanTime);
    if (!nextReminderAt) {
      Alert.alert("Horario invalido", "Usa el formato HH:mm, por ejemplo 08:30 o 21:00.");
      return;
    }

    const stored = await AsyncStorage.getItem(getTasksKey(username));
    const tasks = stored ? JSON.parse(stored) : [];
    const nextTask = {
      id: Date.now().toString(),
      title: cleanTitle,
      reminder: cleanReminder,
      reminderTime: cleanTime,
      repeatMinutes,
      nextReminderAt,
      done: false,
      createdAt: new Date().toISOString()
    };

    await AsyncStorage.setItem(getTasksKey(username), JSON.stringify([nextTask, ...tasks]));
    Alert.alert("Tarea creada", `Primer aviso: ${formatNextReminder(nextReminderAt)}.`);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.formScroll}>
        <View style={styles.formHeader}>
          <Text style={styles.headerTitle}>Nueva tarea</Text>
          <Text style={styles.mutedText}>Configura horario y repeticion del recordatorio.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Titulo</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Entregar trabajo practico"
            style={styles.input}
          />

          <Text style={styles.label}>Mensaje del recordatorio</Text>
          <TextInput
            value={reminder}
            onChangeText={setReminder}
            placeholder="Ej: Revisar antes de enviarlo"
            style={[styles.input, styles.largeInput]}
            multiline
          />

          <Text style={styles.label}>Horario</Text>
          <TextInput
            value={reminderTime}
            onChangeText={setReminderTime}
            placeholder="HH:mm, ej: 20:30"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.input}
          />

          <Text style={styles.label}>Repeticion</Text>
          <View style={styles.optionGrid}>
            {REPEAT_OPTIONS.map((option) => {
              const selected = repeatMinutes === option.minutes;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.optionButton, selected && styles.optionButtonSelected]}
                  onPress={() => setRepeatMinutes(option.minutes)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button title="Guardar tarea" onPress={createTask} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function getStoredUsers() {
  const stored = await AsyncStorage.getItem(USERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function getTasksKey(username) {
  return `${TASKS_KEY_PREFIX}_${username}`;
}

function parseReminderTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }

  const nextDate = new Date();
  nextDate.setHours(Number(match[1]), Number(match[2]), 0, 0);

  if (nextDate.getTime() <= Date.now()) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate.getTime();
}

function getNextRepeatedReminder(previousReminderAt, repeatMinutes) {
  const intervalMs = repeatMinutes * 60 * 1000;
  let nextReminderAt = previousReminderAt + intervalMs;

  while (nextReminderAt <= Date.now()) {
    nextReminderAt += intervalMs;
  }

  return nextReminderAt;
}

function formatNextReminder(value) {
  if (!value) {
    return "sin proximos avisos";
  }

  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const dayLabel =
    date.toDateString() === today.toDateString()
      ? "hoy"
      : date.toDateString() === tomorrow.toDateString()
        ? "manana"
        : date.toLocaleDateString();

  return `${dayLabel} ${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function getRepeatLabel(minutes) {
  if (minutes === undefined || minutes === null) {
    return "Sin repeticion";
  }

  const option = REPEAT_OPTIONS.find((item) => item.minutes === minutes);
  return option ? option.label : `Cada ${minutes} min`;
}

function padTime(value) {
  return value.toString().padStart(2, "0");
}

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const prepare = async () => {
      const session = await AsyncStorage.getItem(SESSION_KEY);
      setCurrentUser(session);
      setCheckingSession(false);
    };

    prepare();
  }, []);

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.headerTitle}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
          <>
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen
                  {...props}
                  route={{
                    ...props.route,
                    params: { username: currentUser }
                  }}
                  onLogout={() => setCurrentUser(null)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="NuevaTarea" component={CreateTaskScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={setCurrentUser} />}
            </Stack.Screen>
            <Stack.Screen name="Registro" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    paddingHorizontal: 20
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F7FB"
  },
  centered: {
    flex: 1,
    justifyContent: "center"
  },
  authPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 22,
    shadowColor: "#182033",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4
  },
  logo: {
    color: "#276EF1",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  authTitle: {
    color: "#182033",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DEEA",
    borderRadius: 8,
    borderWidth: 1,
    color: "#182033",
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  largeInput: {
    minHeight: 86,
    textAlignVertical: "top"
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 18
  },
  mutedText: {
    color: "#667085",
    fontSize: 14
  },
  linkText: {
    color: "#276EF1",
    fontSize: 14,
    fontWeight: "700"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 22
  },
  hello: {
    color: "#667085",
    fontSize: 14,
    marginBottom: 2
  },
  headerTitle: {
    color: "#182033",
    fontSize: 28,
    fontWeight: "800"
  },
  logoutButton: {
    backgroundColor: "#E9EEF8",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  logoutText: {
    color: "#182033",
    fontWeight: "700"
  },
  summary: {
    backgroundColor: "#DDEBFF",
    borderRadius: 8,
    marginTop: 22,
    padding: 18
  },
  summaryNumber: {
    color: "#276EF1",
    fontSize: 34,
    fontWeight: "900"
  },
  summaryText: {
    color: "#344054",
    fontSize: 15,
    marginTop: 2
  },
  listContent: {
    paddingBottom: 96,
    paddingTop: 18
  },
  emptyText: {
    color: "#667085",
    fontSize: 16,
    marginTop: 30,
    textAlign: "center"
  },
  taskItem: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 12,
    padding: 14,
    shadowColor: "#182033",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  checkCircle: {
    alignItems: "center",
    borderColor: "#276EF1",
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: "center",
    marginRight: 12,
    width: 28
  },
  checkCircleDone: {
    backgroundColor: "#276EF1"
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  taskBody: {
    flex: 1
  },
  taskTitle: {
    color: "#182033",
    fontSize: 16,
    fontWeight: "800"
  },
  taskDone: {
    color: "#98A2B3",
    textDecorationLine: "line-through"
  },
  reminderText: {
    color: "#667085",
    fontSize: 13,
    marginTop: 4
  },
  reminderMeta: {
    color: "#8A94A6",
    fontSize: 12,
    marginTop: 3
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  deleteText: {
    color: "#D92D20",
    fontSize: 13,
    fontWeight: "700"
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#276EF1",
    borderRadius: 8,
    bottom: 24,
    left: 20,
    paddingVertical: 16,
    position: "absolute",
    right: 20
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  formScroll: {
    paddingBottom: 32
  },
  formHeader: {
    paddingTop: 28
  },
  form: {
    marginTop: 24
  },
  label: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18
  },
  optionButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DEEA",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  optionButtonSelected: {
    backgroundColor: "#276EF1",
    borderColor: "#276EF1"
  },
  optionText: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "800"
  },
  optionTextSelected: {
    color: "#FFFFFF"
  }
});
