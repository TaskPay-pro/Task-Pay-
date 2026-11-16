import React from 'react';
import type { PaymentMethod } from '../types/taskpay';

export const PaymentMethodLogo: React.FC<{ method: PaymentMethod; size?: number }> = ({
  method,
  size = 28,
}) => {
  switch (method) {
    case 'JazzCash':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#18181B" />
          <circle cx="18" cy="18" r="13" fill="#FFB800" fillOpacity="0.16" stroke="#FFB800" strokeWidth="1.5" />
          <path
            d="M12.5 22.5c1.2 1.2 3.1 1.5 4.8.7 1.8-.9 2.4-2.8 2.4-5.2v-7h-2.6v7c0 1.4-.4 2.4-1.3 2.8-.8.4-1.7.2-2.3-.5l-1 2.2zm9.3-3.5c0 2.7 1.8 4.4 4.5 4.4 1.3 0 2.3-.4 3.1-1l-1-1.9c-.5.4-1.2.6-1.9.6-1.3 0-2.1-.8-2.1-2.1s.8-2.1 2.1-2.1c.7 0 1.4.2 1.9.6l1-1.9c-.8-.6-1.8-1-3.1-1-2.7 0-4.5 1.7-4.5 4.4z"
            fill="#FFB800"
          />
        </svg>
      );
    case 'EasyPaisa':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#062212" />
          <rect x="2" y="2" width="32" height="32" rx="7" stroke="#00FF66" strokeWidth="1.5" />
          <path
            d="M11 19.5c0-3.3 2.5-5.8 5.8-5.8 3.1 0 5.4 2.2 5.4 5.5v.9h-8.1c.3 1.4 1.4 2.3 3 2.3 1.1 0 2.1-.4 2.9-1l1.4 1.8c-1.1 1-2.6 1.5-4.4 1.5-3.6 0-6-2.2-6-5.2zm8.2-1.2c-.2-1.4-1.1-2.3-2.5-2.3s-2.3.9-2.6 2.3h5.1z"
            fill="#00FF66"
          />
          <circle cx="25.5" cy="11.5" r="2.2" fill="#FFFFFF" />
        </svg>
      );
    case 'SadaPay':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#0D2621" />
          <path d="M10 14.5L18 9l8 5.5-8 5.5-8-5.5z" fill="#00FF66" />
          <path d="M10 21.5L18 16l8 5.5-8 5.5-8-5.5z" fill="#FFFFFF" fillOpacity="0.9" />
        </svg>
      );
    case 'NayaPay':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#171717" />
          <rect x="2" y="2" width="32" height="32" rx="7" stroke="#FFB800" strokeWidth="1.5" />
          <path
            d="M11 24V12h2.7l6.6 7.8V12H23v12h-2.6l-6.7-7.9V24H11z"
            fill="#FFFFFF"
          />
          <circle cx="24.5" cy="11.5" r="2" fill="#FFB800" />
        </svg>
      );
    case 'UPaisa':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#121412" />
          <rect x="2" y="2" width="32" height="32" rx="7" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1.5" />
          <path
            d="M11.5 11.5h3v7.3c0 2.1 1.3 3.4 3.5 3.4s3.5-1.3 3.5-3.4v-7.3h3v7.4c0 3.7-2.6 6.1-6.5 6.1s-6.5-2.4-6.5-6.1v-7.4z"
            fill="#00FF66"
          />
        </svg>
      );
    case 'AEPAY':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg"
        >
          <rect width="36" height="36" rx="9" fill="#050505" />
          <rect x="2" y="2" width="32" height="32" rx="7" stroke="#00FF66" strokeWidth="1.5" />
          <path
            d="M13 24l5-12 5 12h-2.8l-.9-2.4h-4.6L15.8 24H13zm3.6-4.7h2.8L18 15.6l-1.4 3.7z"
            fill="#FFFFFF"
          />
          <path d="M9 18h3M24 18h3" stroke="#00FF66" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
};
