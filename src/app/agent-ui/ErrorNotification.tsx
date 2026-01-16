"use client";

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import React, { useEffect } from "react";

export type ErrorType = 'openai_quota' | 'opendental_connection' | 'config' | 'api' | null;

interface ErrorNotificationProps {
  errorType: ErrorType;
  onDismiss: () => void;
}

export default function ErrorNotification({ errorType, onDismiss }: ErrorNotificationProps) {
  const tCommon = useTranslations('common');
  useEffect(() => {
    if (errorType) {
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [errorType, onDismiss]);

  if (!errorType) return null;

  const errorConfig = {
    openai_quota: {
      title: "OpenAI API Quota Exceeded",
      message: "Your OpenAI API quota has been exceeded. Please check your billing and usage limits.",
      color: "#ef4444",
      bgColor: "#fee2e2",
      borderColor: "#fecaca"
    },
    opendental_connection: {
      title: "OpenDental API Connection Failed",
      message: "Unable to connect to the OpenDental API. The server may be offline or unreachable.",
      color: "#f59e0b",
      bgColor: "#fef3c7",
      borderColor: "#fde68a"
    },
    config: {
      title: "Agent Not Ready",
      message: "The agent configuration could not be loaded. This may happen if the database is not seeded or the build process didn't complete. Try rebuilding with 'npm run build' or check console for errors.",
      color: "#f59e0b",
      bgColor: "#fef3c7",
      borderColor: "#fde68a"
    },
    api: {
      title: "Connection Failed",
      message: "Unable to connect to the agent service. Please check your connection and try again.",
      color: "#ef4444",
      bgColor: "#fee2e2",
      borderColor: "#fecaca"
    }
  };

  const config = errorConfig[errorType];

  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-md rounded-lg shadow-lg p-4 animate-in slide-in-from-top-5"
      style={{
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: config.color }}
          >
            {config.title}
          </h3>
          <p
            className="text-sm"
            style={{ color: "#374151" }}
          >
            {config.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
          style={{ color: "#9ca3af" }}
          aria-label={tCommon('dismiss')}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}






