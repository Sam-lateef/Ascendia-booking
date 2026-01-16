"use client";

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export interface MinimalTranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function MinimalTranscript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
}: MinimalTranscriptProps) {
  const tCommon = useTranslations('common');
  const { transcriptItems } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [transcriptItems]);

  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  return (
    <div className="flex flex-col h-full" style={{ background: '#ffffff' }}>
      {/* Messages Area */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ background: '#ffffff', color: '#111827' }}
      >
        {[...transcriptItems]
          .filter(item => !item.isHidden && item.type === "MESSAGE")
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map((item) => {
            const { itemId, title, role } = item;
            const isUser = role === "user";
            const displayText = title || "";
            
            // Skip empty messages
            if (!displayText.trim()) {
              return null;
            }
            
            return (
              <div
                key={itemId}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-lg px-4 py-3 shadow-sm"
                  style={{
                    background: isUser ? '#3b82f6' : '#f3f4f6',
                    color: isUser ? '#ffffff' : '#111827',
                  }}
                >
                  <div className="text-xs font-medium mb-1.5 opacity-70">
                    {isUser ? "You" : "Agent"}
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    <ReactMarkdown>{displayText}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
        {transcriptItems.filter(item => !item.isHidden && item.type === "MESSAGE").length === 0 && (
          <div className="text-center mt-8" style={{ color: '#9ca3af' }}>
            <div className="text-sm">{tCommon('start_a_conversation')}</div>
            {!canSend && (
              <div className="text-xs mt-2 opacity-75">{tCommon('connect_to_enable_messaging')}</div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-4 flex items-center gap-2 border-t" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-3 md:px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ 
            borderColor: '#d1d5db', 
            color: '#111827',
            background: '#ffffff',
            fontSize: '16px' // Prevents zoom on iOS
          }}
          placeholder={tCommon('type_a_message')}
          disabled={!canSend}
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          style={{
            background: canSend && userText.trim() ? '#3b82f6' : '#e5e7eb',
            color: canSend && userText.trim() ? '#ffffff' : '#9ca3af'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default MinimalTranscript;

