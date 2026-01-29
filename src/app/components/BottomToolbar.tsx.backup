import React from "react";
import { SessionStatus } from "@/app/types";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;
  codec: string;
  onCodecChange: (newCodec: string) => void;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
  codec,
  onCodecChange,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  const handleCodecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCodec = e.target.value;
    onCodecChange(newCodec);
  };

  function getConnectionButtonLabel() {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  }

  function getConnectionButtonStyle() {
    const cursorClass = isConnecting ? "cursor-not-allowed" : "cursor-pointer";
    const baseClasses = `text-base p-2 w-36 h-full ${cursorClass}`;

    if (isConnected) {
      // Connected -> label "Disconnect" -> gray background with warning red text
      return {
        className: baseClasses,
        style: { background: 'var(--dark-4)', color: 'var(--warning-red)' }
      };
    }
    // Disconnected or connecting -> dark gray button with bright green text
    return {
      className: baseClasses,
      style: { background: 'var(--dark-4)', color: 'var(--bright-green)' }
    };
  }

  const btnStyle = getConnectionButtonStyle();

  return (
    <div className="p-4 flex flex-row flex-wrap items-center justify-center gap-3 md:gap-x-8" style={{ background: 'var(--dark-3)', borderTop: '1px solid var(--border-gray)' }}>
      <button
        onClick={onToggleConnection}
        className={btnStyle.className + " w-28 md:w-36 text-sm md:text-base"}
        style={btnStyle.style}
        disabled={isConnecting}
      >
        {getConnectionButtonLabel()}
      </button>

      <div className="flex flex-row items-center gap-2">
        <input
          id="logs"
          type="checkbox"
          checked={isEventsPaneExpanded}
          onChange={(e) => setIsEventsPaneExpanded(e.target.checked)}
        />
        <label htmlFor="logs" className="flex items-center cursor-pointer" style={{ color: 'var(--text-gray)' }}>
          Logs
        </label>
      </div>

      <div className="flex flex-row items-center gap-2" style={{ color: 'var(--text-gray)' }}>
        <div>Codec:</div>
        {/*
          Codec selector – Lets you force the WebRTC track to use 8 kHz 
          PCMU/PCMA so you can preview how the agent will sound 
          (and how ASR/VAD will perform) when accessed via a 
          phone network.  Selecting a codec reloads the page with ?codec=...
          which our App-level logic picks up and applies via a WebRTC monkey
          patch (see codecPatch.ts).
        */}
        <select
          id="codec-select"
          value={codec}
          onChange={handleCodecChange}
          className="px-2 py-1 focus:outline-none cursor-pointer"
          style={{ background: 'var(--dark-4)', color: 'var(--text-gray)', border: '1px solid var(--border-gray)' }}
        >
          <option value="opus">Opus (48 kHz)</option>
          <option value="pcmu">PCMU (8 kHz)</option>
          <option value="pcma">PCMA (8 kHz)</option>
        </select>
      </div>
    </div>
  );
}

export default BottomToolbar;
