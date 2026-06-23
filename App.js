import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import * as Calendar from "expo-calendar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTaskStore } from "./src/stores/taskStore";
import TaskResourceSummary from "./src/components/TaskResourceSummary";
import { REPEAT_OPTIONS, getRepeatLabel, getTaskRepeatSeconds, validateTaskForm } from "./src/utils/reminders";
import { assertModuleAvailable, getCalendar, getContacts, getImagePicker, getLocation } from "./src/utils/optionalExpoModules";

const Stack = createNativeStackNavigator();
const USERS_KEY = "@todo_app_users";
const SESSION_KEY = "@todo_app_session";

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
  const username = route.params?.username;
  const tasks = useTaskStore((state) => state.tasks);
  const loadTasksFromStore = useTaskStore((state) => state.loadTasks);
  const replaceTasks = useTaskStore((state) => state.replaceTasks);
  const deleteTaskById = useTaskStore((state) => state.deleteTask);
  const clearTasks = useTaskStore((state) => state.clearTasks);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => loadTasksFromStore(username));
    return unsubscribe;
  }, [navigation, username, loadTasksFromStore]);

  useEffect(() => {
    checkDueReminders();
    const timer = setInterval(checkDueReminders, 1000);
    return () => clearInterval(timer);
  }, [tasks, username]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => !task.done).length,
    [tasks]
  );

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

      const repeatSeconds = getTaskRepeatSeconds(task);
      if (!repeatSeconds) {
        return { ...task, nextReminderAt: null };
      }

      return {
        ...task,
        nextReminderAt: getNextRepeatedReminder(task.nextReminderAt, repeatSeconds)
      };
    });

    if (!changed) {
      return;
    }

    await replaceTasks(nextTasks);
    dueTasks.forEach((task) => {
      Alert.alert("Recordatorio", `${task.title}\n${task.reminder}`);
    });
  };

  const toggleTask = async (id) => {
    const nextTasks = tasks.map((task) => {
      if (task.id !== id) {
        return task;
      }

      return { ...task, done: !task.done };
    });
    await replaceTasks(nextTasks);
  };

  const deleteTask = async (task) => {
    await deleteTaskById(task.id);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    clearTasks();
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
          {formatReminderDateLabel(task.reminderDate)} {task.reminderTime || "Sin horario"} - {getRepeatLabel(getTaskRepeatSeconds(task))}
        </Text>
        <Text style={styles.reminderMeta}>
          Proximo aviso: {formatNextReminder(task.nextReminderAt)}
        </Text>
        <TaskResourceSummary task={task} styles={styles} />
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(getDefaultReminderTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [repeatSeconds, setRepeatSeconds] = useState(0);
  const [customRepeatSeconds, setCustomRepeatSeconds] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [location, setLocation] = useState(null);
  const [contact, setContact] = useState(null);
  const username = route.params?.username;
  const addTask = useTaskStore((state) => state.addTask);

  const requestPermission = async (requester, deniedMessage) => {
    const response = await requester();
    if (response.status === "granted") return true;
    Alert.alert("Permiso requerido", deniedMessage);
    return false;
  };

  const takePhoto = async () => {
    const ImagePicker = getImagePicker();
    if (!assertModuleAvailable(ImagePicker, "la camara", Alert)) return;
    const granted = await requestPermission(
      ImagePicker.requestCameraPermissionsAsync,
      "No se puede abrir la camara sin permiso. Podes habilitarlo desde ajustes."
    );
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const pickImage = async () => {
    const ImagePicker = getImagePicker();
    if (!assertModuleAvailable(ImagePicker, "la galeria", Alert)) return;
    const granted = await requestPermission(
      ImagePicker.requestMediaLibraryPermissionsAsync,
      "No se puede acceder a la galeria sin permiso. Podes habilitarlo desde ajustes."
    );
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const attachLocation = async () => {
    const Location = getLocation();
    if (!assertModuleAvailable(Location, "la ubicacion", Alert)) return;
    const granted = await requestPermission(
      Location.requestForegroundPermissionsAsync,
      "No se puede obtener la ubicacion sin permiso de GPS."
    );
    if (!granted) return;
    const current = await Location.getCurrentPositionAsync({});
    setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
  };

  const attachContact = async () => {
    const Contacts = getContacts();
    if (!assertModuleAvailable(Contacts, "los contactos", Alert)) return;
    const granted = await requestPermission(
      Contacts.requestPermissionsAsync,
      "No se puede seleccionar un responsable sin permiso de contactos."
    );
    if (!granted) return;
    const result = await Contacts.presentContactPickerAsync();
    if (result) setContact({ id: result.id, name: result.name, phone: result.phoneNumbers?.[0]?.number || "" });
  };

  const createCalendarEvent = async (task) => {
    const Calendar = getCalendar();
    if (!assertModuleAvailable(Calendar, "el calendario", Alert)) return null;
    const granted = await requestPermission(
      Calendar.requestCalendarPermissionsAsync,
      "No se puede crear el evento sin permiso de calendario."
    );
    if (!granted) return null;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendar = calendars.find((item) => item.allowsModifications) || calendars[0];
    if (!calendar) {
      Alert.alert("Calendario no disponible", "No se encontro un calendario editable en el dispositivo.");
      return null;
    }
    return Calendar.createEventAsync(calendar.id, {
      title: task.title,
      notes: task.reminder,
      startDate: new Date(task.nextReminderAt),
      endDate: new Date(task.nextReminderAt + 30 * 60 * 1000),
      location: task.location ? `${task.location.latitude}, ${task.location.longitude}` : undefined
    });
  };

  const updateCustomRepeat = (value) => {
    const onlyNumbers = value.replace(/[^0-9]/g, "");
    setCustomRepeatSeconds(onlyNumbers);

    if (onlyNumbers) {
      setRepeatSeconds(Number(onlyNumbers));
    }
  };

  const createTask = async () => {
    const cleanTitle = title.trim();
    const cleanReminder = reminder.trim();

    const nextReminderAt = buildReminderDateTime(selectedDate, selectedTime);
    const validation = validateTaskForm(cleanTitle, cleanReminder, nextReminderAt);
    if (!validation.valid) {
      Alert.alert("Datos invalidos", validation.message);
      return;
    }
    const nextTask = {
      id: Date.now().toString(),
      title: cleanTitle,
      reminder: cleanReminder,
      reminderDate: formatDateValue(selectedDate),
      reminderTime: formatTimeValue(selectedTime),
      repeatSeconds,
      nextReminderAt,
      imageUri,
      location,
      contact,
      done: false,
      createdAt: new Date().toISOString()
    };

    const calendarEventId = await createCalendarEvent(nextTask);
    await addTask({ ...nextTask, calendarEventId });
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

          <Text style={styles.label}>Fecha</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatDateDisplay(selectedDate)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(event, date) => {
                if (Platform.OS !== "ios") {
                  setShowDatePicker(false);
                }

                if (date) {
                  setSelectedDate(date);
                }
              }}
            />
          )}

          <Text style={styles.label}>Horario</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.pickerButtonText}>{formatTimeValue(selectedTime)}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              is24Hour
              onChange={(event, date) => {
                if (Platform.OS !== "ios") {
                  setShowTimePicker(false);
                }

                if (date) {
                  setSelectedTime(date);
                }
              }}
            />
          )}

          <Text style={styles.label}>Repeticion</Text>
          <View style={styles.optionGrid}>
            {REPEAT_OPTIONS.map((option) => {
              const selected = repeatSeconds === option.seconds;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.optionButton, selected && styles.optionButtonSelected]}
                  onPress={() => {
                    setCustomRepeatSeconds("");
                    setRepeatSeconds(option.seconds);
                  }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Otra repeticion en segundos</Text>
          <TextInput
            value={customRepeatSeconds}
            onChangeText={updateCustomRepeat}
            placeholder="Ej: 45"
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.selectedRepeat}>Seleccionado: {getRepeatLabel(repeatSeconds)}</Text>

          <Text style={styles.label}>Recursos del dispositivo</Text>
          <View style={styles.resourceGrid}>
            <Button title="Tomar foto" onPress={takePhoto} />
            <Button title="Elegir galeria" onPress={pickImage} />
            <Button title="Usar GPS" onPress={attachLocation} />
            <Button title="Contacto" onPress={attachContact} />
          </View>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}
          {location ? <Text style={styles.reminderMeta}>Ubicacion asociada: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text> : null}
          {contact ? <Text style={styles.reminderMeta}>Responsable: {contact.name}</Text> : null}

          <Button title="Guardar tarea y crear evento" onPress={createTask} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function getStoredUsers() {
  const stored = await AsyncStorage.getItem(USERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function getDefaultReminderTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  date.setSeconds(0, 0);
  return date;
}

function buildReminderDateTime(datePart, timePart) {
  const reminderDate = new Date(datePart);
  reminderDate.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return reminderDate.getTime();
}

function getNextRepeatedReminder(previousReminderAt, repeatSeconds) {
  const intervalMs = repeatSeconds * 1000;
  let nextReminderAt = previousReminderAt + intervalMs;

  while (nextReminderAt <= Date.now()) {
    nextReminderAt += intervalMs;
  }

  return nextReminderAt;
}

function formatDateValue(date) {
  return `${padTime(date.getDate())}/${padTime(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimeValue(date) {
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function formatDateDisplay(date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return `Hoy - ${formatDateValue(date)}`;
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return `Manana - ${formatDateValue(date)}`;
  }

  return formatDateValue(date);
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

  return `${dayLabel} ${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
}

function formatReminderDateLabel(value) {
  if (!value) {
    return "Sin fecha";
  }

  if (value === "hoy") {
    return "Hoy";
  }

  if (value === "manana") {
    return "Manana";
  }

  return value;
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingScreen}>
          <Text style={styles.headerTitle}>Cargando...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
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
  },
  pickerButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DEEA",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  pickerButtonText: {
    color: "#182033",
    fontSize: 16,
    fontWeight: "700"
  },
  selectedRepeat: {
    color: "#276EF1",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 18,
    marginTop: -6
  },
  resourceGrid: {
    gap: 10,
    marginBottom: 14
  },
  previewImage: {
    borderRadius: 8,
    height: 160,
    marginBottom: 12,
    width: "100%"
  },
  taskImage: {
    borderRadius: 8,
    height: 90,
    marginTop: 8,
    width: "100%"
  }
});
