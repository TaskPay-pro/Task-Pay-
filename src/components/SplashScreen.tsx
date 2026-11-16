import React, { useEffect, useState } from 'react';
import { TASKPAY_LOGO_SRC } from '../types/taskpay';

interface SplashScreenProps {
  onDone: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1200);
    const doneTimer = setTimeout(() => onDone(), 1600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      onClick={() => {
        setFading(true);
        setTimeout(onDone, 220);
      }}
      role="status"
      aria-label="Loading TaskPay VIP"
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] px-6 transition-opacity duration-300 cursor-pointer ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-[#00FF66]/25 blur-3xl"
      />

      <div className="relative flex flex-col items-center">
        {/* Glowing Neon 3D Frame around uploaded TaskPay logo */}
        <div className="animate-vip-logo relative rounded-[2rem] p-2 bg-[#0b0e0c] border-2 border-[#00FF66] shadow-[0_0_45px_rgba(0,255,102,0.55),0_0_16px_rgba(255,255,255,0.22)_inset]">
          <div className="rounded-[1.5rem] overflow-hidden border border-white/20 bg-[#050505]">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay 3D VIP Logo"
              className="h-36 w-36 object-cover"
            />
          </div>
        </div>

        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white">
          Task<span className="text-[#00FF66]">Pay</span>
        </h1>
        <p className="mt-1.5 text-[11px] font-bold tracking-[0.24em] uppercase text-[#00FF66]">
          Work · Complete · Earn
        </p>

        <div className="mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-[#101512] border border-[#00FF66]/30">
          <div className="h-full w-full origin-left bg-[#00FF66] animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};
