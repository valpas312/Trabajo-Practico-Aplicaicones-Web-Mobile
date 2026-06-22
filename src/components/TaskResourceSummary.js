import React from "react";
import { Image, Text, View } from "react-native";

export default function TaskResourceSummary({ task, styles }) {
  return (
    <View>
      {task.imageUri ? <Image source={{ uri: task.imageUri }} style={styles.taskImage} testID="task-image" /> : null}
      {task.location ? (
        <Text style={styles.reminderMeta}>Ubicacion: {task.location.latitude.toFixed(5)}, {task.location.longitude.toFixed(5)}</Text>
      ) : null}
      {task.contact ? <Text style={styles.reminderMeta}>Responsable: {task.contact.name}</Text> : null}
      {task.calendarEventId ? <Text style={styles.reminderMeta}>Evento calendario: creado</Text> : null}
    </View>
  );
}
