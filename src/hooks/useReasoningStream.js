import { useState, useEffect } from "react";

export default function useReasoningStream(reasoningId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!reasoningId) return;
    setEvents([]);
    const es = new EventSource(`/api/reasoning?id=${reasoningId}`);
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      setEvents((prev) => [...prev, parsed]);
    };
    return () => es.close();
  }, [reasoningId]);

  return { events, clear: () => setEvents([]) };
}
