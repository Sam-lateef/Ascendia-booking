"use client";

import React, { useState } from "react";
import OfficeContextModal from "./OfficeContextModal";

interface OfficeContextStatusProps {
  sessionStatus: string;
}

export default function OfficeContextStatus({ sessionStatus }: OfficeContextStatusProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors active:scale-95"
        style={{
          background: '#3b82f6',
          color: '#ffffff'
        }}
        title="View office context and schedule status"
      >
        Office Status
      </button>
      
      {isModalOpen && (
        <OfficeContextModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}











