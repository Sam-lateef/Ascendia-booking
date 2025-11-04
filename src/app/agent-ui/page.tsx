import React, { Suspense } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import AgentUIApp from "./AgentUIApp";

export default function AgentUIPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Agent UI...</div>}>
      <TranscriptProvider>
        <EventProvider>
          <AgentUIApp />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}

