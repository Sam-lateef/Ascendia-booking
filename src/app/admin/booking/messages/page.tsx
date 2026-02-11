'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Clock, User, RefreshCw } from 'lucide-react';

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface SMSConversation {
  id: string;
  session_id: string;
  from_number: string;
  to_number: string;
  start_timestamp: number;
  updated_at: string;
  call_status: string;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: Message[];
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<SMSConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<SMSConversation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all SMS conversations (no date filter)
      const response = await fetch('/api/conversations?channel=sms');
      const data = await response.json();
      
      // Sort by most recent first
      const sorted = (Array.isArray(data) ? data : []).sort((a: any, b: any) => {
        const aTime = new Date(a.updated_at || a.createdAt).getTime();
        const bTime = new Date(b.updated_at || b.createdAt).getTime();
        return bTime - aTime;
      });
      
      setConversations(sorted);
    } catch (error) {
      console.error('Error fetching SMS conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
  };

  const openConversationDialog = (conversation: SMSConversation) => {
    setSelectedConversation(conversation);
    setIsDialogOpen(true);
  };

  const formatTime = (timestamp: string | number): string => {
    try {
      const date = new Date(typeof timestamp === 'number' ? timestamp : timestamp);
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return String(timestamp);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getRelativeTime = (timestamp: string): string => {
    try {
      const now = new Date().getTime();
      const then = new Date(timestamp).getTime();
      const diff = now - then;
      
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      
      return formatTime(timestamp);
    } catch {
      return formatTime(timestamp);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            SMS Messages
          </h1>
          <p className="text-gray-600 mt-1">
            All text message conversations
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Conversations</p>
              <p className="text-3xl font-bold text-gray-900">{conversations.length}</p>
            </div>
            <MessageSquare className="h-10 w-10 text-blue-500 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {conversations.filter(c => {
                  const today = new Date().setHours(0, 0, 0, 0);
                  const convDate = new Date(c.updated_at).setHours(0, 0, 0, 0);
                  return convDate === today;
                }).length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-green-500 opacity-20" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-3xl font-bold text-gray-900">
                {conversations.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
              </p>
            </div>
            <MessageSquare className="h-10 w-10 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Conversations</h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">No SMS conversations yet</p>
            <p className="text-gray-500 text-sm">
              Text messages will appear here when customers text your number
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openConversationDialog(conversation)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Contact info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">
                          {formatPhoneNumber(conversation.from_number)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {conversation.messageCount} messages
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage || 'No messages yet'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        To: {formatPhoneNumber(conversation.to_number)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Right: Time and status */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-gray-500">
                      {getRelativeTime(conversation.updated_at)}
                    </p>
                    <Badge 
                      variant={conversation.call_status === 'ongoing' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {conversation.call_status || 'active'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              SMS Conversation
            </DialogTitle>
            <DialogDescription>
              {selectedConversation && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">From:</span>
                    <span>{formatPhoneNumber(selectedConversation.from_number)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">To:</span>
                    <span>{formatPhoneNumber(selectedConversation.to_number)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Started:</span>
                    <span>{formatTime(selectedConversation.start_timestamp)}</span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedConversation && (
            <div className="space-y-4 mt-4">
              {/* Messages */}
              <div className="space-y-3">
                {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No messages in this conversation</p>
                  </div>
                )}
              </div>

              {/* Session Info */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-mono">
                  Session ID: {selectedConversation.session_id}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
