import React, { useEffect, useState, useMemo } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList 
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

// Função auxiliar para tratar datas
const parseTimestamp = (timestamp) => {
  if (!timestamp) return new Date("invalid");
  let date = new Date(timestamp);
  if (!isNaN(date.getTime())) return date;
  const parts = timestamp.match(/(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    date = new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date("invalid");
};

export default function App() {
  const [leituras, setLeituras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = () => {
    setLoading(true);
    fetch("http://192.168.4.2:5000/api/dados")
      .then((response) => {
        if (!response.ok) throw new Error("Falha na conexão");
        return response.json();
      })
      .then((data) => {
        setLeituras(Array.isArray(data) ? data : []);
        setLastRefresh(new Date());
        setError(null);
      })
      .catch(() => setError("Falha ao carregar os dados."))
      .finally(() => {
        setLoading(false);
        setInitialLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Última leitura
  const latestReading = useMemo(() => {
    if (!leituras || leituras.length === 0) return null;
    return leituras.reduce((latest, current) => {
      const latestDate = parseTimestamp(latest.timestamp);
      const currentDate = parseTimestamp(current.timestamp);
      if (isNaN(latestDate.getTime())) return current;
      if (isNaN(currentDate.getTime())) return latest;
      return currentDate > latestDate ? current : latest;
    });
  }, [leituras]);

  // Média
  const averageReading = useMemo(() => {
    if (!leituras || leituras.length === 0) return "N/A";
    return (leituras.reduce((acc, curr) => acc + curr.leitura, 0) / leituras.length).toFixed(2);
  }, [leituras]);

  // Status bomba
  const pumpStatus = latestReading?.bombaLigada === "Sim" ? "Ativa" : "Inativa";

  // Dados do gráfico
  const chartData = {
    labels: leituras
      .slice(-6) // mostra só os últimos 6 pontos
      .map((dado) => parseTimestamp(dado.timestamp).toLocaleTimeString()),
    datasets: [
      {
        data: leituras.slice(-6).map((dado) => dado.leitura),
        color: () => `#06b6d4`,
      },
    ],
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sistema de Monitoramento de Água</Text>
      <Text style={styles.subtitle}>Última atualização: {lastRefresh.toLocaleTimeString()}</Text>

      {loading && <ActivityIndicator size="large" color="#06b6d4" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Cards */}
      <View style={styles.cardGrid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Última Leitura</Text>
          <Text style={styles.cardValue}>{latestReading?.leitura ?? "N/A"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.cardValue}>{latestReading?.status ?? "N/A"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Média</Text>
          <Text style={styles.cardValue}>{averageReading}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bomba</Text>
          <Text style={styles.cardValue}>{pumpStatus}</Text>
        </View>
      </View>

      {/* Gráfico */}
      {!initialLoading && leituras.length > 0 && (
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 32}
          height={220}
          chartConfig={{
            backgroundColor: "#0f172a",
            backgroundGradientFrom: "#0f172a",
            backgroundGradientTo: "#1e293b",
            color: () => `#06b6d4`,
            labelColor: () => "#fff",
          }}
          style={styles.chart}
        />
      )}

      {/* Histórico */}
      <Text style={styles.subtitle}>Histórico de Leituras</Text>
      <FlatList
        data={[...leituras].sort(
          (a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp)
        )}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Text>ID: {item.id}</Text>
            <Text>Leitura: {item.leitura}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Bomba: {item.bombaLigada === "Sim" ? "Ligada" : "Desligada"}</Text>
            <Text>Hora: {parseTimestamp(item.timestamp).toLocaleString()}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#06b6d4", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "white", marginBottom: 12 },
  error: { color: "red", marginVertical: 8 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: "48%",
  },
  cardTitle: { fontSize: 14, color: "white" },
  cardValue: { fontSize: 18, fontWeight: "bold", color: "#06b6d4" },
  chart: { marginVertical: 16, borderRadius: 12 },
  listItem: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
});
