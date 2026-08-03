import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6F8" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return <Redirect href={user ? "/challan-creation" : "/login"} />;
}
