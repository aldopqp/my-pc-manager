import React, { useState, useEffect, useRef, useCallback } from "react";

// Componente que representa la tarjeta de cada PC
const ComputerCard = ({
  id,
  timer,
  onStartTimer,
  onStopTimer,
  mode,
  status,
  startTime,
  userName,
}) => {
  const [selectedHours, setSelectedHours] = useState(1);
  const [nameInput, setNameInput] = useState(userName || "");

  // Actualiza el nombre si cambia el valor recibido por props
  useEffect(() => {
    setNameInput(userName || "");
  }, [userName]);

  // Función para formatear el tiempo transcurrido (en milisegundos) a HH:MM:SS
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Formatea la hora de inicio usando la zona horaria de Argentina
  const formatStartTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  };

  // Calcula y formatea la hora de finalización para el modo fijo
  const formatEndTime = (start, hours) => {
    if (!start || mode !== "fixed") return "";
    const end = new Date(start + hours * 60 * 60 * 1000);
    return end.toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  };

  const handleStartTimer = () => {
    onStartTimer(id, "fixed", selectedHours, nameInput);
  };

  const handleStopTimer = () => {
    onStopTimer(id);
    setNameInput("");
  };

  const borderColor = status === "Libre" ? "border-green-500" : "border-red-400";

  return (
    <div className={`border-4 ${borderColor} rounded-lg p-4 shadow-md w-60 bg-white text-center`}>
      <h2 className="text-lg font-bold">PC {id}</h2>
      <p className="text-sm mt-2">Estado: {status}</p>
      {startTime && <p className="text-sm">Inicio: {formatStartTime(startTime)}</p>}
      {startTime && mode === "fixed" && (
        <p className="text-sm">Fin: {formatEndTime(startTime, selectedHours)}</p>
      )}
      <p className="text-xl my-2 font-mono">{formatTime(timer)}</p>
      <input
        type="text"
        placeholder="Nombre del usuario"
        className="p-1 border rounded mb-2 w-full"
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
      />
      <select
        className="mb-2 p-1 border rounded"
        value={selectedHours}
        onChange={(e) => setSelectedHours(Number(e.target.value))}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((hr) => (
          <option key={hr} value={hr}>
            {hr} hora{hr > 1 ? "s" : ""}
          </option>
        ))}
      </select>
      <button onClick={handleStartTimer} className="bg-blue-600 text-white px-3 py-1 rounded m-1">
        Timer Fijo
      </button>
      <button
        onClick={() => onStartTimer(id, "free", 0, nameInput)}
        className="bg-green-600 text-white px-3 py-1 rounded m-1"
      >
        Tiempo Libre
      </button>
      <button onClick={handleStopTimer} className="bg-red-600 text-white px-3 py-1 rounded m-1">
        Detener
      </button>
    </div>
  );
};

function App() {
  const intervalRefs = useRef({});
  const [sessionHistory, setSessionHistory] = useState(() => {
    const saved = localStorage.getItem("sessionHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const getInitialPCs = () => {
    const saved = localStorage.getItem("pcs");
    if (saved) return JSON.parse(saved);
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      timer: 0,
      running: false,
      mode: null,
      status: "Libre",
      startTime: null,
      userName: "",
    }));
  };

  const [pcs, setPcs] = useState(getInitialPCs);

  // Guarda los cambios en localStorage siempre que pcs o sessionHistory cambien
  useEffect(() => {
    const pcsData = pcs.map(({ id, timer, running, mode, status, startTime, userName }) => ({
      id,
      timer,
      running,
      mode,
      status,
      startTime,
      userName,
    }));
    localStorage.setItem("pcs", JSON.stringify(pcsData));
    localStorage.setItem("sessionHistory", JSON.stringify(sessionHistory));
  }, [pcs, sessionHistory]);

  // Inicia el timer; utiliza useCallback para evitar recrear la función en cada render
  const startTimer = useCallback((id, mode, hours = 1, name = "") => {
    const duration = mode === "fixed" ? hours * 60 * 60 * 1000 : 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
      setPcs((prevPCs) =>
        prevPCs.map((pc) => {
          if (pc.id === id) {
            const elapsed = Date.now() - startTime;
            const newTimer = mode === "fixed" ? Math.max(duration - elapsed, 0) : elapsed;
            const finished = mode === "fixed" && newTimer <= 0;
            if (finished) {
              clearInterval(intervalRefs.current[id]);
              delete intervalRefs.current[id];
              alert(`La PC ${id} se quedó sin tiempo.`);
            }
            return {
              ...pc,
              timer: newTimer,
              running: !finished,
              status: finished ? "Libre" : "Ocupada",
            };
          }
          return pc;
        })
      );
    }, 1000);

    intervalRefs.current[id] = interval;

    setPcs((prevPCs) =>
      prevPCs.map((pc) =>
        pc.id === id && !pc.running
          ? {
              ...pc,
              timer: mode === "fixed" ? duration : 0,
              running: true,
              mode,
              status: "Ocupada",
              startTime,
              userName: name,
            }
          : pc
      )
    );
  }, []);

  // Detiene el timer y actualiza el historial de sesiones
  const stopTimer = useCallback(
    (id) => {
      const stoppedPC = pcs.find((pc) => pc.id === id);
      if (stoppedPC?.running && stoppedPC.userName) {
        setSessionHistory((prev) => [
          ...prev,
          {
            pc: id,
            user: stoppedPC.userName,
            start: new Date(stoppedPC.startTime).toLocaleString(),
            duration: Math.floor(stoppedPC.timer / 1000),
          },
        ]);
      }

      if (intervalRefs.current[id]) {
        clearInterval(intervalRefs.current[id]);
        delete intervalRefs.current[id];
      }

      setPcs((prevPCs) =>
        prevPCs.map((pc) =>
          pc.id === id
            ? {
                ...pc,
                timer: 0,
                running: false,
                mode: null,
                status: "Libre",
                startTime: null,
                userName: "",
              }
            : pc
        )
      );
    },
    [pcs]
  );

  const resetAll = useCallback(() => {
    Object.values(intervalRefs.current).forEach(clearInterval);
    intervalRefs.current = {};
    setPcs(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        timer: 0,
        running: false,
        mode: null,
        status: "Libre",
        startTime: null,
        userName: "",
      }))
    );
    localStorage.removeItem("pcs");
  }, []);

  const downloadCSV = useCallback(() => {
    const headers = "PC,Usuario,Inicio,Duración (segundos)";
    const rows = sessionHistory
      .map((entry) => `${entry.pc},${entry.user},${entry.start},${entry.duration}`)
      .join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historial_armada.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [sessionHistory]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-center gap-4 mb-4">
        <button onClick={resetAll} className="bg-black text-white px-4 py-2 rounded shadow">
          Reiniciar Calculadora
        </button>
        <button onClick={downloadCSV} className="bg-blue-700 text-white px-4 py-2 rounded shadow">
          Descargar Historial
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {pcs.map((pc) => (
          <ComputerCard
            key={pc.id}
            id={pc.id}
            timer={pc.timer}
            mode={pc.mode}
            status={pc.status}
            startTime={pc.startTime}
            userName={pc.userName}
            onStartTimer={startTimer}
            onStopTimer={stopTimer}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
