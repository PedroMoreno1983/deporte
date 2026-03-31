import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d1928",
          borderTopColor: "rgba(255,255,255,0.06)",
          height: 64,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "rgba(255,255,255,0.3)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: "Jugadores",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="injuries"
        options={{
          title: "Lesiones",
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: "Predicciones",
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
