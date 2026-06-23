const loadOptionalModule = (moduleName) => {
  try {
    const runtimeRequire = eval("require");
    return runtimeRequire(moduleName);
  } catch (error) {
    return null;
  }
};

export const getImagePicker = () => loadOptionalModule("expo-image-picker");
export const getLocation = () => loadOptionalModule("expo-location");
export const getContacts = () => loadOptionalModule("expo-contacts");
export const getCalendar = () => loadOptionalModule("expo-calendar");

export const assertModuleAvailable = (moduleValue, label, Alert) => {
  if (moduleValue) return true;
  Alert.alert(
    "Dependencia no instalada",
    `Para usar ${label}, ejecuta npm install y reinicia Expo. La app puede seguir funcionando sin este recurso.`
  );
  return false;
};
