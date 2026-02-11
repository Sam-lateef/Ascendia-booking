"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ReferenceDnaScene } from './components/background/ReferenceDnaScene';

// Demo org ID - should match your database
const DEMO_ORG_ID = 'b445a9c7-af93-4b4a-a975-40d3f44178ec';

interface Booking {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  appointment_date: string;
  appointment_time: string;
  provider_name: string;
  created_at: string;
}

export default function LandingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Fetch recent bookings
  const fetchBookings = async () => {
    try {
      const response = await fetch(`/api/demo/recent-bookings?organizationId=${DEMO_ORG_ID}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  // Delete booking
  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/demo/delete-booking?id=${bookingId}&organizationId=${DEMO_ORG_ID}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh bookings
        fetchBookings();
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
    }
  };

  // Poll for new bookings every 10 seconds
  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-950 relative overflow-hidden">
      {/* WebGL Background */}
      <div className="fixed inset-0 opacity-60 pointer-events-none z-0">
        <ReferenceDnaScene />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
      {/* Navigation */}
      <nav className="w-full px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
            Ascendia AI
          </h1>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-6 py-2 text-teal-200 font-medium hover:text-amber-300 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 rounded-lg font-medium hover:from-amber-400 hover:to-yellow-500 transition-all shadow-lg shadow-amber-500/20"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-8 py-20 text-center">
        <h2 className="text-6xl font-bold text-white mb-8 leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          Automated Booking Solution
        </h2>
        
        <div className="relative inline-block">
          <div className="absolute inset-0 -inset-x-32 -inset-y-8 rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 70%)' }}></div>
          <p className="relative text-3xl text-white/90 mb-12 leading-relaxed max-w-4xl mx-auto px-8" style={{ textShadow: '0 3px 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.8)' }}>
            24/7 AI Receptionist - Never miss a call again
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-6 justify-center mb-12">
          <Link
            href="/login"
            className="px-10 py-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-900 text-lg rounded-lg font-semibold hover:from-amber-400 hover:to-yellow-500 transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-400/40"
          >
            Try Demo
          </Link>
          <Link
            href="/signup"
            className="px-10 py-4 border-2 border-teal-400 text-teal-200 text-lg rounded-lg font-semibold hover:bg-teal-900/30 hover:border-amber-400 transition-all"
          >
            Get Started
          </Link>
        </div>

        {/* Try It Now Section */}
        <div className="max-w-3xl mx-auto mb-16 p-8 bg-gradient-to-br from-amber-900/20 to-teal-900/20 backdrop-blur-md rounded-xl shadow-2xl border border-amber-500/30">
          <h3 className="text-2xl font-bold text-white mb-6">Try It Now - Call Our AI Receptionist</h3>
          <div className="p-8 bg-gradient-to-br from-teal-500/10 to-amber-500/10 rounded-lg text-center relative border border-amber-400/20">
            <p className="text-white text-lg mb-4">Experience AI-Powered Booking Live</p>
            <a 
              href="tel:+16197901748"
              className="inline-block text-4xl font-bold text-white hover:text-amber-300 transition-all mb-4"
            >
              +1 (619) 790-1748
            </a>
            <p className="text-white mt-2 max-w-md mx-auto">
              Call now and book an appointment with our AI receptionist. Watch your booking appear live below!
            </p>
          </div>
        </div>

        {/* Live Bookings Widget */}
        <div className="max-w-5xl mx-auto mb-16 p-8 bg-gradient-to-br from-teal-900/20 to-amber-900/20 backdrop-blur-md rounded-xl shadow-2xl border border-teal-500/30">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Recent Live Bookings</h3>
            <span className="text-sm text-white/80">Updates every 10 seconds</span>
          </div>
          
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-white/80">
              <p className="text-lg">No bookings yet. Be the first to try it!</p>
              <p className="text-sm mt-2">Call the number above to see your booking appear here live.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 bg-slate-900/40 border border-amber-500/20 rounded-lg hover:border-amber-400/50 hover:bg-slate-900/60 transition-all backdrop-blur-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold text-white">
                          {booking.first_name} {booking.last_name}
                        </span>
                        <span className="text-sm text-white/70">{booking.phone}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-white/80">
                        <span>{booking.appointment_date}</span>
                        <span>{booking.appointment_time}</span>
                        <span>{booking.provider_name}</span>
                      </div>
                      <div className="text-xs text-white/60 mt-2">
                        Booked {new Date(booking.created_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBooking(booking.id)}
                      className="ml-4 px-3 py-1 text-sm text-red-300 hover:text-red-200 hover:bg-red-900/30 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="p-8 bg-gradient-to-br from-teal-900/30 to-slate-900/30 backdrop-blur-md rounded-xl shadow-xl border border-amber-500/20 hover:border-amber-400/40 transition-all">
            <h3 className="text-2xl font-bold text-white mb-4">Multi-Channel AI</h3>
            <p className="text-white/90 text-lg">
              Voice calls, text messages, web chat, and WhatsApp - all powered by your AI receptionist working 24/7
            </p>
          </div>
          
          <div className="p-8 bg-gradient-to-br from-amber-900/20 to-slate-900/30 backdrop-blur-md rounded-xl shadow-xl border border-teal-500/20 hover:border-teal-400/40 transition-all">
            <h3 className="text-2xl font-bold text-white mb-4">Calendar Integration</h3>
            <p className="text-white/90 text-lg">
              Seamlessly integrates with Google Calendar and other major calendar systems for real-time availability
            </p>
          </div>
          
          <div className="p-8 bg-gradient-to-br from-teal-900/30 to-amber-900/20 backdrop-blur-md rounded-xl shadow-xl border border-amber-500/20 hover:border-amber-400/40 transition-all">
            <h3 className="text-2xl font-bold text-white mb-4">Fully Automated</h3>
            <p className="text-white/90 text-lg">
              Complete booking automation from first contact to confirmation - no human intervention needed
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 py-8 text-center">
          <p className="text-lg bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">Ascendia AI - Smart Booking, Automated</p>
        </div>
      </div>
      </div>
    </div>
  );
}
