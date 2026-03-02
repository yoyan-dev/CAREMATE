import { IconSymbol } from "@/components/ui/icon-symbol";
import { colors } from "@/theme/color";
import { Link } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroContainer}>
        <Text style={styles.header}>Welcome to CAREMATE</Text>
        <Text style={styles.subHeader}>
          Your AI-powered first aid assistant
        </Text>
      </View>

      <View style={styles.introCard}>
        <Image
          source={require("../../assets/images/aidme.png")}
          style={styles.heroImage}
        />
        <Text style={styles.introText}>
          Hi there! I&apos;m Caremate, your intelligent first aid buddy. How can
          I assist you today?
        </Text>
      </View>

      <Link href="/screens/chatbot-screen" asChild>
        <TouchableOpacity style={styles.ctaButton}>
          <IconSymbol size={28} name="mic.fill" color="#fff" />
          <Text style={styles.ctaText}>Chat with AI</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-evenly",
  },

  heroContainer: {
    alignItems: "center",
    marginTop: 20,
  },

  header: {
    fontSize: 40,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "center",
  },

  subHeader: {
    fontSize: 16,
    marginTop: 8,
    color: colors.textDark,
    textAlign: "center",
  },

  heroImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    margin: 5,
  },

  introCard: {
    marginTop: 25,
    alignItems: "center",
    borderRadius: 20,
    padding: 20,
    width: "100%",
  },

  introText: {
    fontSize: 20,
    color: colors.textDark,
    textAlign: "center",
    lineHeight: 22,
  },

  ctaButton: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },

  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
  },
});
